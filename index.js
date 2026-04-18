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
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    const start = Math.min(raw.indexOf('{') === -1 ? Infinity : raw.indexOf('{'), raw.indexOf('[') === -1 ? Infinity : raw.indexOf('['));
    const end = Math.max(raw.lastIndexOf('}') === -1 ? -1 : raw.lastIndexOf('}'), raw.lastIndexOf(']') === -1 ? -1 : raw.lastIndexOf(']'));
    if (start !== Infinity && end !== -1 && start < end) {
      try { return JSON.parse(raw.substring(start, end + 1)); } catch(err) { return {}; }
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
    const aiResponse = await aiCall(`Recommendation task: Find one real, authoritative YouTube video ID (11 chars) for the topic "${keyword}". Return ONLY the 11-char ID.`, env);
    const cleaned = aiResponse.trim().match(/[a-zA-Z0-9_-]{11}/);
    return cleaned ? cleaned[0] : "dQw4w9WgXcQ";
  } catch (e) {
    return "dQw4w9WgXcQ";
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
        temperature: 0.9
      });
      return response.response || response.choices?.[0]?.message?.content || "";
    } catch (e) { console.error("Workers AI error:", e.message); }
  }

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      temperature: 0.7
    })
  });
  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`);
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
        let prompt = "";
        switch(type) {
          case "title": prompt = `Keyword: ${keyword}. Suggest one powerful SEO title in Korean.`; break;
          case "slug": prompt = `Keyword: ${keyword}. Convert to short URL slug (English).`; break;
          case "keywords": prompt = `Keyword: ${keyword}. List 10 sub-keywords (comma separated).`; break;
          case "source": prompt = `Keyword: ${keyword}. Suggest one medical source. JSON: {"name": "", "url": ""}.`; break;
          case "question": prompt = `Keyword: ${keyword}. Suggest a natural user question.`; break;
        }
        const result = await aiCall(prompt, env);
        return new Response(JSON.stringify({ result: result.trim() }), { headers: { "Content-Type": "application/json" } });
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
        const { url: postUrl, html } = await request.json();
        const key = postUrl.startsWith('/') ? postUrl.slice(1) : postUrl;
        await env.JOURNAL_BUCKET.put(key, html, { httpMetadata: { contentType: "text/html" } });
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      if (url.pathname === "/admin/api/migrate/clear-all" && request.method === "POST") {
        await env.JOURNAL_BUCKET.put("journal/list.json", "[]");
        await env.JOURNAL_BUCKET.put("knowledge/list.json", "[]");
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
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
      return new Response(e.message, { status: 500 });
    }
  }
};

// --- Core Logic ---

async function resolveUniqueSlug(type, requestedSlug, env) {
  const listKey = type === 'seo' ? "journal/list.json" : "knowledge/list.json";
  const list = await safeGetJson(listKey, env);
  let slug = requestedSlug || "untitled";
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
  const { isFinal, type, keyword, title, slug: requestedSlug, finalHtml, style, category, summary, youtubeId, faqs, schema } = payload;
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
        json_ld: JSON.stringify(schema || {})
      };

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
        englishKeyword = await aiCall(`Translate exactly "${keyword}" into a short, descriptive English phrase for image generation (max 10 words). ONLY return the English text. Focus on objects, fully-clothed people, or cozy settings. Example: "pregnant woman fully clothed in cozy room", "maternity pillow on bed", "stretching exercises". DO NOT use anatomical or skin terms.`, env, "You are a translator.");
        englishKeyword = englishKeyword.trim().replace(/['"]/g, '');
        await log(`🗣️ 이미지 변환: ${englishKeyword}`);
      } catch (e) {}

      let markers = [];
      for(let i=1; i<=imgSeoCount; i++) markers.push(`{{IMG_${i}}}`);
      const markersText = markers.length > 0 ? `Use ${markers.join(', ')} markers in HTML sequentially between paragraphs.` : `Do NOT use any IMG markers.`;
      
      let universalPrompt = `You are a premium Korean content architect. Write a deep article for "${keyword}". Return JSON: {"html": "raw HTML string", "faqs": [Exactly ${faqCount} items with {"q": "...", "a": "..."}], "summary": "3-line summary"}. ${markersText} IMPORTANT: Ensure all anatomical details in images are perfect. Avoid horror or distorted visuals. Style: ${selectedStyle}.`;
      if (!isSEO) {
          universalPrompt = universalPrompt.replace('(첫 번째 문맥 최적 위치에 이미지 마크다운 템플릿 1개 삽입)', '').replace('EXCEPT for the image markdown block', '');
      }

      const [textRes, imgRes] = await Promise.all([
        aiCall(universalPrompt, env).then(r => { log(`✅ 텍스트 생성 전송 완료`); return r; }),
        (async () => {
          if (isSEO) {
            log(`🎨 이미지 ${imgSeoCount + 1}개 병렬 생성 중 (네거티브 프롬프트 적용)...`);
            const promises = [];
            for (let i = 0; i <= imgSeoCount; i++) {
                promises.push(env.AI.run(imgModel, { 
                  prompt: `Photo of ${englishKeyword}, modest, fully clothed, elegant high-end catalog style, premium photography, highly detailed, perfect composition, ${selectedStyle}`,
                  negative_prompt: negPrompt
                }).then(r => { log(`🖼️ 이미지 ${i+1} 완료`); return r; }));
            }
            return Promise.all(promises);
          }
          log(`🎨 대표 이미지 생성 중 (네거티브 프롬프트 적용)...`);
          return [await env.AI.run(imgModel, { 
            prompt: `Illustration of ${englishKeyword}, modest, highly refined, informative infographic style, clean design, premium aesthetic, ${selectedStyle}`,
            negative_prompt: negPrompt
          })];
        })()
      ]);

      const data = parseAIJson(textRes);
      let draftHtml = data.html || "";
      const timeStamp = Date.now();
      const slugBase = generateSlug(title);
      let heroPath = "";
      let gallery = [];

      if (isSEO) {
        // Hero Image
        if (imgRes[0]) {
          const heroKey = `assets/journal/${slugBase}-${timeStamp}-hero.png`;
          await env.JOURNAL_BUCKET.put(heroKey, imgRes[0], { httpMetadata: { contentType: "image/png" } });
          heroPath = `/${heroKey}`;
        }
        // Body Images
        for(let j=1; j<=imgSeoCount; j++) {
          if (imgRes[j]) {
            const bKey = `assets/journal/${slugBase}-${timeStamp}-${j}.png`;
            await env.JOURNAL_BUCKET.put(bKey, imgRes[j], { httpMetadata: { contentType: "image/png" } });
            const imgTag = `<img src="/${bKey}" style="width:100%; border-radius:1rem; margin:2rem 0;" alt="${keyword} ${j}">`;
            gallery.push(`/${bKey}`);
            if (draftHtml.includes(`{{IMG_${j}}}`)) {
              draftHtml = draftHtml.replace(`{{IMG_${j}}}`, imgTag);
            } else {
              draftHtml += `\n\n${imgTag}`;
            }
          }
        }
      } else {
        const aeoKey = `assets/knowledge/${slugBase}-${timeStamp}.png`;
        if (imgRes[0]) {
          await env.JOURNAL_BUCKET.put(aeoKey, imgRes[0], { httpMetadata: { contentType: "image/png" } });
          heroPath = `/${aeoKey}`;
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
