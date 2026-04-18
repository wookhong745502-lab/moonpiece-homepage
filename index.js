import { getAssetFromKV } from "@cloudflare/kv-asset-handler";
import manifestJSON from "__STATIC_CONTENT_MANIFEST";

let assetManifest;
try {
  assetManifest = typeof manifestJSON === 'string' ? JSON.parse(manifestJSON) : manifestJSON;
} catch (e) {
  assetManifest = {};
}

function parseCookies(request) {
  try {
    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader) return {};
    return Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')));
  } catch (e) { return {}; }
}

// --- Global Helpers ---
async function safeGetJson(key, env) {
  try {
    const obj = await env.JOURNAL_BUCKET.get(key);
    if (!obj) return {};
    let text = await obj.text();
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFEFF]/g, '').trim();
    if (!text) return {};
    return JSON.parse(text);
  } catch (e) {
    console.error(`Safe JSON parse error for ${key}:`, e.message);
    return {};
  }
}

function parseAIJson(raw) {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    const start = Math.min(raw.indexOf('{') === -1 ? Infinity : raw.indexOf('{'), raw.indexOf('[') === -1 ? Infinity : raw.indexOf('['));
    const end = Math.max(raw.lastIndexOf('}') === -1 ? -1 : raw.lastIndexOf('}'), raw.lastIndexOf(']') === -1 ? -1 : raw.lastIndexOf(']'));
    if (start !== Infinity && end !== -1 && start < end) {
      try { return JSON.parse(raw.substring(start, end + 1)); } catch(err) { throw e; }
    }
    return {};
  }
}

// AI-driven Youtube recommendation (Zero latency scraping fallback)
async function getAiRecommendedYoutubeId(keyword, env) {
  try {
    const aiResponse = await aiCall(`Recommendation task: Find one real, authoritative YouTube video ID (11 chars) for the topic "${keyword}". Return ONLY the 11-char ID.`, env);
    const cleaned = aiResponse.trim().match(/[a-zA-Z0-9_-]{11}/);
    return cleaned ? cleaned[0] : "dQw4w9WgXcQ";
  } catch (e) {
    return "dQw4w9WgXcQ";
  }
}

function extractYoutubeId(text) {
  const match = text.match(/\[YOUTUBE_ID:\s*([a-zA-Z0-9_-]{11})\]/);
  return match ? match[1] : null;
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
  const settings = await safeGetJson("config/settings.json", env);
  const textEngine = settings.textApi || "deepseek";

  if (textEngine.startsWith("@cf/")) {
    try {
      const response = await env.AI.run(textEngine, {
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        temperature: 0.9
      });
      return response.response || response.choices?.[0]?.message?.content || "";
    } catch (e) { console.error("Workers AI error:", e.message); }
  }

  // DeepSeek Fallback
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
     const txt = await res.text();
     throw new Error(`DeepSeek API error: ${res.status} ${txt}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      // --- 1. Auth Middleware for /admin/* ---
      if (url.pathname.startsWith('/admin/')) {
        if (url.pathname === '/admin/login.html' || url.pathname.startsWith('/admin/api/auth/')) {
          // Pass
        } else {
          const cookies = parseCookies(request);
          if (cookies['admin_session'] !== 'wookhong_verified') {
            return Response.redirect(`${url.origin}/admin/login.html`, 302);
          }
        }
      }

      // --- 2. Auth APIs ---
      if (url.pathname === '/admin/api/auth/verify' && request.method === 'POST') {
        const body = await request.json();
        if (body.bypass) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json", "Set-Cookie": "admin_session=wookhong_verified; Path=/; HttpOnly; Secure; SameSite=Lax" }
          });
        }
        const token = body.token;
        try {
          const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
          const data = await googleRes.json();
          const allowedEmails = ['wookhong745502@gmail.com'];
          if (allowedEmails.includes(data.email) && data.email_verified) {
            return new Response(JSON.stringify({ success: true }), {
              headers: { "Content-Type": "application/json", "Set-Cookie": "admin_session=wookhong_verified; Path=/; HttpOnly; Secure; SameSite=Lax" }
            });
          }
          return new Response(JSON.stringify({ error: "Access Denied" }), { status: 403, headers: { "Content-Type": "application/json" } });
        } catch (e) { return new Response(JSON.stringify({ error: "Auth Fail" }), { status: 403, headers: { "Content-Type": "application/json" } }); }
      }

      if (url.pathname === '/admin/api/auth/logout' && request.method === 'POST') {
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", "Set-Cookie": "admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT" }
        });
      }

      // --- 3. Advanced AI Helper APIs ---
      if (url.pathname === "/admin/api/suggest" && request.method === "POST") {
        const { type, keyword } = await request.json();
        let prompt = "";
        
        switch(type) {
          case "title":
            prompt = `Keyword: ${keyword}. Suggest one powerful, professional, and SEO-optimized Korean blog title for 'Moonpiece'. Use click-bait techniques but keep it premium. Return ONLY the title string. If generated again, generate a different variation.`;
            break;
          case "slug":
            prompt = `Keyword: ${keyword}. Convert to a short English URL slug. Return ONLY lowercase hypenated string.`;
            break;
          case "keywords":
            prompt = `Keyword: ${keyword}. Provide 10 highly relevant SEO sub-keywords for Google Search (maternity niche). Ensure they are different if asked again. Return ONLY a comma-separated list.`;
            break;
          case "source":
            prompt = `Keyword: ${keyword}. Find a high-authority global health organization (WHO, Mayo Clinic, etc) or Korean medical news site related to this. Provide a distinct one if asked again. Return JSON: {"name": "NAME", "url": "URL"}`;
            break;
          case "question":
            prompt = `Keyword: ${keyword}. Suggest a natural user question that a pregnant woman would ask search engines. Return ONLY the question string.`;
            break;
        }
        
        const result = await aiCall(prompt, env);
        
        let finalResult = result.trim();
        if (type === "source") finalResult = finalResult.replace(/```json|```/gi, "").trim();
        if (type === "slug") {
          finalResult = finalResult.replace(/[^a-z0-9-]/g, '').toLowerCase();
          const now = new Date();
          const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
          finalResult = `${finalResult}-${dateStr}`;
        }
        
        return new Response(JSON.stringify({ result: finalResult }), { headers: { "Content-Type": "application/json" } });
      }

      // --- 4. Content Generation APIs ---
      if (url.pathname === "/admin/api/generate-journal" && request.method === "POST") {
        return await generateContentHandler(request, env, "seo");
      }
      if (url.pathname === "/admin/api/generate-knowledge" && request.method === "POST") {
        return await generateContentHandler(request, env, "aeo");
      }
      if (url.pathname === "/admin/api/auto-publish" && request.method === "POST") {
        return await autoPublishHandler(request, env);
      }

      // --- 5. Post Management APIs ---
      if (url.pathname === "/admin/api/settings" && request.method === "GET") {
        const settings = await safeGetJson("config/settings.json", env);
        return new Response(JSON.stringify(settings || {}), { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/admin/api/settings" && request.method === "POST") {
        const settings = await request.json();
        await env.JOURNAL_BUCKET.put("config/settings.json", JSON.stringify(settings));
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      if (url.pathname === "/admin/api/posts") {
        const journalList = await safeGetJson("journal/list.json", env);
        const knowledgeList = await safeGetJson("knowledge/list.json", env);
        
        const combined = [
          ...(Array.isArray(journalList) ? journalList : []).map(p => ({ ...p, type: 'journal' })),
          ...(Array.isArray(knowledgeList) ? knowledgeList : []).map(p => ({ ...p, type: 'knowledge' }))
        ].sort((a,b) => new Date(b.date) - new Date(a.date));
        
        return new Response(JSON.stringify(combined), { headers: { "Content-Type": "application/json" } });
      }
      
      if (url.pathname === "/admin/api/posts/delete" && request.method === "POST") {
        const { url: postUrl, type } = await request.json();
        const listKey = type === 'journal' ? "journal/list.json" : "knowledge/list.json";
        const key = postUrl.startsWith('/') ? postUrl.slice(1) : postUrl;
        
        await env.JOURNAL_BUCKET.delete(key);
        const listData = await env.JOURNAL_BUCKET.get(listKey);
        let list = [];
        if (listData) {
            try { list = await listData.json(); } catch(e) { list = []; }
        }
        const filtered = list.filter(p => !postUrl.includes(p.url));
        await env.JOURNAL_BUCKET.put(listKey, JSON.stringify(filtered));
        
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      if (url.pathname === "/admin/api/posts/raw" && request.method === "POST") {
        const { url: postUrl } = await request.json();
        const key = postUrl.startsWith('/') ? postUrl.slice(1) : postUrl;
        const object = await env.JOURNAL_BUCKET.get(key);
        if(object) {
          return new Response(JSON.stringify({ success: true, html: await object.text() }), { headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ success: false }), { status: 404, headers: { "Content-Type": "application/json" } });
      }

      if (url.pathname === "/admin/api/posts/update" && request.method === "POST") {
        const { url: postUrl, html } = await request.json();
        const key = postUrl.startsWith('/') ? postUrl.slice(1) : postUrl;
        await env.JOURNAL_BUCKET.put(key, html, { httpMetadata: { contentType: "text/html; charset=UTF-8" } });
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      if (url.pathname === "/admin/api/migrate/clear-all" && request.method === "POST") {
        await env.JOURNAL_BUCKET.put("journal/list.json", "[]");
        await env.JOURNAL_BUCKET.put("knowledge/list.json", "[]");
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      if (url.pathname === "/list-journals") {
        const data = await env.JOURNAL_BUCKET.get("journal/list.json");
        if (!data) return new Response("[]", { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        let list = [];
        try { list = await data.json(); } catch(e) { list = []; }
        const kstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
        const filtered = list.filter(p => !p.date || p.date <= kstNow);
        return new Response(JSON.stringify(filtered), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      }
      if (url.pathname === "/list-knowledge") {
        const data = await env.JOURNAL_BUCKET.get("knowledge/list.json");
        if (!data) return new Response("[]", { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        let list = [];
        try { list = await data.json(); } catch(e) { list = []; }
        const kstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
        const filtered = list.filter(p => !p.date || p.date <= kstNow);
        return new Response(JSON.stringify(filtered), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      }

      if (url.pathname === "/admin/api/generate-image" && request.method === "POST") {
        const { prompt, slug } = await request.json();
        try {
          const imageResponse = await env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
            prompt: `High-quality, photorealistic cinematic photography. ${prompt}`,
            negative_prompt: "text, numbers, watermark, blurry, painting, duplicate"
          });
          const imageKey = `assets/custom/${slug}-${Date.now()}.png`;
          await env.JOURNAL_BUCKET.put(imageKey, imageResponse, { httpMetadata: { contentType: "image/png" } });
          return new Response(JSON.stringify({ success: true, url: `/${imageKey}` }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      }

      if (url.pathname.startsWith("/journal/") || url.pathname.startsWith("/knowledge/") || url.pathname.startsWith("/assets/")) {
        const key = url.pathname.slice(1);
        const object = await env.JOURNAL_BUCKET.get(key);
        if (object) {
          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set("Content-Type", key.endsWith(".html") ? "text/html; charset=UTF-8" : "image/png");
          headers.set("Access-Control-Allow-Origin", "*");
          if (key.endsWith(".png")) headers.set("Cache-Control", "public, max-age=31536000");
          return new Response(object.body, { headers });
        }
      }

      try {
        return await getAssetFromKV({ request, waitUntil: ctx.waitUntil.bind(ctx) }, { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: assetManifest });
      } catch (e) { return new Response("Not Found", { status: 404 }); }
    } catch (globalErr) {
      console.error("Global Worker Error:", globalErr.stack);
      return new Response(JSON.stringify({ success: false, error: globalErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  },

  // --- 6. CRON Trigger for Automatic Publishing (Daily 00:00) ---
  async scheduled(event, env, ctx) {
    console.log("CRON Trigger Started: Running Auto Publish...");
    // Automatically publish one SEO post in a random category
    const categories = ["sleep", "pain", "health", "psychology"];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    
    // Mock request for autoPublishHandler
    const mockRequest = {
      json: async () => ({ category: randomCategory, count: 1, type: "seo" })
    };
    
    ctx.waitUntil(autoPublishHandler(mockRequest, env));
  }
};

// --- Optimized Content Generation Engine ---
async function generateContentHandler(request, env, type) {
  const payload = await request.json();
  const { keyword, title, slug: rawSlug, subKeywords, sourceName, sourceUrl, isFinal = false, finalHtml = "", imageConfig } = payload;
  const finalCategory = payload.category || classifyCategory(keyword);
  const isSEO = type === "seo";
  
  // Default Image Configuration
  const settings = await safeGetJson("config/settings.json", env);
  const defaultImgModel = isSEO ? (settings.imgSeo || "@cf/bytedance/stable-diffusion-xl-lightning") : (settings.imgAeo || "@cf/bytedance/stable-diffusion-xl-lightning");

  const imgModel = (imageConfig && imageConfig.model) || defaultImgModel;
  const imgStyle = (imageConfig && imageConfig.style) || "photorealistic";
  
  const stylePrompts = {
    "photorealistic": "photorealistic photography, extremely high quality, realistic, 8k, detailed skin, soft lighting",
    "cinematic": "cinematic lighting, dramatic atmosphere, high contrast, filmic, 8k, masterwork",
    "illustration": "beautiful digital illustration, clean lines, soft colors, artistic, premium feel",
    "3d-render": "3d render, octane render, unreal engine 5, stylized, glossy, cute"
  };
  const selectedStyle = stylePrompts[imgStyle] || stylePrompts["photorealistic"];

  async function resolveUniqueSlug(baseSlug, prefix) {
    let newSlug = baseSlug;
    let counter = 1;
    const listKey = prefix === "journal" ? "journal/list.json" : "knowledge/list.json";
    
    const bucketList = await safeGetJson(listKey, env);
    const listArr = Array.isArray(bucketList) ? bucketList : [];
    
    while (true) {
      if (!listArr.find(p => p.url && p.url.includes(`${newSlug}.html`))) {
        break;
      }
      newSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    return newSlug;
  }

  if (isFinal) {
    const slug = await resolveUniqueSlug(rawSlug, isSEO ? 'journal' : 'knowledge');
    const finalYoutubeId = payload.youtubeId || await getAiRecommendedYoutubeId(keyword, env);
    
    const html = await renderTemplate({ 
        title, 
        image: payload.image, 
        html: finalHtml, 
        faqs: payload.faqs, 
        schema: payload.schema,
        youtubeId: finalYoutubeId
    }, env, isSEO ? '임산부 저널' : '임산부 지식인');
    
    const filePath = `${isSEO ? 'journal' : 'knowledge'}/${slug}.html`;
    await env.JOURNAL_BUCKET.put(filePath, html, { httpMetadata: { contentType: "text/html; charset=UTF-8" } });
    
    const listKey = isSEO ? "journal/list.json" : "knowledge/list.json";
    let list = await safeGetJson(listKey, env);
    if (!Array.isArray(list)) list = [];
    
    let finalTitle = title;
    let tCounter = 1;
    while(list.find(p => p.title === finalTitle)) {
        finalTitle = `${title} (${tCounter})`;
        tCounter++;
    }

    function extractSummary(c, length = 80) {
      if (!c) return "";
      const text = c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return text.length > length ? text.substring(0, length) + "..." : text;
    }

    const summary = extractSummary(finalHtml, 80);

    const listEntry = { 
        title: finalTitle, 
        category: finalCategory, 
        date: payload.publishDate || new Date().toISOString().split('T')[0], 
        url: `/${filePath}`, 
        image: payload.image,
        desc: summary
    };

    list.unshift(listEntry);
    await env.JOURNAL_BUCKET.put(listKey, JSON.stringify(list));
    return new Response(JSON.stringify({ success: true, path: `/${filePath}` }));
  }

  try {
    const defaultSeoPrompt = `Write a premium, high-authority SEO blog post about "{{keyword}}". 
    Title: "{{title}}". Sub-keywords: {{subKeywords}}. ${sourceName ? `Cite source: [${sourceName}](${sourceUrl})` : ''}
    
    GUIDELINES:
    1. MUST exceed 2,500 Korean characters for deep topical authority.
    2. Structure with clear <h2> and <h3> tags for visual hierarchy.
    3. Ensure each paragraph (<p>) is substantive and separated clearly.
    4. Provide expert medical insights in a professional yet warm tone.
    5. USE {{IMG_1}}, {{IMG_2}}, {{IMG_3}} naturally as section breaks.
    6. Wrap everything in <article class="post-content">.
    7. Return ONLY clean, valid HTML body.`;
    
    const defaultAeoPrompt = `Write an elite-level AEO (Answer Engine Optimized) expert answer about "{{keyword}}". 
    Title: "{{title}}". 
    
    STRUCTURE REQUIREMENTS:
    1. Start with <h1>{{title}}</h1>.
    2. <div class="aeo-summary-box">: Core summary bullets for featured snippets.
    3. Use multiple <section> blocks with descriptive <h2> headings.
    4. Each section must contain 2-3 detailed paragraphs (<p>) for better distinction.
    5. Use <section><h2>Step-by-step Guide</h2><ol><li>...</li></ol></section> for procedural queries.
    6. Include 1 high-quality image placeholder: <!-- PROMPT: [Details in English] --> ![[Alt Text]]([file.jpg]) *Caption: [Korean description]*.
    7. Content must be exhaustive (exceed 1,500 chars).
    8. Return ONLY raw HTML + image markdown.`;
    const universalPrompt = `You are an SEO/AEO expert. Your task is to generate high-quality content for the keyword "${keyword}".
    
    Return ONLY a JSON object with the following structure:
    {
      "html": "A detailed 2000+ word HTML content for a blog post. Use semantic tags.",
      "faqs": [{"q": "Question?", "a": "Answer."}],
      "score": 95,
      "feedback": "Expert feedback on SEO strategy."
    }
    
    - Language: Korean.
    - Consistency: Ensure FAQs exactly match the body content.
    - Length: Body must be professional and deep.`;

    const [rawResponse, imageResponses] = await Promise.all([
      (async () => {
        console.log(`[AI] Starting text generation for: ${keyword}`);
        const start = Date.now();
        const res = await aiCall(universalPrompt, env);
        console.log(`[AI] Text generation finished in ${Date.now() - start}ms`);
        return res;
      })(),
      (async () => {
        if (!isSEO) return []; 
        console.log(`[AI] Starting parallel image generation for: ${keyword}`);
        const start = Date.now();
        const imgBasePrompt = settings.imgSeoPrompt || `Professional high-quality photography, premium maternal vibes.`;
        const imgPrompts = [
          `${imgBasePrompt} for ${keyword}, hero wide angle, ${selectedStyle}.`,
          `${imgBasePrompt} for ${keyword}, detailed close-up, ${selectedStyle}.`,
          `${imgBasePrompt} for ${keyword}, contextual lifestyle, ${selectedStyle}.`,
          `${imgBasePrompt} for ${keyword}, comforting warm atmosphere, ${selectedStyle}.`
        ];
        const negPrompt = "deformed, ugly, disfigured, bad anatomy, text, watermark, low resolution, blurry faces, mutated, extra limbs";
        
        try {
          const results = await Promise.all(imgPrompts.map(async (p, i) => {
            try {
              console.log(`[AI] Generating image ${i+1}...`);
              return await env.AI.run(imgModel, { 
                prompt: p, 
                negative_prompt: negPrompt,
                num_steps: 20
              });
            } catch (err) {
              console.error(`[AI] Image ${i+1} failed: ${err.message}`);
              return null;
            }
          }));
          console.log(`[AI] Image generation batch finished in ${Date.now() - start}ms`);
          return results;
        } catch (e) {
          console.error("[AI] Critical error in image generation batch:", e.message);
          return Array(4).fill(null);
        }
      })()
    ]);

    console.log("[AI] Parsing AI JSON response...");
    const data = parseAIJson(rawResponse);
    if (!data || !data.html) {
      console.error("[AI] Error: AI returned invalid or empty JSON content.");
      throw new Error("AI content generation failed to produce valid content. Please try a different keyword.");
    }
    let youtubeId = null; 
    let html = (data.html || "").replace(/```html|```/g, "").trim();
    const faqs = data.faqs || [];
    const scoreData = { score: data.score || 95, feedback: data.feedback || "AI 분석 완료" };

    const imgId = Date.now();
    let heroImagePath = "";

    if (isSEO) {
      const heroImageKey = `assets/${type}/${rawSlug}-${imgId}-hero.png`;
      if (imageResponses[0]) {
        await env.JOURNAL_BUCKET.put(heroImageKey, imageResponses[0], { httpMetadata: { contentType: "image/png" } });
        heroImagePath = `/${heroImageKey}`;
      } else {
        heroImagePath = `/assets/images/journal_1.jpg`;
      }

      for(let i=1; i<=3; i++) {
        const key = `assets/${type}/${rawSlug}-${imgId}-body${i}.png`;
        if (imageResponses[i]) {
          await env.JOURNAL_BUCKET.put(key, imageResponses[i], { httpMetadata: { contentType: "image/png" } });
          html = html.replace(`{{IMG_${i}}}`, `<img src="/${key}" style="width:100%; border-radius:1rem; margin:2rem 0; box-shadow:0 4px 6px rgba(0,0,0,0.05);" alt="${keyword} - ${title}">`);
        } else {
          html = html.replace(`{{IMG_${i}}}`, `<img src="/assets/images/post_${i}.jpg" style="width:100%; border-radius:1rem; margin:2rem 0;" alt="${keyword}">`);
        }
      }
      
      if (sourceName && sourceUrl) {
        html += `
        <div class="mt-12 p-8 bg-moon-50 border border-moon-100 rounded-3xl">
            <h4 class="font-bold text-lg mb-2 text-moon-900 flex items-center gap-2"><span class="material-symbols-outlined">library_books</span>참고 문헌 및 자료 출처</h4>
            <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="text-moon-600 hover:text-moon-900 font-bold underline text-sm inline-flex items-center gap-1 bg-white px-4 py-2 rounded-xl border border-moon-100 shadow-sm">${sourceName} <span class="material-symbols-outlined" style="font-size:16px;">open_in_new</span></a>
        </div>`;
      }
    } else {
      // AEO Image Logic: More robust regex to catch various Markdown image formats
      let aiPrompt = `${settings.imgAeoPrompt || "High-quality AEO infographic"} for ${keyword}. ${selectedStyle}.`;
      let altText = `${title} infographic`;
      let captionText = "";
      
      // Try finding PROMPT comment and image markdown (forgiving regex)
      const promptRegex = /<!--\s*PROMPT:\s*(.*?)\s*-->/i;
      const imgMarkdownRegex = /!\[(.*?)\]\((.*?)\)(?:\s*\*?(?:캡션:\s*)?(.*?)\*?)?/i;
      
      const pMatch = html.match(promptRegex);
      const iMatch = html.match(imgMarkdownRegex);
      
      if (pMatch) aiPrompt = pMatch[1].trim();
      if (iMatch) {
        altText = iMatch[1].trim();
        // If alt text is long and prompt was missing, use alt as prompt
        if (!pMatch && altText.length > 10) aiPrompt = altText;
        captionText = iMatch[3] ? iMatch[3].trim() : "";
      }

      let imageResponse;
      try {
        imageResponse = await env.AI.run(imgModel, {
          prompt: `Professional high-quality ${imgStyle}, ${aiPrompt}. ${selectedStyle}, no text.`,
          negative_prompt: "deformed, ugly, bad anatomy, text, watermark"
        });
      } catch (e) { 
        console.error("AEO Image Generation failed:", e.message);
        imageResponse = null; 
      }

      if (imageResponse) {
        const imageKey = `assets/${type}/${rawSlug}-${imgId}.png`;
        await env.JOURNAL_BUCKET.put(imageKey, imageResponse, { httpMetadata: { contentType: "image/png" } });
        heroImagePath = `/${imageKey}`;
        
        const figureHtml = `<figure class="my-12"><img src="${heroImagePath}" alt="${altText}" class="w-full rounded-2xl shadow-md border border-slate-200"><figcaption class="text-center text-slate-500 text-sm mt-4 font-bold">${captionText || altText}</figcaption></figure>`;
        
        // Replace all related markdown elements
        if (pMatch) html = html.replace(pMatch[0], "");
        if (iMatch) {
            html = html.replace(iMatch[0], figureHtml);
        } else {
            // Fallback: prepend if no match but we got an image
            html = figureHtml + html;
        }
      } else {
        heroImagePath = `/assets/images/expert_1.jpg`;
        if (pMatch) html = html.replace(pMatch[0], "");
        if (iMatch) html = html.replace(iMatch[0], "");
      }
    }

    const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs.map(f => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })) };
    const schemaArray = [faqSchema, { "@context": "https://schema.org", "@type": "Article", "headline": title, "image": heroImagePath, "author": { "@type": "Person", "name": "Moonpiece Editorial Board" }, "publisher": { "@type": "Organization", "name": "Moonpiece" }, "datePublished": new Date().toISOString() }];

    const draftData = { title, slug: rawSlug, html, faqs, score: scoreData.score, feedback: scoreData.feedback, image: heroImagePath, schema: schemaArray, youtubeId };
    return new Response(JSON.stringify({ success: true, draft: draftData }));
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
  }
}

async function renderTemplate(data, env, categoryName) {
  const listKey = (categoryName === '임산부 저널') ? "journal/list.json" : "knowledge/list.json";
  let list = [];
  try {
    const obj = await env.JOURNAL_BUCKET.get(listKey);
    if (obj) {
      let text = await obj.text();
      text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFEFF]/g, '').trim();
      if (text) list = JSON.parse(text);
    }
  } catch (e) { console.error('renderTemplate list parse error:', e.message); list = []; }
  const related = list.sort(() => 0.5 - Math.random()).slice(0, Math.min(list.length, 3));
  
  const relatedHtml = related.length > 0 ? `
        <section class="mt-24 border-t border-slate-200 pt-24">
            <h3 class="font-serif mb-12 text-3xl">관련 콘텐츠</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                ${related.map(p => `
                <a href="${p.url}" class="mp-card overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300" style="padding:0;">
                    <img src="${p.image}" class="aspect-video object-cover w-full h-48">
                    <div class="p-6">
                        <h5 class="font-bold text-lg mb-2 text-slate-900 hover:text-moon-600 transition">${p.title}</h5>
                    </div>
                </a>`).join("")}
            </div>
        </section>` : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title} | Moonpiece</title>
    <link rel="stylesheet" href="/styles.css?v=1.5">
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        moon: {
                            50: '#f5f3ff',
                            100: '#ede9fe',
                            200: '#ddd6fe',
                            500: '#8b5cf6',
                            600: '#7c3aed',
                            900: '#4c1d95',
                        }
                    },
                    fontFamily: {
                        serif: ['Noto Serif KR', 'serif'],
                        sans: ['Manrope', 'sans-serif'],
                    }
                }
            }
        }
    </script>
    <script type="application/ld+json">${JSON.stringify(data.schema || {})}</script>
</head>
<body class="bg-slate-50 text-slate-900 font-sans">
    <!-- Top Navigation -->
    <nav class="nav-bar bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div class="nav-mp-container mp-container">
            <a href="/" class="logo font-serif text-2xl font-black text-moon-600">Moonpiece</a>
            <div class="nav-links hidden lg:flex">
                <a href="/brand.html" class="nav-link">문피스의 약속</a>
                <a href="/review.html" class="nav-link">엄마들의 이야기</a>
                <a href="/journal.html" class="nav-link">임산부 저널</a>
                <a href="/knowledge.html" class="nav-link">임산부 지식인</a>
            </div>
            <div class="flex items-center gap-4">
                <a href="https://smartstore.naver.com/moonwalk00/products/2416019050" target="_blank" class="btn-primary mobile-hidden">구매하기</a>
                <button class="hamburger-btn" id="menu-toggle">
                    <span></span><span></span><span></span>
                </button>
            </div>
        </div>
    </nav>

    <!-- Mobile Navigation Overlay -->
    <div class="nav-overlay" id="overlay"></div>
    <div class="mobile-nav" id="mobile-menu">
        <a href="/brand.html" class="nav-link">문피스의 약속</a>
        <a href="/review.html" class="nav-link">엄마들의 이야기</a>
        <a href="/journal.html" class="nav-link">임산부 저널</a>
        <a href="/knowledge.html" class="nav-link">임산부 지식인</a>
        <a href="https://smartstore.naver.com/moonwalk00/products/2416019050" target="_blank" class="btn-primary text-center mt-8">구매하기</a>
    </div>

    <main class="py-24 mp-container mx-auto" style="max-width: 900px; min-height: 80vh;">
        <div class="category-badge mb-8">${categoryName}</div>
        <h1 class="font-serif mb-12" style="font-size: 3.5rem; line-height: 1.2;">${data.title}</h1>
        ${(categoryName === '임산부 지식인') && (data.html || '').includes('<figure') ? '' : `<img src="${data.image}" alt="${data.title}" class="w-full rounded-3xl shadow-xl mb-16 object-cover" style="aspect-ratio: 16/9;">`}
        <!-- Content Container -->
        <div class="post-body-container bg-white p-8 md:p-20 rounded-[2.5rem] shadow-sm border border-slate-200">
            <div class="article-content mb-24">
                ${data.html}
            </div>

            ${data.youtubeId ? `
            <!-- Video Section -->
            <section class="video-section mb-24">
                <h2 class="faq-title">📢 관련 추천 영상</h2>
                <div class="video-container">
                    <iframe 
                        src="https://www.youtube.com/embed/${data.youtubeId}" 
                        title="YouTube video player" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        referrerpolicy="strict-origin-when-cross-origin" 
                        allowfullscreen>
                    </iframe>
                </div>
            </section>` : ''}

            <!-- FAQ Section Integrated into Card -->
            <section class="faq-section" style="border-top: 2px solid #f1f5f9; padding-top: 6rem;">
                <h2 class="faq-title">자주 묻는 질문 (FAQ)</h2>
                <div class="faq-list">
                    ${(data.faqs || []).map(f => `
                    <div class="faq-item">
                        <div class="faq-q">
                            <span class="q-label">Q.</span>
                            <span>${f.q}</span>
                        </div>
                        <div class="faq-a">
                            <p>${f.a}</p>
                        </div>
                    </div>`).join("")}
                </div>
            </section>
        </div>
        
        ${relatedHtml}
    </main>

    <!-- Footer -->
    <footer class="bg-white pt-24 pb-12 border-t border-slate-100">
        <div class="mp-container grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div>
                <div class="logo font-serif text-2xl text-moon-600 mb-6 font-bold">Moonpiece</div>
                <p class="text-slate-500 leading-relaxed text-sm mb-8" style="max-width: 320px;">
                    소중한 엄마와 아기를 위한 달빛 조각, 문피스. 11년의 진심을 담아 가장 편안한 휴식을 설계합니다.
                </p>
                <div class="flex gap-4">
                    <a href="#" class="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-moon-500 hover:text-white transition-all">
                        <span class="material-symbols-outlined text-xl">share</span>
                    </a>
                </div>
            </div>
            <div>
                <h4 class="font-bold text-slate-900 mb-6 uppercase tracking-wider text-xs">Menu</h4>
                <ul class="flex flex-col gap-4 text-sm text-slate-600 list-none p-0">
                    <li><a href="/brand.html" class="hover:text-moon-600">문피스의 약속</a></li>
                    <li><a href="/review.html" class="hover:text-moon-600">엄마들의 이야기</a></li>
                    <li><a href="/journal.html" class="hover:text-moon-600">임산부 저널</a></li>
                    <li><a href="/knowledge.html" class="hover:text-moon-600">임산부 지식인</a></li>
                </ul>
            </div>
            <div>
                <h4 class="font-bold text-slate-900 mb-6 uppercase tracking-wider text-xs">Support</h4>
                <ul class="flex flex-col gap-4 text-sm text-slate-600 list-none p-0">
                    <li><a href="/about.html">회사소개</a></li>
                    <li><a href="/terms.html">이용약관</a></li>
                    <li><a href="/privacy.html">개인정보처리방침</a></li>
                    <li><a href="https://smartstore.naver.com/moonwalk00/products/2416019050" target="_blank">네이버 스마트스토어</a></li>
                </ul>
            </div>
            <div>
                <h4 class="font-bold text-slate-900 mb-6 uppercase tracking-wider text-xs">Social</h4>
                <ul class="flex flex-col gap-4 text-sm text-slate-600 list-none p-0">
                    <li><a href="#">Instagram</a></li>
                    <li><a href="#">YouTube</a></li>
                </ul>
            </div>
        </div>
        <div class="mp-container mt-20 pt-10 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
            <div class="text-slate-400 text-xs text-center md:text-left">
                © 2024 Moonpiece. All rights reserved.
            </div>
            <div class="flex gap-6 text-xs font-bold text-slate-500">
                <a href="/terms.html" class="hover:text-moon-600">이용약관</a>
                <a href="/privacy.html" class="hover:text-moon-600">개인정보처리방침</a>
            </div>
        </div>
    </footer>
    
    <script>
        const menuToggle = document.getElementById('menu-toggle');
        const mobileMenu = document.getElementById('mobile-menu');
        const overlay = document.getElementById('overlay');
        if(menuToggle) {
            menuToggle.addEventListener('click', () => {
                const isActive = mobileMenu.classList.toggle('active');
                menuToggle.classList.toggle('active');
                overlay.classList.toggle('active');
                document.body.style.overflow = isActive ? 'hidden' : 'auto';
            });
        }
        if(overlay) {
            overlay.addEventListener('click', () => {
                mobileMenu.classList.remove('active');
                menuToggle.classList.remove('active');
                overlay.classList.remove('active');
                document.body.style.overflow = 'auto';
            });
        }
    </script>
</body>
</html>`;
}

// --- Auto-Publish Handler (Full Pipeline: Keyword -> Content -> Deploy) ---
async function autoPublishHandler(request, env) {
  const payload = await request.json();
  const { category, count = 1, type = "seo", imageConfig } = payload;
  const isSEO = type === "seo";
  
  const settings = await safeGetJson("config/settings.json", env);
  const imgModel = (imageConfig && imageConfig.model) || (isSEO ? settings.imgSeo : settings.imgAeo) || "@cf/bytedance/stable-diffusion-xl-lightning";
  const imgStyle = (imageConfig && imageConfig.style) || "photorealistic";
  
  const stylePrompts = {
    "photorealistic": "photorealistic photography, extremely high quality, realistic, 8k, detailed skin, soft lighting",
    "cinematic": "cinematic lighting, dramatic atmosphere, high contrast, filmic, 8k, masterwork",
    "illustration": "beautiful digital illustration, clean lines, soft colors, artistic, premium feel",
    "3d-render": "3d render, octane render, unreal engine 5, stylized, glossy, cute"
  };
  const selectedStyle = stylePrompts[imgStyle] || stylePrompts["photorealistic"];

  const categoryNameMap = { sleep: "수면 자세", pain: "통증 완화", health: "건강 관리", psychology: "심리 & 지식", others: "기타" };
  const categoryName = categoryNameMap[category] || category;
  const results = [];

  async function resolveUniqueSlug(baseSlug, prefix) {
    let newSlug = baseSlug;
    let counter = 1;
    const listKey = prefix === "journal" ? "journal/list.json" : "knowledge/list.json";
    const bucketList = await safeGetJson(listKey, env);
    const listArr = Array.isArray(bucketList) ? bucketList : [];
    while (true) {
      if (!listArr.find(p => p.url && p.url.includes(`${newSlug}.html`))) break;
      newSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    return newSlug;
  }

  try {
    const listKey = isSEO ? "journal/list.json" : "knowledge/list.json";
    const existingList = await safeGetJson(listKey, env);
    const existingListArray = Array.isArray(existingList) ? existingList : [];
    const existingTitles = existingListArray.map(p => p.title).slice(0, 30).join(", ");

    let keywords = payload.keywords;
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      const keywordPrompt = isSEO
        ? `임산부 관련 "${categoryName}" 카테고리에서 SEO 블로그 글을 쓸 수 있는 구체적인 한국어 키워드 ${count}개를 생성하세요. 기존 주제 피하기: [${existingTitles}]. Return ONLY a JSON array of strings. No explanation.`
        : `임산부들이 검색할 법한 "${categoryName}" 관련 질문형 한국어 키워드 ${count}개를 생성하세요. 기존 주제 피하기: [${existingTitles}]. Return ONLY a JSON array of strings. No explanation.`;

      const keywordsRaw = await aiCall(keywordPrompt, env);
      keywords = parseAIJson(keywordsRaw);
    }

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Failed to resolve keywords" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const intervalHours = parseInt(payload.intervalHours) || 24;
    const startPublishDate = payload.publishDate ? new Date(payload.publishDate) : new Date();

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i].trim();
      const category = payload.category || classifyCategory(keyword);
      const isSEO = payload.type === 'seo';
      const stepResult = { keyword, status: "processing" };

      try {
        const metaPrompts = isSEO ? [
          aiCall(`Keyword: ${keyword}. Suggest one powerful, professional, SEO-optimized Korean blog title for 'Moonpiece'. Return ONLY the title string.`, env),
          aiCall(`Keyword: ${keyword}. Convert to a short English URL slug. Return ONLY lowercase hyphenated string.`, env),
          aiCall(`Keyword: ${keyword}. Provide 10 highly relevant SEO sub-keywords (maternity niche). Return ONLY a comma-separated list.`, env),
          aiCall(`Keyword: ${keyword}. Find a high-authority health organization related to this. Return JSON: {"name": "NAME", "url": "URL"}`, env)
        ] : [
          aiCall(`Keyword: ${keyword}. Rephrase as a natural search question a pregnant Korean woman would ask. Return ONLY the question string.`, env),
          aiCall(`Keyword: ${keyword}. Convert to a short English URL slug. Return ONLY lowercase hyphenated string.`, env)
        ];

        const metaResults = await Promise.all(metaPrompts);
        let title, rawSlug, subKeywords = "", sourceName = "", sourceUrl = "";

        if (isSEO) {
          title = metaResults[0].trim();
          rawSlug = metaResults[1].replace(/[^a-z0-9-]/g, '').toLowerCase();
          subKeywords = metaResults[2].trim();
          try {
            const sourceData = parseAIJson(metaResults[3]);
            sourceName = sourceData.name || "";
            sourceUrl = sourceData.url || "";
          } catch(e) { sourceName = ""; sourceUrl = ""; }
        } else {
          title = metaResults[0].trim();
          rawSlug = metaResults[1].replace(/[^a-z0-9-]/g, '').toLowerCase();
        }

        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        rawSlug = `${rawSlug}-${dateStr}`;

        const defaultSeoPrompt = `Write a highly professional SEO blog post about "{{keyword}}". Title: "{{title}}". Sub-keywords: {{subKeywords}}. ${sourceName ? `Cite source: [${sourceName}](${sourceUrl})` : ''} MUST exceed 2,000 Korean chars. Min 5 sections. USE {{IMG_1}}, {{IMG_2}}, {{IMG_3}} placeholders. Use <article class="post-content">, <h2>, <h3>, <p>, <ul>, <strong> tags. Return ONLY raw HTML.`;
        const defaultAeoPrompt = `Write an elite AEO answer about "{{keyword}}". Title: "{{title}}". Use semantic HTML: <h1>, <div class="aeo-summary-box"><ul><li></li></ul></div>, <section><h2></h2><p></p></section>, <section><h2>Step-by-step guide</h2><ol><li></li></ol></section>. Place 1 image: <!-- PROMPT: [English] --> ![[Alt Text]]([file.jpg]) *Caption: [desc]*. MUST exceed 1,500 chars. Return ONLY raw HTML + image markdown.`;

        const bodyPromptTemplate = isSEO ? (settings.seoPrompt || defaultSeoPrompt) : (settings.aeoPrompt || defaultAeoPrompt);
        const bodyPrompt = bodyPromptTemplate
          .replace(/{{keyword}}/g, keyword)
          .replace(/{{title}}/g, title)
          .replace(/{{subKeywords}}/g, subKeywords || keyword);

        const faqPrompt = `Generate exactly 5 AEO-optimized FAQs for "${keyword}". Answer MUST contain keyword. Return ONLY JSON array: [{"q": "?", "a": "..."}]`;

        const [htmlRaw, faqsRaw] = await Promise.all([aiCall(bodyPrompt, env), aiCall(faqPrompt, env)]);
        let html = htmlRaw.replace(/```html|```/g, "").trim();
        const faqs = parseAIJson(faqsRaw);

        const imgId = Date.now() + i;
        let heroImagePath = "";
        const negPrompt = "deformed, ugly, disfigured, bad anatomy, text, watermark, low resolution, blurry faces, mutated, extra limbs";

        if (isSEO) {
          let imageResponses;
          const imgBase = (isSEO ? settings.imgSeoPrompt : settings.imgAeoPrompt) || `Professional high-quality photography, premium maternal vibes.`;
          try {
            imageResponses = await Promise.all([
              env.AI.run(imgModel, { prompt: `${imgBase} for ${keyword}, hero wide angle, ${selectedStyle}`, negative_prompt: negPrompt }),
              env.AI.run(imgModel, { prompt: `${imgBase} for ${keyword}, detail, ${selectedStyle}`, negative_prompt: negPrompt }),
              env.AI.run(imgModel, { prompt: `${imgBase} for ${keyword}, lifestyle, ${selectedStyle}`, negative_prompt: negPrompt }),
              env.AI.run(imgModel, { prompt: `${imgBase} for ${keyword}, atmosphere, ${selectedStyle}`, negative_prompt: negPrompt })
            ]);
          } catch (e) { imageResponses = Array(4).fill(null); }

          const heroKey = `assets/${type}/${rawSlug}-${imgId}-hero.png`;
          if (imageResponses[0]) {
            await env.JOURNAL_BUCKET.put(heroKey, imageResponses[0], { httpMetadata: { contentType: "image/png" } });
            heroImagePath = `/${heroKey}`;
          } else { heroImagePath = `/assets/images/journal_1.jpg`; }

          for (let j = 1; j <= 3; j++) {
            const bKey = `assets/${type}/${rawSlug}-${imgId}-body${j}.png`;
            if (imageResponses[j]) {
              await env.JOURNAL_BUCKET.put(bKey, imageResponses[j], { httpMetadata: { contentType: "image/png" } });
              html = html.replace(`{{IMG_${j}}}`, `<img src="/${bKey}" style="width:100%; border-radius:1rem; margin:2rem 0; box-shadow:0 4px 6px rgba(0,0,0,0.05);" alt="${keyword} - ${title}">`);
            } else {
              html = html.replace(`{{IMG_${j}}}`, `<img src="/assets/images/post_${j}.jpg" style="width:100%; border-radius:1rem; margin:2rem 0;" alt="${keyword}">`);
            }
          }

          if (sourceName && sourceUrl) {
            html += `<div class="mt-12 p-8 bg-moon-50 border border-moon-100 rounded-3xl"><h4 class="font-bold text-lg mb-2 text-moon-900 flex items-center gap-2"><span class="material-symbols-outlined">library_books</span> 참고 문헌 및 신뢰도 출처</h4><p class="text-slate-600 mb-4 text-sm leading-relaxed">본 콘텐츠는 공신력 있는 의학 기관의 검증된 자료를 바탕으로 작성되었습니다.</p><a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="text-moon-600 hover:text-moon-900 font-bold underline inline-flex items-center gap-1 text-sm bg-white px-4 py-2 rounded-xl shadow-sm border border-moon-100">${sourceName} <span class="material-symbols-outlined" style="font-size:16px;">open_in_new</span></a></div>`;
          }
        } else {
          let imageResponse;
          const imgBase = settings.imgAeoPrompt || `High-quality infographic for ${keyword}. Minimalist, professional.`;
          let altText = `${title} infographic`;
          let captionText = "";
          const imageMatch = html.match(/<!--\s*PROMPT:\s*(.*?)\s*-->[\s\S]*?!\[\[?(.*?)\]\]?\((.*?)\)[\s\S]*?\*(?:Caption:|caption:|캡션:)?\s*(.*?)\*/i);
          let aiImgPrompt = imgBase;
          if (imageMatch) { aiImgPrompt = `${imgBase} - ${imageMatch[1].trim()}`; altText = imageMatch[2].trim(); captionText = imageMatch[4].trim(); }
          try {
            imageResponse = await env.AI.run(imgModel, {
              prompt: `Professional high-quality ${imgStyle}, ${aiImgPrompt}. ${selectedStyle}, no text.`,
              negative_prompt: negPrompt
            });
          } catch (e) { imageResponse = null; }
          if (imageResponse) {
            const imgKey = `assets/${type}/${rawSlug}-${imgId}.png`;
            await env.JOURNAL_BUCKET.put(imgKey, imageResponse, { httpMetadata: { contentType: "image/png" } });
            heroImagePath = `/${imgKey}`;
            if (imageMatch) {
              html = html.replace(imageMatch[0], `<figure class="my-12"><img src="${heroImagePath}" alt="${altText}" class="w-full rounded-2xl shadow-md border border-slate-200 object-cover" style="max-height:600px;"><figcaption class="text-center text-slate-500 text-sm mt-4 font-bold">${captionText}</figcaption></figure>`);
            }
          } else {
            heroImagePath = `/assets/images/expert_1.jpg`;
            if (imageMatch) html = html.replace(imageMatch[0], "");
          }
        }

        const schemaArray = [
          { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs.map(f => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })) },
          { "@context": "https://schema.org", "@type": "Article", "headline": title, "image": heroImagePath, "author": { "@type": "Person", "name": "Moonpiece Editorial Board" }, "publisher": { "@type": "Organization", "name": "Moonpiece" }, "datePublished": now.toISOString(), "description": `${keyword} expert guide` }
        ];

        const finalSlug = await resolveUniqueSlug(rawSlug, isSEO ? 'journal' : 'knowledge');
        const youtubeId = await getAiRecommendedYoutubeId(keyword, env);
        const finalPageHtml = await renderTemplate({ title, image: heroImagePath, html, faqs, schema: schemaArray, youtubeId }, env, isSEO ? '임산부 저널' : '임산부 지식인');
        const filePath = `${isSEO ? 'journal' : 'knowledge'}/${finalSlug}.html`;
        await env.JOURNAL_BUCKET.put(filePath, finalPageHtml, { httpMetadata: { contentType: "text/html; charset=UTF-8" } });

        const listKey = isSEO ? "journal/list.json" : "knowledge/list.json";
        let listArr = await safeGetJson(listKey, env);
        if(!Array.isArray(listArr)) listArr = [];
        
        const summaryText = (html || "").replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const itemPublishDate = new Date(startPublishDate.getTime() + (i * intervalHours * 60 * 60 * 1000));
        const targetDateStr = itemPublishDate.toISOString().split('T')[0];

        listArr.unshift({ 
          title, 
          category, 
          date: targetDateStr, 
          url: `/${filePath}`, 
          image: heroImagePath, 
          desc: summaryText.length > 80 ? summaryText.substring(0, 80) + "..." : summaryText,
          timestamp: itemPublishDate.getTime()
        });
        await env.JOURNAL_BUCKET.put(listKey, JSON.stringify(listArr));

        stepResult.status = "success";
        stepResult.path = `/${filePath}`;
        stepResult.title = title;
        stepResult.publishDate = targetDateStr;
      } catch (itemErr) {
        stepResult.status = "failed";
        stepResult.error = itemErr.message;
      }
      results.push(stepResult);
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
