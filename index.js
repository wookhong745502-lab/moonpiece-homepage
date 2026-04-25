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
    .replace(/[^\w\-가-힣]+/g, '')
    .replace(/\-\-+/g, '-')
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
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
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
        const fallbackRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
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

      // Admin APIs
      if (url.pathname === '/admin/api/auth/verify' && request.method === 'POST') {
        const body = await request.json();
        if (body.bypass || body.token) {
           return new Response(JSON.stringify({ success: true }), {
             headers: { "Content-Type": "application/json", "Set-Cookie": "admin_session=wookhong_verified; Path=/; HttpOnly; Secure; SameSite=Lax" }
           });
        }
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

      if (url.pathname === "/admin/api/generate-journal" || url.pathname === "/admin/api/generate-knowledge") {
        return await generateContentHandler(request, env);
      }

      if (url.pathname === "/admin/api/cleanup-lists") {
        const keys = ["journal/list.json", "knowledge/list.json"];
        const results = {};
        for (const key of keys) {
          let list = await safeGetJson(key, env);
          const originalLen = list.length;
          // Filter: remove items with "Test", "Dummy", "가나다", or very short descriptions
          list = list.filter(item => {
            const t = (item.title || "").toLowerCase();
            const d = (item.desc || "").toLowerCase();
            const isDummy = t.includes("test") || t.includes("dummy") || t.includes("더미") || t.includes("테스트") || t.includes("asdf") || d.length < 10;
            return !isDummy;
          });
          if (list.length !== originalLen) {
            await env.JOURNAL_BUCKET.put(key, JSON.stringify(list));
          }
          results[key] = { original: originalLen, cleaned: list.length };
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
        let list = await safeGetJson(listKey, env);
        list = list.filter(p => p.url !== postUrl);
        await env.JOURNAL_BUCKET.put(listKey, JSON.stringify(list));
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      if (url.pathname === "/admin/api/posts/raw" && request.method === "POST") {
        const { url: postUrl } = await request.json();
        const key = postUrl.startsWith('/') ? postUrl.slice(1) : postUrl;
        const obj = await env.JOURNAL_BUCKET.get(key);
        if (obj) {
          return new Response(JSON.stringify({ success: true, html: await obj.text() }), { headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { headers: { "Content-Type": "application/json" } });
      }

      if (url.pathname === "/admin/api/posts/update" && request.method === "POST") {
        const { url: postUrl, html, title, desc, image, type } = await request.json();
        const key = postUrl.startsWith('/') ? postUrl.slice(1) : postUrl;
        await env.JOURNAL_BUCKET.put(key, html, { httpMetadata: { contentType: "text/html" } });
        
        // Update list.json if type is provided
        if (type) {
            const listKey = type === 'knowledge' ? "knowledge/list.json" : "journal/list.json";
            let list = await safeGetJson(listKey, env);
            let updated = false;
            list = list.map(p => {
                if (p.url === postUrl || p.url === '/' + key || '/' + p.url === postUrl || '/' + p.url === '/' + key) {
                    updated = true;
                    if (title) p.title = title;
                    if (desc) p.desc = desc;
                    if (image) p.image = image;
                }
                return p;
            });
            if (updated) {
                await env.JOURNAL_BUCKET.put(listKey, JSON.stringify(list));
            }
        }
        
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      if (url.pathname === "/admin/api/migrate/clear-all" && request.method === "POST") {
        await env.JOURNAL_BUCKET.put("journal/list.json", "[]");
        await env.JOURNAL_BUCKET.put("knowledge/list.json", "[]");
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      if (url.pathname === "/admin/api/regenerate-image" && request.method === "POST") {
        try {
          const { alt, type } = await request.json();
          if (!alt) throw new Error("ALT (Prompt) text is required");
          
          const settingsObj = await env.JOURNAL_BUCKET.get("config/settings.json");
          const settings = settingsObj ? JSON.parse(await settingsObj.text()) : {};
          const isSEO = type !== 'aeo';
          const imgModel = (isSEO ? settings.imgSeo : settings.imgAeo) || "@cf/bytedance/stable-diffusion-xl-lightning";
          const defaultNeg = "bare skin, nude, naked, swimsuit, cleavage, exposed body, bare feet, toes, nsfw, ugly, deformed, disfigured eyes, bad hands, distorted face, blurry, low quality, watermark, text, error, horror, creepy, unnatural skin, bad anatomy, extra fingers, missing fingers, fused fingers, too many fingers, three fingers, six fingers, seven fingers, mutated hands, malformed hands, poorly drawn hands, long fingers, broken fingers, overlapping fingers, cloned fingers, disjointed fingers, floating limbs, disconnected limbs, gross proportions, malformed limbs";
          const negPrompt = settings.negPrompt || defaultNeg;

          // AI Image Generation Call
          const imgRes = await env.AI.run(imgModel, {
            prompt: `High quality, ${alt}`,
            negative_prompt: negPrompt
          });

          // Upload to R2 Bucket
          const timeStamp = Date.now();
          const assetDir = isSEO ? "journal" : "knowledge";
          const newKey = `assets/${assetDir}/regen-${timeStamp}.png`;
          await env.JOURNAL_BUCKET.put(newKey, imgRes, { httpMetadata: { contentType: "image/png" } });

          return new Response(JSON.stringify({ success: true, url: `/${newKey}` }), { headers: { "Content-Type": "application/json" } });
        } catch(e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { "Content-Type": "application/json" } });
        }
      }

      if (url.pathname.startsWith("/journal/") || url.pathname.startsWith("/knowledge/") || url.pathname.startsWith("/assets/")) {
        const key = decodeURIComponent(url.pathname.slice(1));
        const obj = await env.JOURNAL_BUCKET.get(key);
        if (obj) {
          const h = new Headers();
          obj.writeHttpMetadata(h);
          h.set("Access-Control-Allow-Origin", "*");
          return new Response(obj.body, { headers: h });
        }
      }

      return await getAssetFromKV({ request, waitUntil: ctx.waitUntil.bind(ctx) }, { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: assetManifest });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }
};

// --- Core Logic ---

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
  const payload = await request.json();
  const { isFinal, type, keyword, title, slug: requestedSlug, finalHtml, style, category, summary, youtubeId, faqs, schema, sourceName, sourceUrl } = payload;
  const isSEO = type === 'seo';

  // --- FINAL PUBLISH MODE (Direct JSON Response) ---
  if (isFinal) {
    try {
      const finalSlug = await resolveUniqueSlug(type, requestedSlug || generateSlug(title), env);
      const publishDate = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
      const targetKey = isSEO ? `journal/${finalSlug}.html` : `knowledge/${finalSlug}.html`;
      
      const templateData = {
        title,
        description: summary || "",
        desc: summary || "",
        summary: summary || "",
        category: category || classifyCategory(keyword),
        publish_date: publishDate,
        date: publishDate,
        rich_content: finalHtml,
        content: finalHtml,
        faq_content: (faqs || []).map(f => `
          <div class="faq-item bg-white p-8 rounded-2xl border border-slate-100 shadow-sm mb-6">
            <h4 class="text-lg font-bold text-slate-900 mb-3 flex items-start gap-3">
              <span class="text-moon-600">Q.</span> ${f.q}
            </h4>
            <p class="text-slate-600 leading-relaxed pl-8">
              ${f.a}
            </p>
          </div>`).join(''),
        faq_section: (faqs && faqs.length) ? `
          <section class="mt-24 p-8 lg:p-16 bg-slate-50 rounded-[3rem] border border-slate-100">
            <h3 class="text-3xl font-serif font-black mb-10 text-slate-900">도움이 되는 질문 (FAQ)</h3>
            <div class="space-y-4">
              ${faqs.map(f => `
                <div class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h4 class="text-lg font-bold text-slate-900 mb-3 flex gap-3 text-moon-600">Q. <span class="text-slate-900">${f.q}</span></h4>
                  <p class="text-slate-600 leading-relaxed pl-8">${f.a}</p>
                </div>`).join('')}
            </div>
          </section>` : "",
        og_image: payload.image || "",
        slug: finalSlug,
        json_ld: JSON.stringify(schema || {}),
        source_name: sourceName || "",
        source_url: sourceUrl || "",
        source_section: (sourceName && sourceUrl) ? `
          <div class="mt-16 p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
            <span class="material-symbols-outlined text-moon-600">verified_user</span>
            <div class="text-sm">
              <span class="text-slate-400 block mb-1">본 콘텐츠는 아래의 공신력 있는 정보를 바탕으로 작성되었습니다.</span>
              <a href="${sourceUrl}" target="_blank" rel="noopener" class="font-bold text-slate-900 hover:text-moon-600 transition-colors">${sourceName}</a>
            </div>
          </div>` : "",
        youtube_section: youtubeId ? `
          <div class="mt-16">
            <h3 class="text-2xl font-serif font-black mb-6 flex items-center gap-3 text-slate-900">
              <span class="material-symbols-outlined text-red-500">play_circle</span> 관련 영상으로 더 알아보기
            </h3>
            <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:1.5rem;box-shadow:0 25px 50px -12px rgba(0,0,0,0.15);">
              <iframe src="https://www.youtube.com/embed/${youtubeId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
          </div>` : ""
      };

      console.log(`[Publish] sourceName="${sourceName}" sourceUrl="${sourceUrl}"`);
      const finalOutput = await renderTemplate(isSEO ? "journal_template.html" : "post_template.html", templateData, env);
      await env.JOURNAL_BUCKET.put(targetKey, finalOutput, { httpMetadata: { contentType: "text/html" } });

      const listKey = isSEO ? "journal/list.json" : "knowledge/list.json";
      let list = await safeGetJson(listKey, env);
      list.push({
        title,
        desc: summary || "",
        url: `/${targetKey}`,
        date: publishDate,
        category: templateData.category,
        image: payload.image,
        slug: finalSlug
      });
      await env.JOURNAL_BUCKET.put(listKey, JSON.stringify(list));

      return new Response(JSON.stringify({ success: true, path: `/${targetKey}` }), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }

  // --- DRAFT GENERATION MODE (Streaming Response) ---
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const log = async (msg) => { await writer.write(encoder.encode(`LOG:${msg}\n`)); };

  (async () => {
    try {
      const settingsObj = await env.JOURNAL_BUCKET.get("config/settings.json");
      const settings = settingsObj ? JSON.parse(await settingsObj.text()) : {};
      const imgModel = (isSEO ? settings.imgSeo : settings.imgAeo) || "@cf/bytedance/stable-diffusion-xl-lightning";
      const selectedStyle = style || settings.defaultStyle || "Professional photography";
      const defaultNeg = "bare skin, nude, naked, swimsuit, cleavage, exposed body, bare feet, toes, nsfw, ugly, deformed, disfigured eyes, bad hands, distorted face, blurry, low quality, watermark, text, error, horror, creepy, unnatural skin, bad anatomy, extra fingers, missing fingers, fused fingers, too many fingers, three fingers, six fingers, seven fingers, mutated hands, malformed hands, poorly drawn hands, long fingers, broken fingers, overlapping fingers, cloned fingers, disjointed fingers, floating limbs, disconnected limbs, gross proportions, malformed limbs";
      const negPrompt = settings.negPrompt || defaultNeg;
      const imgSeoCount = settings.imgCount !== undefined ? parseInt(settings.imgCount) : 3;
      const faqCount = settings.faqCount !== undefined ? parseInt(settings.faqCount) : 3;

      await log(`🚀 AI 프로세 가동: ${keyword}`);

      let englishKeyword = keyword;
      try {
        englishKeyword = await aiCall(`Translate exactly "${keyword}" into a short, descriptive English phrase for image generation. IMPORTANT: If the keyword refers to a person, ALWAYS include "Korean person" or "Korean woman". Example: "Korean pregnant woman fully clothed in cozy room". ONLY return the English text.`, env, "You are a translator.");
        englishKeyword = englishKeyword.trim().replace(/['"]/g, '');
        await log(`🗣️ 이미지 변환: ${englishKeyword}`);
      } catch (e) {}

      // 출처가 없을 경우 AI가 자동으로 신뢰도 높은 출처 생성
      let finalSourceName = payload.sourceName || "";
      let finalSourceUrl = payload.sourceUrl || "";
      if (!finalSourceName || !finalSourceUrl) {
        try {
          await log(`🔍 신뢰도 출처 자동 검색 중...`);
          const sourceRaw = await aiCall(
            `Keyword: ${keyword}. Translate this keyword into English and Japanese to find a world-class prestigious medical/academic source (e.g., Mayo Clinic, Harvard Medical, NIH, WHO, University of Tokyo Hospital, Lancet). Suggest one global authority. Return ONLY a JSON object: {"name": "Institution Name (Translated to Korean)", "url": "https://..."}.`,
            env
          );
          const cleanedSrc = sourceRaw.replace(/\`\`\`json|\`\`\`/g, '').trim();
          const srcObj = JSON.parse(cleanedSrc);
          if (srcObj.name && srcObj.url) {
            finalSourceName = srcObj.name;
            finalSourceUrl = srcObj.url;
            await log(`✅ 출처 자동 생성: ${finalSourceName}`);
          }
        } catch (e) {
          await log(`⚠️ 출처 자동 검색 실패: ${e.message}`);
        }
      }

      const actualImgCount = isSEO ? imgSeoCount : 1; // AEO는 총 2장(0:대표, 1:본문)

      let markers = [];
      for(let i=1; i<=actualImgCount; i++) markers.push(`{{IMG_${i}}}`);
      const markersText = markers.length > 0 ? `Use ${markers.join(', ')} markers in HTML sequentially between paragraphs.` : `Do NOT use any IMG markers.`;

      let basePrompt = isSEO ? settings.seoPrompt : settings.aeoPrompt;
      if (!basePrompt) {
        basePrompt = isSEO ? 
          `Write a highly professional, empathetic, and strictly formatted SEO blog post about "{{keyword}}". Title: "{{title}}". Target sub-keywords: {{subKeywords}}. \n\nCRITICAL REQUIREMENT: The output MUST exceed 2,000 Korean characters. Explain in profound detail with minimum 5 sections.\nUse exactly <article class="post-content">, <h2>, <h3>, <p>, <ul>, <strong> tags.` :
          `Write an elite-level AEO-optimized expert answer about "{{keyword}}". Title/Question: "{{title}}". \n\nCRITICAL REQUIREMENT: The output MUST exceed 1,500 characters. You MUST include a detailed comparison table or a summary table using HTML <table> tags. Return ONLY raw HTML for the body.`;
      }

      // Fill placeholders in user-defined prompt
      basePrompt = basePrompt
        .replace(/{{keyword}}/g, keyword)
        .replace(/{{title}}/g, title)
        .replace(/{{subKeywords}}/g, payload.subKeywords || "");

      const universalPrompt = `${basePrompt}

CRITICAL: Your entire response must be a single, valid JSON object. 
The JSON must have this exact structure:
{
  "html": "The full article body content in HTML format. ${markersText}",
  "faqs": [{"q": "Question text", "a": "Answer text"}],
  "summary": "3-line summary of the content"
}

Rules for JSON:
1. The "faqs" array must contain exactly ${faqCount} items.
2. The "html" field must contain ONLY the HTML tags and text, properly escaped for a JSON string.
3. DO NOT use markdown code blocks (like \`\`\`json) in your response if possible, just return the raw JSON.
4. DO NOT add any conversational text before or after the JSON.`;

      await log(`🚀 텍스트 및 이미지 ${actualImgCount + 1}개 병렬 생성 중...`);
      const [textRes, imgRes] = await Promise.all([
        aiCall(universalPrompt, env, "You are a specialized content JSON generator.").then(r => { log(`✅ 텍스트 생성 전송 완료`); return r; }),
        (async () => {
          const imgPromises = [];
          for (let i = 0; i <= actualImgCount; i++) {
            const prompt = isSEO 
              ? `Photo of Korean ${englishKeyword}, modest, fully clothed, elegant high-end style, premium photography, highly detailed, ${selectedStyle}`
              : `Clean informative infographic of Korean ${englishKeyword}, white background, premium minimalist design, vector style, highly readable, informative charts, ${selectedStyle}. IMPORTANT: Any text inside the infographic must ONLY use Korean, English, or Numbers.`;
            
            imgPromises.push(env.AI.run(imgModel, { 
              prompt,
              negative_prompt: negPrompt
            }).then(r => { log(`🖼️ 이미지 ${i+1} 완료`); return r; }));
          }
          return Promise.all(imgPromises);
        })()
      ]);

      const data = parseAIJson(textRes);
      let draftHtml = data.html || "";
      const timeStamp = Date.now();
      const slugBase = generateSlug(title);
      let heroPath = "";
      const assetDir = isSEO ? "journal" : "knowledge";

      // Hero Image (imgRes[0])
      if (imgRes[0]) {
        const heroKey = `assets/${assetDir}/${slugBase}-${timeStamp}-hero.png`;
        await env.JOURNAL_BUCKET.put(heroKey, imgRes[0], { httpMetadata: { contentType: "image/png" } });
        heroPath = `/${heroKey}`;
      }

      // Body Images (imgRes[1] ~ imgRes[actualImgCount])
      for(let j=1; j<=actualImgCount; j++) {
        if (imgRes[j]) {
          const bKey = `assets/${assetDir}/${slugBase}-${timeStamp}-${j}.png`;
          await env.JOURNAL_BUCKET.put(bKey, imgRes[j], { httpMetadata: { contentType: "image/png" } });
          const imgTag = `<img src="/${bKey}" style="width:100%; border-radius:1rem; margin:2rem 0;" alt="${keyword} ${j}">`;
          if (draftHtml.includes(`{{IMG_${j}}}`)) {
            draftHtml = draftHtml.replace(`{{IMG_${j}}}`, imgTag);
          } else {
            draftHtml += `\n\n${imgTag}`;
          }
        }
      }

      const recYoutubeId = await getAiRecommendedYoutubeId(keyword, env);
      const draft = { 
        title, 
        html: draftHtml, 
        faqs: data.faqs || [], 
        summary: data.summary || "",
        image: heroPath, 
        youtubeId: recYoutubeId, 
        type,
        slug: requestedSlug || slugBase,
        sourceName: finalSourceName,
        sourceUrl: finalSourceUrl,
        schema: { "@context": "https://schema.org", "@type": "Article", "headline": title, "image": heroPath, "author": { "@type": "Organization", "name": "Moonpiece" } }
      };
      
      await log(`✨ 모든 작업 완료!`);
      await writer.write(encoder.encode(JSON.stringify({ success: true, draft })));
    } catch (e) {
      await writer.write(encoder.encode(JSON.stringify({ success: false, error: e.message })));
    } finally { await writer.close(); }
  })();

  return new Response(readable, { headers: { "Content-Type": "application/json" } });
}

async function autoPublishHandler(request, env) {
  return new Response(JSON.stringify({ success: true, message: "Auto-publish placeholder" }));
}
