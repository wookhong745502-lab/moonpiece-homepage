import { getAssetFromKV } from "@cloudflare/kv-asset-handler";
import manifestJSON from "__STATIC_CONTENT_MANIFEST";

let assetManifest;
try {
  assetManifest = typeof manifestJSON === 'string' ? JSON.parse(manifestJSON) : manifestJSON;
} catch (e) {
  assetManifest = {};
}

// --- Global Helpers ---
function parseCookies(request) {
  try {
    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader) return {};
    return Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')));
  } catch (e) { return {}; }
}

async function safeGetJson(key, env) {
  try {
    const obj = await env.JOURNAL_BUCKET.get(key);
    if (!obj) return key.endsWith('.json') && !key.includes('list.json') ? {} : [];
    let text = await obj.text();
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFEFF]/g, '').trim();
    if (!text) return key.endsWith('.json') && !key.includes('list.json') ? {} : [];
    const data = JSON.parse(text);
    return data;
  } catch (e) {
    console.error(`Safe JSON parse error for ${key}:`, e.message);
    return key.endsWith('.json') && !key.includes('list.json') ? {} : [];
  }
}

/**
 * R2 JSON Database 무결성 강화를 위한 원자적 업데이트 함수
 * @param {string} key R2 Key
 * @param {object} env Environment
 * @param {function} updater 기존 리스트를 받아 새로운 리스트를 반환하는 함수
 */
async function atomicUpdateList(key, env, updater) {
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts) {
    const obj = await env.JOURNAL_BUCKET.get(key);
    let list = [];
    let etag = null;
    
    if (obj) {
      try {
        const text = await obj.text();
        list = JSON.parse(text);
        etag = obj.httpEtag.replace(/"/g, '');
      } catch (e) {
        console.error(`Atomic read error for ${key}:`, e.message);
        list = [];
      }
    }
    
    const updatedList = updater(list);
    
    // 데이터 구조 검증 (Validation)
    if (!Array.isArray(updatedList)) {
      throw new Error("무결성 오류: 데이터는 반드시 배열 형태여야 합니다.");
    }
    
    try {
      await env.JOURNAL_BUCKET.put(key, JSON.stringify(updatedList), {
        onlyIf: etag ? { etagMatches: etag } : undefined,
        httpMetadata: { contentType: "application/json; charset=UTF-8" }
      });
      console.log(`[Atomic Success] ${key} updated (Attempt ${attempts + 1})`);
      return true;
    } catch (e) {
      // 412 Precondition Failed: 동시성 충돌 발생 시 재시도
      if (e.message.includes("412") || e.status === 412) {
        attempts++;
        console.warn(`[Atomic Conflict] Retrying ${key} update... (${attempts}/${maxAttempts})`);
        continue;
      }
      throw e;
    }
  }
  throw new Error(`데이터 일관성 확보 실패: ${key} 업데이트가 동시성 문제로 중단되었습니다.`);
}

function parseAIJson(raw) {
  if (!raw) return {};
  if (typeof raw !== 'string') {
    console.error("parseAIJson: raw is not a string", raw);
    if (typeof raw === 'object') return raw; // 이미 객체라면 그대로 반환
    return {};
  }
  let cleaned = raw.trim();
  
  // 1. Try direct parse after removing markdown blocks
  try {
    const direct = cleaned.replace(/```json|```/g, "").trim();
    return JSON.parse(direct);
  } catch (e) {
    // 2. Try to find the first '{' and last '}'
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    
    if (start !== -1 && end !== -1 && start < end) {
      const jsonCandidate = cleaned.substring(start, end + 1);
      try {
        return JSON.parse(jsonCandidate);
      } catch (err) {
        // 3. Last resort: if nested structures exist or extra text, try to find a valid JSON block
        // (This is a bit more complex, but usually the substring approach covers 99% of cases)
        console.error("JSON block extraction failed", err.message);
      }
    }
    return {};
  }
}

function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '') // Only a-z, 0-9, -, _
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .substring(0, 50);
}

async function getAiRecommendedYoutubeId(keyword, env) {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    const html = await res.text();
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (match && match[1]) {
      console.log(`[YouTube] Found video ID: ${match[1]} for keyword: ${keyword}`);
      return match[1];
    }
    console.log(`[YouTube] No video found for keyword: ${keyword}`);
    return null;
  } catch (e) {
    console.error("[YouTube] Search error:", e.message);
    return null;
  }
}

function classifyCategory(q) {
  const text = q || "";
  if (/수면|잠|불면|자세|왼쪽|옆으로|엎드려|엎드림/.test(text)) return "sleep";
  if (/통증|환도|허리|골반|부종|저림|아픔|치료/.test(text)) return "pain";
  if (/영양|음식|식단|비타민|당뇨|혈압|중독증|체중|운동|관리/.test(text)) return "health";
  if (/태동|태교|심리|우울|스트레스|준비|지식|질문|방법|출산|육아/.test(text)) return "psychology";
  return "others";
}

async function aiCall(prompt, env, system = "You are an elite Korean content architect.") {
  const settings = await safeGetJson("config/settings.json", env); // Note: settings is an object usually but safeGetJson returns [] if missing.
  // Fix settings check
  const textEngine = (settings && settings.textApi) || "deepseek";

  if (textEngine.startsWith("@cf/")) {
    try {
      const response = await env.AI.run(textEngine, {
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 4096 // Ensure enough room for deep content
      });
      let result = response.response || response.choices?.[0]?.message?.content || response;
      if (typeof result !== "string") result = JSON.stringify(result);
      return result;
    } catch (e) { console.error("Workers AI error:", e.message); }
  }

  if (textEngine === "gemini" && env.GEMINI_API_KEY) {
    const geminiKey = env.GEMINI_API_KEY.trim();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [ { role: "user", parts: [{ text: prompt }] } ],
        system_instruction: { parts: [{ text: system }] },
        generationConfig: { temperature: 0.7 }
      })
    });
    if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Gemini API error: ${res.status} - ${detail}`);
    }
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  }

  // Default to DeepSeek (or if explicitly selected)
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      temperature: 0.7
    })
  });
  
  if (!res.ok) {
    // Retry with Gemini as fallback if DeepSeek fails (e.g. 402 out of balance)
    if (env.GEMINI_API_KEY) {
        const geminiKey = env.GEMINI_API_KEY.trim();
        const fallbackRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [ { role: "user", parts: [{ text: prompt }] } ],
            system_instruction: { parts: [{ text: system }] },
            generationConfig: { temperature: 0.7 }
          })
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          return fallbackData.candidates[0].content.parts[0].text;
        } else {
            const errText = await fallbackRes.text();
            throw new Error(`DeepSeek API error: ${res.status}, Gemini Fallback error: ${fallbackRes.status} - ${errText}`);
        }
    }
    throw new Error(`DeepSeek API error: ${res.status}`);
  }
  
  const data = await res.json();
  return data.choices[0].message.content;
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      // Public API Routes
      if (url.pathname === "/list-journals") {
        const list = await safeGetJson("journal/list.json", env);
        return new Response(JSON.stringify(list), { headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" } });
      }
      if (url.pathname === "/list-knowledge") {
        const list = await safeGetJson("knowledge/list.json", env);
        return new Response(JSON.stringify(list), { headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" } });
      }

      // Auth middleware
      if (url.pathname.startsWith('/admin/') && url.pathname !== '/admin/login.html' && !url.pathname.startsWith('/admin/api/auth/')) {
        const cookies = parseCookies(request);
        if (cookies['admin_session'] !== 'wookhong_verified') return Response.redirect(`${url.origin}/admin/login.html`, 302);
      }

      // Admin APIs (Security Verified)
      if (url.pathname === '/admin/api/auth/verify' && request.method === 'POST') {
        const body = await request.json();
        if (body.token) {
           // Verify Google ID Token
           const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${body.token}`);
           if (!verifyRes.ok) return new Response(JSON.stringify({ success: false, error: "Invalid token" }), { status: 401 });
           
           const payload = await verifyRes.json();
           const allowedEmail = "wookhong745502"; 
           
           if (payload.email && (payload.email.startsWith(allowedEmail) || payload.email === "wookhong745502@gmail.com")) {
             return new Response(JSON.stringify({ success: true }), {
               headers: { 
                 "Content-Type": "application/json", 
                 "Set-Cookie": "admin_session=wookhong_verified; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400" 
               }
             });
           }
           return new Response(JSON.stringify({ success: false, error: "Unauthorized email" }), { status: 403 });
        }
        return new Response(JSON.stringify({ success: false, error: "Token missing" }), { status: 400 });
      }

      if (url.pathname === "/admin/api/suggest" && request.method === "POST") {
        const { type, keyword } = await request.json();
        console.log(`[Suggest] Type: ${type}, Keyword: ${keyword}`);
        let prompt = "";
        switch(type) {
          case "title": prompt = `Keyword: ${keyword}. Suggest one powerful SEO title in Korean.`; break;
          case "slug": prompt = `Keyword: ${keyword}. Suggest a short, English URL slug. ONLY return the slug string itself, no other text, quotes, or explanation.`; break;
          case "keywords": prompt = `Keyword: ${keyword}. List 10 sub-keywords (comma separated).`; break;
          case "source": prompt = `Keyword: ${keyword}. Translate this keyword into English and Japanese to find a world-class prestigious medical/academic source (e.g., Mayo Clinic, Harvard Medical, NIH, WHO, University of Tokyo Hospital, Lancet). Suggest one global authority. Return ONLY a JSON object: {"name": "Institution Name (Translated to Korean)", "url": "https://..."}.`; break;
          case "question": prompt = `Keyword: ${keyword}. Suggest a natural user question in Korean ONLY. No English.`; break;
          case "youtube": {
            const ytId = await getAiRecommendedYoutubeId(keyword, env);
            return new Response(JSON.stringify({ result: ytId || "" }), { headers: { "Content-Type": "application/json" } });
          }
        }
        let result = await aiCall(prompt, env);
        result = result.trim();
        if (type === "source") {
          // Clean up potential markdown blocks for JSON parsing
          result = result.replace(/```json|```/g, "").trim();
        } else {
          result = result.replace(/['"“”]/g, ""); 
        }
        if (type === "slug") result = generateSlug(result); 
        return new Response(JSON.stringify({ result }), { headers: { "Content-Type": "application/json" } });
      }

      if (url.pathname === "/admin/api/generate-journal" || url.pathname === "/admin/api/generate-knowledge" || 
          url.pathname === "/admin/api/generate-seo" || url.pathname === "/admin/api/generate-aeo") {
        return await generateContentHandler(request, env);
      }

      if (url.pathname === "/admin/api/cleanup-lists") {
        const keys = ["journal/list.json", "knowledge/list.json"];
        const results = {};
        for (const key of keys) {
          let originalLen = 0;
          let cleanedLen = 0;
          
          await atomicUpdateList(key, env, (list) => {
            originalLen = list.length;
            const filtered = list.filter(item => {
              const t = (item.title || "").toLowerCase();
              const d = (item.desc || "").toLowerCase();
              return !(t.includes("test") || t.includes("dummy") || t.includes("더미") || t.includes("테스트") || t.includes("asdf") || d.length < 10);
            });
            cleanedLen = filtered.length;
            return filtered;
          });
          
          results[key] = { original: originalLen, cleaned: cleanedLen };
        }
        return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json" } });
      }

      if (url.pathname === "/admin/api/auto-publish") return await autoPublishHandler(request, env);

      if (url.pathname === "/admin/api/settings") {
        if (request.method === "GET") {
          const cfg = await env.JOURNAL_BUCKET.get("config/settings.json");
          return new Response(cfg ? await cfg.text() : "{}", { headers: { "Content-Type": "application/json" } });
        }
        const settings = await request.json();
        await env.JOURNAL_BUCKET.put("config/settings.json", JSON.stringify(settings));
        return new Response(JSON.stringify({ success: true }));
      }

      if (url.pathname === "/admin/api/posts") {
        const j = await safeGetJson("journal/list.json", env);
        const k = await safeGetJson("knowledge/list.json", env);
        const combined = [...j.map(p=>({...p, type:'journal'})), ...k.map(p=>({...p, type:'knowledge'}))];
        return new Response(JSON.stringify(combined.sort((a,b)=>new Date(b.date)-new Date(a.date))));
      }

      if (url.pathname === "/admin/api/posts/delete" && request.method === "POST") {
        const { url: postUrl, type } = await request.json();
        const key = postUrl.startsWith('/') ? postUrl.slice(1) : postUrl;
        await env.JOURNAL_BUCKET.delete(key);
        const listKey = type === 'journal' ? "journal/list.json" : "knowledge/list.json";
        await atomicUpdateList(listKey, env, (list) => list.filter(p => p.url !== postUrl && p.url !== '/' + postUrl));
        return new Response(JSON.stringify({ success: true }));
      }

      if (url.pathname === "/admin/api/posts/raw" && request.method === "POST") {
        const { url: postUrl } = await request.json();
        const key = postUrl.startsWith('/') ? postUrl.slice(1) : postUrl;
        const obj = await env.JOURNAL_BUCKET.get(key);
        if (obj) return new Response(JSON.stringify({ success: true, html: await obj.text() }));
        return new Response(JSON.stringify({ success: false, error: "Not found" }));
      }

      if (url.pathname === "/admin/api/posts/update" && request.method === "POST") {
        const { url: postUrl, html, title, desc, image, type } = await request.json();
        const key = postUrl.startsWith('/') ? postUrl.slice(1) : postUrl;
        await env.JOURNAL_BUCKET.put(key, html, { httpMetadata: { contentType: "text/html" } });
        if (type) {
            const listKey = type === 'knowledge' ? "knowledge/list.json" : "journal/list.json";
            await atomicUpdateList(listKey, env, (list) => list.map(p => {
              if (p.url === postUrl || p.url === '/' + key) {
                  if (title) p.title = title;
                  if (desc) p.desc = desc;
                  if (image) p.image = image;
              }
              return p;
            }));
        }
        return new Response(JSON.stringify({ success: true }));
      }

      if (url.pathname === "/admin/api/bulk/queue") {
        const type = url.searchParams.get("type") || "seo";
        const key = `config/bulk_queue_${type}.json`;
        if (request.method === "GET") {
          const q = await env.JOURNAL_BUCKET.get(key);
          return new Response(q ? await q.text() : JSON.stringify({ active: false, items: [] }));
        }
        const data = await request.json();
        await env.JOURNAL_BUCKET.put(key, JSON.stringify(data));
        return new Response(JSON.stringify({ success: true }));
      }

      if (url.pathname === "/admin/api/regenerate-image" && request.method === "POST") {
        try {
          const { alt, type } = await request.json();
          const settings = await safeGetJson("config/settings.json", env);
          const imgModel = (type === 'seo' ? settings.imgSeo : settings.imgAeo) || "@cf/bytedance/stable-diffusion-xl-lightning";
          const imgRes = await env.AI.run(imgModel, { prompt: `High quality, ${alt}`, negative_prompt: settings.negPrompt });
          const newKey = `assets/${type === 'seo' ? 'journal' : 'knowledge'}/regen-${Date.now()}.png`;
          await env.JOURNAL_BUCKET.put(newKey, imgRes, { httpMetadata: { contentType: "image/png" } });
          return new Response(JSON.stringify({ success: true, url: `/${newKey}` }));
        } catch(e) { return new Response(JSON.stringify({ success: false, error: e.message })); }
      }

      if (url.pathname === "/admin/api/migrate/clear-all" && request.method === "POST") {
        await env.JOURNAL_BUCKET.put("journal/list.json", "[]");
        await env.JOURNAL_BUCKET.put("knowledge/list.json", "[]");
        return new Response(JSON.stringify({ success: true }));
      }

      if (url.pathname.startsWith("/journal/") || url.pathname.startsWith("/knowledge/") || url.pathname.startsWith("/assets/")) {
        const key = decodeURIComponent(url.pathname.slice(1));
        const obj = await env.JOURNAL_BUCKET.get(key);
        if (obj) {
          const h = new Headers();
          obj.writeHttpMetadata(h);
          h.set("Access-Control-Allow-Origin", "*");
          h.set("Cache-Control", "no-cache, no-store, must-revalidate");
          h.set("Pragma", "no-cache");
          h.set("Expires", "0");
          return new Response(obj.body, { headers: h });
        }
      }

      return await getAssetFromKV({ request, waitUntil: ctx.waitUntil.bind(ctx) }, { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: assetManifest });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  },

  async scheduled(event, env, ctx) {
    console.log("[Scheduled] Bulk publishing check...");
    const types = ['seo', 'aeo'];
    
    for (const type of types) {
      const key = `config/bulk_queue_${type}.json`;
      const queueObj = await env.JOURNAL_BUCKET.get(key);
      if (!queueObj) continue;
      
      let queueData = JSON.parse(await queueObj.text());
      if (!queueData.active || !queueData.items || queueData.items.length === 0) continue;

      const now = Date.now();
      const lastRun = queueData.lastRun || 0;
      const intervalMs = (queueData.intervalHours || 24) * 60 * 60 * 1000;

      if (now - lastRun >= intervalMs) {
        const kstDate = new Date(now + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
        const itemIndex = queueData.items.findIndex(i => i.status === 'pending' && (!i.publishDate || i.publishDate <= kstDate));
        
        if (itemIndex === -1) continue;

        const task = queueData.items[itemIndex];
        try {
          const draft = await performAiGeneration({ type: queueData.type || type, keyword: task.keyword }, env);
          const finalSlug = await resolveUniqueSlug(queueData.type || type, draft.slug, env);
          const publishDate = task.publishDate || kstDate;
          const isSEO = (queueData.type || type) === 'seo';
          const targetKey = isSEO ? `journal/${finalSlug}.html` : `knowledge/${finalSlug}.html`;
          
          const templateData = {
            title: draft.title, description: draft.summary, desc: draft.summary, summary: draft.summary,
            category: classifyCategory(task.keyword), publish_date: publishDate, date: publishDate,
            rich_content: draft.html, content: draft.html,
            faq_content: (draft.faqs || []).map(f => `<div class="faq-item bg-white p-8 rounded-2xl border border-slate-100 shadow-sm mb-6"><h4 class="text-lg font-bold text-slate-900 mb-3 flex items-start gap-3"><span class="text-moon-600">Q.</span> ${f.q}</h4><p class="text-slate-600 leading-relaxed pl-8">${f.a}</p></div>`).join(''),
            faq_section: (draft.faqs && draft.faqs.length) ? `<section class="mt-24 p-8 lg:p-16 bg-slate-50 rounded-[3rem] border border-slate-100"><h3 class="text-3xl font-serif font-black mb-10 text-slate-900">도움이 되는 질문 (FAQ)</h3><div class="space-y-4">${draft.faqs.map(f => `<div class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm"><h4 class="text-lg font-bold text-slate-900 mb-3 flex gap-3 text-moon-600">Q. <span class="text-slate-900">${f.q}</span></h4><p class="text-slate-600 leading-relaxed pl-8">${f.a}</p></div>`).join('')}</div></section>` : "",
            og_image: draft.image, slug: finalSlug, json_ld: JSON.stringify(draft.schema),
            source_name: draft.sourceName, source_url: draft.sourceUrl,
            source_section: (draft.sourceName && draft.sourceUrl) ? `<div class="mt-16 p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4"><span class="material-symbols-outlined text-moon-600">verified_user</span><div class="text-sm"><span class="text-slate-400 block mb-1">본 콘텐츠는 아래의 정보를 바탕으로 작성되었습니다.</span><a href="${draft.sourceUrl}" target="_blank" rel="noopener" class="font-bold text-slate-900 hover:text-moon-600">${draft.sourceName}</a></div></div>` : "",
            youtube_section: draft.youtubeId ? `<div class="mt-16"><h3 class="text-2xl font-serif font-black mb-6 flex items-center gap-3 text-slate-900"><span class="material-symbols-outlined text-red-500">play_circle</span> 관련 영상</h3><div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:1.5rem;"><iframe src="https://www.youtube.com/embed/${draft.youtubeId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe></div></div>` : ""
          };

          const finalOutput = await renderTemplate(isSEO ? "journal_template.html" : "post_template.html", templateData, env);
          await env.JOURNAL_BUCKET.put(targetKey, finalOutput, { httpMetadata: { contentType: "text/html" } });
          await atomicUpdateList(isSEO ? "journal/list.json" : "knowledge/list.json", env, (list) => {
            list.push({ title: draft.title, desc: draft.summary, url: `/${targetKey}`, date: publishDate, category: templateData.category, image: draft.image, slug: finalSlug });
            return list;
          });

          task.status = 'success';
          task.path = `/${targetKey}`;
          queueData.lastRun = now;
        } catch (e) {
          console.error(`[Scheduled Error] ${type} - ${task.keyword}:`, e.message);
          task.status = 'fail';
          task.error = e.message;
          queueData.lastRun = now; 
        }
        await env.JOURNAL_BUCKET.put(key, JSON.stringify(queueData));
      }
    }
  }
};

// --- Core Logic ---

async function performAiGeneration(payload, env, logger = null) {
  const { type, keyword, title: inputTitle, style } = payload;
  const isSEO = type === 'seo';
  const isAEO = !isSEO;
  
  const log = async (msg) => { if (logger) await logger(msg); };

  const settingsObj = await env.JOURNAL_BUCKET.get("config/settings.json");
  const settings = settingsObj ? JSON.parse(await settingsObj.text()) : {};
  const imgModel = (isSEO ? settings.imgSeo : settings.imgAeo) || "@cf/bytedance/stable-diffusion-xl-lightning";
  const selectedStyle = style || settings.defaultStyle || "Professional photography";
  const defaultNeg = "bare skin, nsfw, low quality, watermark, text, error, blurry, bad anatomy, bad hands";
  const negPrompt = settings.negPrompt || defaultNeg;
  const imgSeoCount = settings.imgCount !== undefined ? parseInt(settings.imgCount) : 3;
  const faqCount = settings.faqCount !== undefined ? parseInt(settings.faqCount) : 3;

  await log(`🚀 AI 프로세스 가동: ${keyword}`);

  // 1. 제목 생성 (없을 경우)
  let finalTitle = inputTitle;
  if (!finalTitle) {
    finalTitle = await aiCall(`Suggest one powerful ${isSEO ? 'SEO' : 'AEO'} title for keyword: ${keyword}`, env);
    finalTitle = finalTitle.trim().replace(/['"]/g, '');
  }
  await log(`📌 제목 확정: ${finalTitle}`);


  // 1.5. 영문 슬러그 생성 (SEO 규정 준수)
  let generatedSlug = payload.slug;
  if (!generatedSlug) {
    try {
      await log(`🔗 영문 슬러그 생성 중...`);
      const slugPrompt = `Title: "${finalTitle}". Suggest a short, clean, professional English URL slug. 
      CRITICAL: Use only lowercase a-z and hyphens. NO quotes, NO Korean, NO special characters.
      Example: "benefits-of-left-side-sleeping". ONLY return the slug string.`;
      generatedSlug = await aiCall(slugPrompt, env, "You are an SEO expert.");
      generatedSlug = generatedSlug.trim().toLowerCase().replace(/['"“”]/g, "").replace(/[^a-z0-9\-]/g, '-').replace(/\-\-+/g, '-').replace(/^-|-$/g, '');
      if (!generatedSlug) throw new Error("Empty slug");
    } catch (e) {
      generatedSlug = generateSlug(finalTitle);
    }
  }
  await log(`📌 슬러그 확정: ${generatedSlug}`);

  // 2. 이미지용 영어 변환
  let englishKeyword = keyword;
  try {
    englishKeyword = await aiCall(`Translate exactly "${keyword}" into a short, descriptive English phrase for image generation. 
    CRITICAL SAFETY: Ensure the phrase is modest and professional. 
    ALWAYS include "Korean person" and "fully clothed". 
    ONLY return the English text.`, env, "You are a translator.");
    englishKeyword = englishKeyword.trim().replace(/['"]/g, '');
    await log(`🗣️ 이미지 변환: ${englishKeyword}`);
  } catch (e) {}

  // 3. 출처 자동 검색
  let finalSourceName = payload.sourceName || "";
  let finalSourceUrl = payload.sourceUrl || "";
  if (!finalSourceName || !finalSourceUrl) {
    try {
      await log(`🔍 신뢰도 출처 자동 검색 중...`);
      const sourceRaw = await aiCall(
        `Keyword: ${keyword}. Suggest one world-class prestigious medical/academic authority (e.g., Mayo Clinic, Harvard, WHO, etc.). Return ONLY JSON: {"name": "Name in Korean", "url": "https://..."}.`,
        env
      );
      const cleanedSrc = sourceRaw.replace(/\`\`\`json|\`\`\`/g, '').trim();
      const srcObj = JSON.parse(cleanedSrc);
      if (srcObj.name && srcObj.url) {
        finalSourceName = srcObj.name;
        finalSourceUrl = srcObj.url;
        await log(`✅ 출처 생성: ${finalSourceName}`);
      }
    } catch (e) {
      await log(`⚠️ 출처 검색 실패: ${e.message}`);
    }
  }

  // 4. 이미지 마커 준비
  const actualImgCount = isSEO ? imgSeoCount : 1; 
  let markers = [];
  for(let i=1; i<=actualImgCount; i++) markers.push(`{{IMG_${i}}}`);
  const markersText = markers.length > 0 ? `Use ${markers.join(', ')} markers in HTML sequentially between paragraphs.` : `Do NOT use any IMG markers.`;

  // 5. 프롬프트 구성
  let basePrompt = isSEO ? settings.seoPrompt : settings.aeoPrompt;
  if (!basePrompt) {
    basePrompt = isSEO ? 
      `Write a highly professional, empathetic, and strictly formatted SEO blog post about "{{keyword}}". Title: "{{title}}". \n\nCRITICAL: The output MUST exceed 2,000 Korean characters. Explain in profound detail with minimum 5 sections.\nUse exactly <article class="post-content">, <h2>, <h3>, <p>, <ul>, <strong> tags.` :
      `Write an elite-level AEO expert answer about "{{keyword}}". Title/Question: "{{title}}". \n\nCRITICAL REQUIREMENT:
      1. Length: MUST exceed 1,500 characters.
      2. Table: Include a detailed comparison table using HTML <table> tags for clarity.
      3. Structure: Use <h2>전문가 의견 분석 (E-E-A-T)</h2> and <h2>단계별 처방법 가이드</h2> sections.
      4. Format: Return ONLY raw HTML for the body content. Do NOT include <h1> or summary box (they are in the template).`;
  }
  basePrompt = basePrompt.replace(/{{keyword}}/g, keyword).replace(/{{title}}/g, finalTitle).replace(/{{subKeywords}}/g, payload.subKeywords || "");

  const universalPrompt = `### PRIMARY DIRECTIVES (USER GUIDELINES):
  ${basePrompt}

  ### SYSTEM REQUIREMENTS & OUTPUT FORMAT:
  CRITICAL: Your response must be a single JSON object:
  {
    "html": "The full body content in HTML format. ${markersText}",
    "faqs": [{"q": "...", "a": "..."}],
    "summary": "Professional 3-line expert summary for the top summary box."
  }
  Rules: ${faqCount} FAQs, HTML field ONLY with tags, properly escaped JSON.`;

  // 6. 텍스트 및 이미지 병렬 생성
  await log(`🚀 텍스트 및 이미지 ${actualImgCount + 1}개 병렬 생성 중...`);
  const [textRes, imgRes] = await Promise.all([
    aiCall(universalPrompt, env, "You are a specialized content JSON generator.").then(r => { log(`✅ 텍스트 생성 완료`); return r; }),
    (async () => {
      const imgPromises = [];
      for (let i = 0; i <= actualImgCount; i++) {
        let baseImgPrompt = isSEO ? settings.imgSeoPrompt : settings.imgAeoPrompt;
        if (!baseImgPrompt) {
          baseImgPrompt = isSEO 
            ? `Photo of Korean {{keyword}}, modest, fully clothed, elegant high-end style, premium photography, highly detailed, ${selectedStyle}`
            : `Clean informative infographic of Korean {{keyword}}, white background, premium minimalist design, vector style, highly readable, informative charts, ${selectedStyle}. Korean/English/Numbers only.`;
        }
        
        const prompt = baseImgPrompt.replace(/{{keyword}}/g, englishKeyword);
        
        const generateImg = async (p, retried = false) => {
          try {
            return await env.AI.run(imgModel, { prompt: p, negative_prompt: negPrompt });
          } catch (e) {
            if (e.message.includes("3030") && !retried) {
              const safePrompt = isSEO ? `A Korean woman sitting comfortably, fully clothed, high-end interior, soft lighting` : `Clean infographic of Korean mother, soft colors, minimalist design, no text`;
              return await generateImg(safePrompt, true);
            }
            return null;
          }
        };
        imgPromises.push(generateImg(prompt).then(r => { 
          if (r) log(`🖼️ 이미지 ${i+1} 완료`); 
          return r; 
        }));
      }
      return Promise.all(imgPromises);
    })()
  ]);

  // 7. 결과 조립
  const data = parseAIJson(textRes);
  let draftHtml = data.html || "";
  const timeStamp = Date.now();
  const slugBase = generatedSlug;
  let heroPath = "";
  const assetDir = isSEO ? "journal" : "knowledge";

  if (imgRes[0]) {
    const heroKey = `assets/${assetDir}/${slugBase}-${timeStamp}-hero.png`;
    await env.JOURNAL_BUCKET.put(heroKey, imgRes[0], { httpMetadata: { contentType: "image/png" } });
    heroPath = `/${heroKey}`;
  }

  for(let j=1; j<=actualImgCount; j++) {
    if (imgRes[j]) {
      const bKey = `assets/${assetDir}/${slugBase}-${timeStamp}-${j}.png`;
      await env.JOURNAL_BUCKET.put(bKey, imgRes[j], { httpMetadata: { contentType: "image/png" } });
      const imgTag = `<img src="/${bKey}" style="width:100%; border-radius:1rem; margin:2rem 0;" alt="${keyword} ${j}">`;
      if (draftHtml.includes(`{{IMG_${j}}}`)) draftHtml = draftHtml.replace(`{{IMG_${j}}}`, imgTag);
      else draftHtml += `\n\n${imgTag}`;
    }
  }

  const recYoutubeId = await getAiRecommendedYoutubeId(keyword, env);
  
  return { 
    title: finalTitle, 
    html: draftHtml, 
    faqs: data.faqs || [], 
    summary: data.summary || "",
    image: heroPath, 
    youtubeId: recYoutubeId, 
    type,
    slug: payload.slug || slugBase,
    sourceName: finalSourceName,
    sourceUrl: finalSourceUrl,
    schema: { "@context": "https://schema.org", "@type": "Article", "headline": finalTitle, "image": heroPath, "author": { "@type": "Organization", "name": "Moonpiece" } }
  };
}

async function resolveUniqueSlug(type, requestedSlug, env) {
  const listKey = type === 'seo' ? "journal/list.json" : "knowledge/list.json";
  const list = await safeGetJson(listKey, env);
  let slug = generateSlug(requestedSlug || "untitled");
  let finalSlug = slug;
  let counter = 1;
  while (list.some(item => (item.slug === finalSlug || item.url?.includes(`/${finalSlug}.html`)))) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }
  return finalSlug;
}

async function renderTemplate(templateName, data, env) {
  const templateObj = await env.JOURNAL_BUCKET.get(`templates/${templateName}`);
  if (!templateObj) throw new Error(`Template ${templateName} not found`);
  let html = await templateObj.text();
  
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}|{{${key.toUpperCase()}}}`, 'g');
    html = html.replace(regex, value || "");
  }
  return html;
}

async function generateContentHandler(request, env) {
  const url = new URL(request.url);
  const payload = await request.json();
  // If type is not in body, infer from URL
  let type = payload.type;
  if (!type) {
    if (url.pathname.includes('aeo') || url.pathname.includes('knowledge')) type = 'aeo';
    else type = 'seo';
  }
  
  const { isFinal, keyword } = payload;
  const isSEO = type === 'seo';

  if (isFinal) {
    try {
      // 대량 발행 또는 직접 발행 시, 본문이 없으면 생성 로직 수행
      let draft = payload;
      if (!payload.finalHtml && keyword) {
          draft = await performAiGeneration(payload, env);
      }

      const finalSlug = await resolveUniqueSlug(type, draft.slug, env);
      const publishDate = payload.publishDate || new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
      const targetKey = isSEO ? `journal/${finalSlug}.html` : `knowledge/${finalSlug}.html`;
      
      const templateData = {
        title: draft.title,
        description: draft.summary || "",
        desc: draft.summary || "",
        summary: draft.summary || "",
        category: payload.category || classifyCategory(keyword),
        publish_date: publishDate,
        date: publishDate,
        rich_content: draft.html || draft.finalHtml,
        content: draft.html || draft.finalHtml,
        faq_content: (draft.faqs || []).map(f => `
          <div class="faq-item bg-white p-8 rounded-2xl border border-slate-100 shadow-sm mb-6">
            <h4 class="text-lg font-bold text-slate-900 mb-3 flex items-start gap-3"><span class="text-moon-600">Q.</span> ${f.q}</h4>
            <p class="text-slate-600 leading-relaxed pl-8">${f.a}</p>
          </div>`).join(''),
        faq_section: (draft.faqs && draft.faqs.length) ? `
          <section class="mt-24 p-8 lg:p-16 bg-slate-50 rounded-[3rem] border border-slate-100">
            <h3 class="text-3xl font-serif font-black mb-10 text-slate-900">도움이 되는 질문 (FAQ)</h3>
            <div class="space-y-4">
              ${draft.faqs.map(f => `
                <div class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h4 class="text-lg font-bold text-slate-900 mb-3 flex gap-3 text-moon-600">Q. <span class="text-slate-900">${f.q}</span></h4>
                  <p class="text-slate-600 leading-relaxed pl-8">${f.a}</p>
                </div>`).join('')}
            </div>
          </section>` : "",
        og_image: draft.image || "",
        slug: finalSlug,
        json_ld: JSON.stringify(draft.schema || {}),
        source_name: draft.sourceName || "",
        source_url: draft.sourceUrl || "",
        source_section: (draft.sourceName && draft.sourceUrl) ? `
          <div class="mt-16 p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
            <span class="material-symbols-outlined text-moon-600">verified_user</span>
            <div class="text-sm">
              <span class="text-slate-400 block mb-1">본 콘텐츠는 아래의 정보를 바탕으로 작성되었습니다.</span>
              <a href="${draft.sourceUrl}" target="_blank" rel="noopener" class="font-bold text-slate-900 hover:text-moon-600">${draft.sourceName}</a>
            </div>
          </div>` : "",
        youtube_section: draft.youtubeId ? `
          <div class="mt-16">
            <h3 class="text-2xl font-serif font-black mb-6 flex items-center gap-3 text-slate-900">
              <span class="material-symbols-outlined text-red-500">play_circle</span> 관련 영상
            </h3>
            <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:1.5rem;">
              <iframe src="https://www.youtube.com/embed/${draft.youtubeId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe>
            </div>
          </div>` : ""
      };

      const finalOutput = await renderTemplate(isSEO ? "journal_template.html" : "post_template.html", templateData, env);
      await env.JOURNAL_BUCKET.put(targetKey, finalOutput, { httpMetadata: { contentType: "text/html" } });

      const listKey = isSEO ? "journal/list.json" : "knowledge/list.json";
      await atomicUpdateList(listKey, env, (list) => {
        list.push({ title: draft.title, desc: draft.summary, url: `/${targetKey}`, date: publishDate, category: templateData.category, image: draft.image, slug: finalSlug });
        return list;
      });

      return new Response(JSON.stringify({ success: true, path: `/${targetKey}` }), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }

  // --- DRAFT GENERATION MODE (Streaming Response) ---
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  
  (async () => {
    try {
      const draft = await performAiGeneration(payload, env, async (msg) => {
        await writer.write(encoder.encode(`LOG:${msg}\n`));
      });
      await writer.write(encoder.encode(JSON.stringify({ success: true, draft })));
    } catch (e) {
      await writer.write(encoder.encode(JSON.stringify({ success: false, error: e.message })));
    } finally { await writer.close(); }
  })();

  return new Response(readable, { headers: { "Content-Type": "application/json" } });
}


