import { getAssetFromKV } from "@cloudflare/kv-asset-handler";
import manifestJSON from "__STATIC_CONTENT_MANIFEST";
const assetManifest = JSON.parse(manifestJSON);

function parseCookies(request) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return {};
  return Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')));
}

export default {
  async fetch(request, env, ctx) {
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
        return new Response(JSON.stringify({ error: "Access Denied" }), { status: 403 });
      } catch (e) { return new Response(JSON.stringify({ error: "Auth Fail" }), { status: 403 }); }
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
      
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.9 // Higher temp for variability on regenerations
        })
      });
      const data = await res.json();
      let result = data.choices[0].message.content.trim();
      
      if (type === "source") {
        result = result.replace(/```json|```/gi, "").trim();
      }
      
      if (type === "slug") {
        result = result.replace(/[^a-z0-9-]/g, '').toLowerCase();
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        result = `${result}-${dateStr}`;
      }
      
      return new Response(JSON.stringify({ result }), { headers: { "Content-Type": "application/json" } });
    }

    // --- 4. Content Generation APIs ---
    if (url.pathname === "/admin/api/generate-journal" && request.method === "POST") {
      return await generateContentHandler(request, env, "seo");
    }
    if (url.pathname === "/admin/api/generate-knowledge" && request.method === "POST") {
      return await generateContentHandler(request, env, "aeo");
    }

    // --- 5. Post Management APIs ---
    // Helper to safely get and parse JSON from R2
    async function safeGetJson(key) {
      try {
        const obj = await env.JOURNAL_BUCKET.get(key);
        if (!obj) return [];
        let text = await obj.text();
        if (!text) return [];
        // Remove null bytes, BOM characters, and other invisible chars
        text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFEFF]/g, '').trim();
        if (!text) return [];
        return JSON.parse(text);
      } catch (e) {
        console.error(`Safe JSON parse error for ${key}:`, e.message);
        return [];
      }
    }

    if (url.pathname === "/admin/api/posts") {
      const journalList = await safeGetJson("journal/list.json");
      const knowledgeList = await safeGetJson("knowledge/list.json");
      
      const combined = [
        ...journalList.map(p => ({ ...p, type: 'journal' })),
        ...knowledgeList.map(p => ({ ...p, type: 'knowledge' }))
      ].sort((a,b) => new Date(b.date) - new Date(a.date));
      
      return new Response(JSON.stringify(combined), { headers: { "Content-Type": "application/json" } });
    }
    
    if (url.pathname === "/admin/api/posts/delete" && request.method === "POST") {
      const { url: postUrl, type } = await request.json();
      const listKey = type === 'journal' ? "journal/list.json" : "knowledge/list.json";
      const key = postUrl.startsWith('/') ? postUrl.slice(1) : postUrl;
      
      await env.JOURNAL_BUCKET.delete(key);
      const list = await env.JOURNAL_BUCKET.get(listKey).then(r => r ? r.json() : []);
      const filtered = list.filter(p => !postUrl.includes(p.url));
      await env.JOURNAL_BUCKET.put(listKey, JSON.stringify(filtered));
      
      return new Response(JSON.stringify({ success: true }));
    }

    if (url.pathname === "/admin/api/posts/raw" && request.method === "POST") {
      const { url: postUrl } = await request.json();
      const key = postUrl.startsWith('/') ? postUrl.slice(1) : postUrl;
      const object = await env.JOURNAL_BUCKET.get(key);
      if(object) {
        return new Response(JSON.stringify({ success: true, html: await object.text() }), { headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: false }), { status: 404 });
    }

    if (url.pathname === "/admin/api/posts/update" && request.method === "POST") {
      const { url: postUrl, html } = await request.json();
      const key = postUrl.startsWith('/') ? postUrl.slice(1) : postUrl;
      await env.JOURNAL_BUCKET.put(key, html, { httpMetadata: { contentType: "text/html; charset=UTF-8" } });
      return new Response(JSON.stringify({ success: true }));
    }

    if (url.pathname === "/admin/api/migrate/clear-all" && request.method === "POST") {
      await env.JOURNAL_BUCKET.put("journal/list.json", "[]");
      await env.JOURNAL_BUCKET.put("knowledge/list.json", "[]");
      return new Response(JSON.stringify({ success: true }));
    }

    if (url.pathname === "/list-journals") {
      const data = await env.JOURNAL_BUCKET.get("journal/list.json");
      return new Response(data ? data.body : "[]", { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    if (url.pathname === "/list-knowledge") {
      const data = await env.JOURNAL_BUCKET.get("knowledge/list.json");
      return new Response(data ? data.body : "[]", { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
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
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
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
        // Add cache control for images
        if (key.endsWith(".png")) headers.set("Cache-Control", "public, max-age=31536000");
        return new Response(object.body, { headers });
      }
    }

    try {
      return await getAssetFromKV({ request, waitUntil: ctx.waitUntil.bind(ctx) }, { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: assetManifest });
    } catch (e) { return new Response("Not Found", { status: 404 }); }
  }
};

// --- Optimized Content Generation Engine ---
async function generateContentHandler(request, env, type) {
  const payload = await request.json();
  const { keyword, title, slug: rawSlug, subKeywords, sourceName, sourceUrl, category, isFinal = false, finalHtml = "" } = payload;
  const isSEO = type === "seo";

  async function resolveUniqueSlug(baseSlug, prefix) {
    let newSlug = baseSlug;
    let counter = 1;
    const listKey = prefix === "journal" ? "journal/list.json" : "knowledge/list.json";
    
    // Safely get list from bucket
    async function getInternalList(key) {
        try {
            const obj = await env.JOURNAL_BUCKET.get(key);
            if (!obj) return [];
            let text = await obj.text();
            if (!text) return [];
            // Remove null bytes, BOM characters, and other invisible chars
            text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFEFF]/g, '').trim();
            if (!text || text === '') return [];
            return JSON.parse(text);
        } catch (e) { console.error('getInternalList parse error:', e.message); return []; }
    }
    const bucketList = await getInternalList(listKey);
    
    while (true) {
      if (!bucketList.find(p => p.url.includes(`${newSlug}.html`))) {
        break;
      }
      newSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    return newSlug;
  }

  if (isFinal) {
    const slug = await resolveUniqueSlug(rawSlug, isSEO ? 'journal' : 'knowledge');
    const html = await renderTemplate({ 
        title, 
        image: payload.image, 
        html: finalHtml, 
        faqs: payload.faqs, 
        schema: payload.schema 
    }, env, isSEO ? '임산부 저널' : '임산부 지식인');
    
    const filePath = `${isSEO ? 'journal' : 'knowledge'}/${slug}.html`;
    await env.JOURNAL_BUCKET.put(filePath, html, { httpMetadata: { contentType: "text/html; charset=UTF-8" } });
    
    const listKey = isSEO ? "journal/list.json" : "knowledge/list.json";
    let list = [];
    try {
        const listData = await env.JOURNAL_BUCKET.get(listKey);
        if (listData) list = await listData.json();
    } catch (e) { console.error("List JSON parse error:", e.message); list = []; }
    
    // Check if title overlaps, append counter to title if needed visually
    let finalTitle = title;
    let tCounter = 1;
    while(list.find(p => p.title === finalTitle)) {
        finalTitle = `${title} (${tCounter})`;
        tCounter++;
    }

    function extractSummary(html, length = 120) {
      if (!html) return "";
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return text.length > length ? text.substring(0, length) + "..." : text;
    }

    const summary = extractSummary(finalHtml, 80);

    const listEntry = { 
        title: finalTitle, 
        category, 
        date: new Date().toLocaleDateString('ko-KR'), 
        url: `/${filePath}`, 
        image: payload.image,
        desc: summary
    };

    list.unshift(listEntry);
    await env.JOURNAL_BUCKET.put(listKey, JSON.stringify(list));
    return new Response(JSON.stringify({ success: true, path: `/${filePath}` }));
  }

  async function ai(prompt, system = "You are a professional content architect.") {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: system }, { role: "user", content: prompt }] })
    });
    const d = await res.json();
    return d.choices[0].message.content;
  }

  try {
    // 1. Parallel AI Generation to beat timeouts while maintaining massive length
    const bodyPrompt = isSEO 
      ? `Write a highly professional, empathetic, and strictly formatted SEO blog post about "${keyword}". Title: "${title}". Target sub-keywords: ${subKeywords || keyword}. 
         ${sourceName ? `CRITICAL: Ensure you naturally cite this authoritative source in the text: [${sourceName}](${sourceUrl})` : ''}
         CRITICAL REQUIREMENT: The output MUST exceed 2,000 Korean characters. Explain in profound detail with minimum 5 sections.
         USE EXACTLY 3 PLACEHOLDERS for images naturally within the text. Use exactly this format: {{IMG_1}}, {{IMG_2}}, {{IMG_3}}. Place them between paragraphs where visually appropriate.
         Use exactly <article class="post-content">, <h2>, <h3>, <p>, <ul>, <strong> tags. Do NOT use markdown code blocks, return ONLY raw HTML for the body.`
      : `Write an elite-level AEO-optimized expert answer about "${keyword}". Title/Question: "${title}". 
         당신은 구글 AI 개요(AI Overviews)가 가장 먼저 인용할 '정답'을 만드는 AEO 전략가입니다.
         CRITICAL REQUIREMENT: You MUST strictly follow this exact 4-step semantic HTML 구조를 100% 준수하세요:
         1. <h1>${title} (대화형 질문 형식)</h1>
         2. <div class="aeo-summary-box"><ul><li>핵심 요약 1 (50자 내외)</li><li>핵심 요약 2 (Snippet Bait)</li><li>핵심 요약 3 (정답 요약)</li></ul></div>
         3. <section><h2>전문적 원인 분석 (E-E-A-T)</h2><p>'코르티솔', '진피층 엘라스틴 파괴', '혈류량 변화' 등 의학적/과학적 전문 키워드를 문맥에 맞게 포함하여 1,000자 이상 심층 서술.</p></section>
         4. <section><h2>단계별 대처법 가이드</h2><ol><li><strong>1단계:</strong> 상세 설명...</li><li><strong>2단계:</strong> 상세 설명...</li><li><strong>3단계:</strong> 상세 설명...</li></ol></section>
         The output MUST exceed 1,500 characters. Return ONLY raw HTML for the body.`;

    const faqPrompt = `Generate exactly 5 AEO-optimized FAQs for "${keyword}". Target long-tail search intent.
         CRITICAL: The Answer text MUST contain the main keyword "${keyword}" at least once. 
         Return ONLY a valid JSON array: [{"q": "Long tail question?", "a": "Answer containing keyword..."}]`;

    // Promise.all to drastically reduce execution time
    const [htmlRaw, faqsRaw, scoringRaw] = await Promise.all([
      ai(bodyPrompt),
      ai(faqPrompt),
      ai(`Score this content idea (0-100) for SEO/AEO based on keyword "${keyword}". Return ONLY JSON: {"score": 95, "feedback": "Looks great."}`)
    ]);

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
        throw e;
      }
    }

    let html = htmlRaw.replace(/```html|```/g, "").trim();
    const faqs = parseAIJson(faqsRaw);
    const scoreData = parseAIJson(scoringRaw);

    const imgId = Date.now();
    let heroImagePath = "";

    if (isSEO) {
      // 2. Generate multiple images in parallel for SEO
      const imgPrompts = [
        `Professional photography for ${keyword}, hero wide shot, soft lighting, premium maternal vibes, extremely high quality, realistic.`,
        `Professional photography for ${keyword}, detailed close-up shot, soft lighting, premium maternal vibes, extremely high quality.`,
        `Professional photography for ${keyword}, contextual lifestyle shot, soft lighting, premium maternal vibes, extremely high quality.`,
        `Professional photography for ${keyword}, comforting warm atmosphere, soft lighting, premium maternal vibes, extremely high quality.`
      ];
      const negativePrompt = "deformed, ugly, disfigured, bad anatomy, text, watermark, low resolution, blurry faces, mutated, extra limbs, impossible belly, weird faces";
      
      let imageResponses;
      try {
        imageResponses = await Promise.all(imgPrompts.map(p => 
          env.AI.run("@cf/bytedance/stable-diffusion-xl-lightning", { prompt: p, negative_prompt: negativePrompt })
        ));
      } catch (e) {
        console.warn("AI Image Generation failed (likely local mode):", e.message);
        // Fallback to placeholders if AI fails
        imageResponses = Array(4).fill(null);
      }
      
      const heroImageKey = `assets/${type}/${rawSlug}-${imgId}-hero.png`;
      if (imageResponses[0]) {
        await env.JOURNAL_BUCKET.put(heroImageKey, imageResponses[0], { httpMetadata: { contentType: "image/png" } });
        heroImagePath = `/${heroImageKey}`;
      } else {
        heroImagePath = `/assets/images/journal_1.jpg`; // Fallback placeholder
      }

      for(let i=1; i<=3; i++) {
        const key = `assets/${type}/${rawSlug}-${imgId}-body${i}.png`;
        if (imageResponses[i]) {
          await env.JOURNAL_BUCKET.put(key, imageResponses[i], { httpMetadata: { contentType: "image/png" } });
          html = html.replace(`{{IMG_${i}}}`, `<img src="/${key}" style="width:100%; border-radius:1rem; margin:2rem 0; box-shadow:0 4px 6px rgba(0,0,0,0.05);" alt="${keyword} - ${title} 관련 이미지 ${i}">`);
        } else {
          html = html.replace(`{{IMG_${i}}}`, `<img src="/assets/images/post_${i}.jpg" style="width:100%; border-radius:1rem; margin:2rem 0; box-shadow:0 4px 6px rgba(0,0,0,0.05);" alt="${keyword} - ${title} 관련 이미지 ${i}">`);
        }
      }
      
      if (sourceName && sourceUrl) {
        html += `
        <div class="mt-12 p-8 bg-moon-50 border border-moon-100 rounded-3xl">
            <h4 class="font-bold text-lg mb-2 text-moon-900 flex items-center gap-2">
                <span class="material-symbols-outlined">library_books</span>
                참고 문헌 및 신뢰도 출처
            </h4>
            <p class="text-slate-600 mb-4 text-sm leading-relaxed">본 콘텐츠는 임산부와 태아의 건강을 위해 공신력 있는 의학 및 건강 기관의 검증된 자료를 바탕으로 작성되었습니다.</p>
            <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="text-moon-600 hover:text-moon-900 font-bold underline flex items-center gap-1 text-sm bg-white inline-flex px-4 py-2 rounded-xl shadow-sm border border-moon-100 transition-all hover:shadow-md">
                ${sourceName} <span class="material-symbols-outlined" style="font-size:16px;">open_in_new</span>
            </a>
        </div>`;
      }
    } else {
      // Single AEO image
      let imageResponse;
      try {
        imageResponse = await env.AI.run("@cf/bytedance/stable-diffusion-xl-lightning", {
          prompt: `Professional high-quality photography for ${keyword}, ${title}, soft lighting, premium maternal vibes, realistic 8k.`,
          negative_prompt: "deformed, ugly, disfigured, bad anatomy, text, watermark, low resolution, blurry faces, mutated, extra limbs"
        });
      } catch (e) {
        console.warn("AI Image Generation failed (likely local mode):", e.message);
        imageResponse = null;
      }

      if (imageResponse) {
        const imageKey = `assets/${type}/${rawSlug}-${imgId}.png`;
        await env.JOURNAL_BUCKET.put(imageKey, imageResponse, { httpMetadata: { contentType: "image/png" } });
        heroImagePath = `/${imageKey}`;
      } else {
        heroImagePath = `/assets/images/expert_1.jpg`; // Fallback
      }
      // In AEO, we don't use placeholders usually, but we set the hero image alt in the template
    }

    // Schema format
    const faqSchema = { 
        "@context": "https://schema.org", 
        "@type": "FAQPage", 
        "mainEntity": faqs.map(f => ({ 
            "@type": "Question", 
            "name": f.q, 
            "acceptedAnswer": { "@type": "Answer", "text": f.a } 
        })) 
    };

    let schemaArray = [
        faqSchema,
        {
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": title,
          "image": heroImagePath,
          "author": { "@type": "Person", "name": "Moonpiece Editorial Board" },
          "publisher": { "@type": "Organization", "name": "Moonpiece", "logo": { "@type": "ImageObject", "url": "https://moonpiece.co.kr/assets/logo.png" } },
          "datePublished": new Date().toISOString(),
          "description": `${keyword}에 관한 전문가의 심층 답변과 단계별 해결 가이드를 확인하세요.`
        }
    ];

    if (!isSEO) {
      const olMatch = html.match(/<ol>([\s\S]*?)<\/ol>/i);
      if (olMatch) {
         const liItems = Array.from(olMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
         if (liItems.length > 0) {
            schemaArray.push({
               "@context": "https://schema.org",
               "@type": "HowTo",
               "name": title,
               "step": liItems.map((match, idx) => ({
                   "@type": "HowToStep",
                   "url": `https://moonpiece.co.kr/knowledge/${rawSlug}.html#step${idx+1}`,
                   "name": `Step ${idx+1}`,
                   "text": match[1].replace(/<[^>]+>/g, '').trim()
               }))
            });
         }
      }
    }

    const draftData = {
      title,
      slug: rawSlug,
      html,
      faqs,
      score: scoreData.score,
      feedback: scoreData.feedback,
      image: heroImagePath,
      schema: schemaArray
    };

    return new Response(JSON.stringify({ success: true, draft: draftData }));
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
  }
}

async function renderTemplate(data, env, categoryName) {
  const listKey = categoryName === '임산부 저널' ? "journal/list.json" : "knowledge/list.json";
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
                <a href="${p.url}" class="card overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300" style="padding:0;">
                    <img src="${p.image}" class="aspect-video object-cover w-full h-48">
                    <div class="p-6">
                        <h5 class="font-bold text-lg mb-2 text-slate-900 hover:text-purple-600 transition">${p.title}</h5>
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
    <nav class="nav-bar">
        <div class="nav-container">
            <a href="/" class="logo font-serif">Moonpiece</a>
            <div class="nav-links">
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

    <main class="py-24 container mx-auto px-4" style="max-width: 900px; min-height: 80vh;">
        <div class="category-badge mb-8">${categoryName}</div>
        <h1 class="font-serif mb-12" style="font-size: 3.5rem; line-height: 1.2;">${data.title}</h1>
        <img src="${data.image}" alt="${data.title}" class="w-full rounded-3xl shadow-xl mb-16 object-cover" style="aspect-ratio: 16/9;">
        
        <!-- Post Body -->
        <div class="post-body-container article-content bg-white p-8 md:p-16 rounded-[2.5rem] shadow-sm border border-slate-200">
            ${data.html}
        </div>
        
        <section class="mt-24">
            <h3 class="font-serif mb-8 text-3xl">자주 묻는 질문 (FAQ)</h3>
            <div class="flex flex-col gap-4">
                ${(data.faqs || []).map(f => `
                <details class="faq-card p-6 rounded-2xl bg-white shadow-sm mb-4 border border-slate-200 group">
                    <summary class="font-bold cursor-pointer text-lg list-none flex justify-between items-center">
                        ${f.q}
                        <span class="material-symbols-outlined transition-transform group-open:rotate-180">expand_more</span>
                    </summary>
                    <p class="mt-4 leading-relaxed text-slate-600 border-t border-slate-100 pt-4">${f.a}</p>
                </details>`).join("")}
            </div>
        </section>
        
        ${relatedHtml}
    </main>

    <!-- Footer -->
    <footer>
        <div class="container mx-auto px-4 grid md:grid-cols-2 gap-12">
            <div>
                <div class="logo font-serif mb-4" style="color: var(--primary);">Moonpiece</div>
                <p style="max-width: 320px; color: var(--on-surface-variant); line-height: 1.8;">
                    소중한 엄마와 아기를 위한 달빛의 조각, 문피스. 11년의 진심을 담아 가장 편안한 휴식을 설계합니다.
                </p>
            </div>
            <div class="grid md:grid-cols-3 gap-8">
                <div>
                    <h4 class="font-bold mb-6">Company</h4>
                    <ul class="flex flex-col gap-3 text-slate-600">
                        <li><a href="/about.html">회사소개</a></li>
                        <li><a href="/terms.html">이용약관</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="font-bold mb-6">Support</h4>
                    <ul class="flex flex-col gap-3 text-slate-600">
                        <li><a href="/privacy.html">개인정보처리방침</a></li>
                        <li><a href="https://smartstore.naver.com/moonwalk00/products/2416019050" target="_blank">네이버 스마트스토어</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="font-bold mb-6">Social</h4>
                    <ul class="flex flex-col gap-3 text-slate-600">
                        <li><a href="#">Instagram</a></li>
                        <li><a href="#">YouTube</a></li>
                    </ul>
                </div>
            </div>
        </div>
        <div class="container mx-auto px-4 mt-16 pt-8 border-t border-slate-200 text-center text-slate-500 text-sm">
            © 2024 Moonpiece. All rights reserved.
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
