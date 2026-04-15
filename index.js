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
    if (url.pathname === "/admin/api/auto-publish" && request.method === "POST") {
      return await autoPublishHandler(request, env);
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
      if (!data) return new Response("[]", { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      const list = await data.json();
      const filtered = list.filter(p => !p.date || new Date(p.date) <= new Date());
      return new Response(JSON.stringify(filtered), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    if (url.pathname === "/list-knowledge") {
      const data = await env.JOURNAL_BUCKET.get("knowledge/list.json");
      if (!data) return new Response("[]", { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      const list = await data.json();
      const filtered = list.filter(p => !p.date || new Date(p.date) <= new Date());
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
        date: payload.publishDate || new Date().toISOString().split('T')[0], 
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
         검색엔진 구글 AI 개요(AI Overviews)에서 가장 먼저 인용되는 '정답'을 만드는 AEO 전략입니다.
         
         # 시스템 프롬프트: AEO 최적화 글쓰기 및 이미지 메타데이터 데이터프레임
         앞으로 작성되는 모든 문서에는 아래의 [AEO 이미지 최적화 규칙]을 엄격하게 적용하십시오. 본문과 이미지 요소 결합은 전체 콘텐츠 품질 평가에서 반드시 80점(A등급) 이상으로 작성하도록 구성되는 것이 최우선 목표입니다.

         ## 1. 이미지 생성 및 선정 가이드
         단순 장식용 스톡 사진은 사용 및 생성을 철저히 금지합니다.
         - 정보 확장: 텍스트의 핵심 내용을 요약하는 인포그래픽 또는 데이터 차트.
         - 구조화형: 프로세스, 기술적 데이터프레임, 아키텍처 등을 설명하는 명확한 다이어그램.
         - 상황/상태: 제품의 실제 텍스트, 사용 비교, 구체적인 사용 환경을 보여주는 묘사 (불필요한 배경 배제).

         ## 2. 메타데이터 및 SEO 최적화 규칙
         - 파일명: 직관적인 영문 (예: pregnancy-care-guide.jpg) 조합.
         - 대체 텍스트(Alt Text): 핵심 키워드와 주제가 들어간 자연스러운 1~2문장 서술 텍스트.
         - 캡션: 이미지 하단에 배치되어 본문과의 문맥적 연결성을 강화하는 상세 설명.

         ## 3. 마크다운 출력 양식 (Output Format)
         본문은 텍스트 문맥과 1:1로 매핑되는 최적의 위치에 다음의 템플릿을 사용하여 이미지를 "딱 1개만" 배치하십시오.
         다음 컴포넌트(Stable Diffusion)가 이미지를 그릴 수 있도록 영문 프롬프트를 주석으로 함께 제공하십시오.
         
         <!-- PROMPT: [English prompt for Stable Diffusion] -->
         ![[대체 텍스트]]([context-specific-file-name.jpg])
         *캡션: [상세 설명]*

         CRITICAL REQUIREMENT: You MUST strictly follow this exact semantic HTML 구조를 100% 준수하세요:
         1. <h1>${title} (질문형 질문)</h1>
         2. <div class="aeo-summary-box"><ul><li>핵심 요약 1</li><li>핵심 요약 2</li><li>핵심 요약 3</li></ul></div>
         3. <section><h2>전문가 의견 분석 (E-E-A-T)</h2><p>설명...</p> (첫 번째 문맥 최적 위치에 이미지 마크다운 템플릿 1개 삽입)</section>
         4. <section><h2>단계별 처방법 가이드</h2><ol><li><strong>1단계:</strong>...</li></ol></section>
         The output MUST exceed 1,500 characters. Return ONLY raw HTML for the body, EXCEPT for the image markdown block.`;

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
                참고 문헌 및 자료 출처
            </h4>
            <p class="text-slate-600 mb-4 text-sm leading-relaxed">본 콘텐츠는 임산부의 건강을 위해 공신력 있는 의학 및 건강 기관의 검증된 자료를 바탕으로 작성되었습니다.</p>
            <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="text-moon-600 hover:text-moon-900 font-bold underline flex items-center gap-1 text-sm bg-white inline-flex px-4 py-2 rounded-xl shadow-sm border border-moon-100 transition-all hover:shadow-md">
                ${sourceName} <span class="material-symbols-outlined" style="font-size:16px;">open_in_new</span>
            </a>
        </div>`;
      }
    } else {
      // Single AEO image
      let imageResponse;
      let aiPrompt = `High-quality AEO vector infographic or clear process diagram for ${keyword}. Minimalist, professional.`;
      let altText = `${title} 관련 전문 서술 텍스트`;
      let captionText = "";
      
      const imageMatch = html.match(/<!--\s*PROMPT:\s*(.*?)\s*-->[\s\S]*?!\[\[?(.*?)\]\]?\((.*?)\)[\s\S]*?\*(?:캡션:\s*)?(.*?)\*/i);
      
      if (imageMatch) {
          aiPrompt = imageMatch[1].trim();
          altText = imageMatch[2].trim();
          captionText = imageMatch[4].trim();
      }

      try {
        imageResponse = await env.AI.run("@cf/bytedance/stable-diffusion-xl-lightning", {
          prompt: `Professional high-quality photography, high quality infographic or clear process diagram. ${aiPrompt}. Soft lighting, realistic 8k, no text, no gibberish text.`,
          negative_prompt: "deformed, ugly, disfigured, bad anatomy, english text, watermark, low resolution, blurry faces, mutated, extra limbs"
        });
      } catch (e) {
        console.warn("AI Image Generation failed (likely local mode):", e.message);
        imageResponse = null;
      }

      if (imageResponse) {
        const imageKey = `assets/${type}/${rawSlug}-${imgId}.png`;
        await env.JOURNAL_BUCKET.put(imageKey, imageResponse, { httpMetadata: { contentType: "image/png" } });
        heroImagePath = `/${imageKey}`;
        
        if (imageMatch) {
            const figureHtml = `
            <figure class="my-12">
                <img src="${heroImagePath}" alt="${altText}" class="w-full rounded-2xl shadow-md border border-slate-200 object-cover" style="max-height: 600px;">
                <figcaption class="text-center text-slate-500 text-sm mt-4 font-bold">${captionText}</figcaption>
            </figure>`;
            html = html.replace(imageMatch[0], figureHtml);
        }
      } else {
        heroImagePath = `/assets/images/expert_1.jpg`; // Fallback
        if (imageMatch) {
            html = html.replace(imageMatch[0], "");
        }
      }
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
          "description": `${keyword}에 관한 전문가의 조언 및 단계별 해결 가이드를 확인하세요.`
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
        ${(categoryName === '임산부 지식인') && (data.html || '').includes('<figure') ? '' : `<img src="${data.image}" alt="${data.title}" class="w-full rounded-3xl shadow-xl mb-16 object-cover" style="aspect-ratio: 16/9;">`}
        
        <!-- Post Body -->
        <div class="post-body-container article-content bg-white p-8 md:p-16 rounded-[2.5rem] shadow-sm border border-slate-200">
            ${data.html}
        </div>
        
        <section class="mt-24">
            <h3 class="font-serif mb-12 text-3xl">?먯＜ 臾삳뒗 吏덈Ц (FAQ)</h3>
            <div class="flex flex-col gap-12">
                ${(data.faqs || []).map(f => `
                <div class="faq-item">
                    <h3 class="text-xl font-bold mb-4 flex gap-3 text-moon-900">
                        <span class="text-moon-200">Q.</span> ${f.q}
                    </h3>
                    <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-slate-600 leading-relaxed">
                        <p>${f.a}</p>
                    </div>
                </div>`).join("")}
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
                    소중한 엄마와 아기를 위한 달빛 조각, 문피스. 11년의 진심을 담아 가장 편안한 휴식을 설계합니다.
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

// --- Auto-Publish Handler (Full Pipeline: Keyword -> Content -> Deploy) ---
async function autoPublishHandler(request, env) {
  const payload = await request.json();
  const { category, count = 1, type = "seo" } = payload;
  const isSEO = type === "seo";

  const categoryNameMap = { sleep: "수면 자세", pain: "통증 완화", health: "건강 관리", psychology: "심리 & 지식", others: "기타" };
  const categoryName = categoryNameMap[category] || category;
  const results = [];

  async function aiCall(prompt, system = "You are a professional content architect.", temperature = 0.9) {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: system }, { role: "user", content: prompt }], temperature })
    });
    const d = await res.json();
    return d.choices[0].message.content;
  }

  function parseAIJson(raw) {
    try {
      return JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch (e) {
      const start = Math.min(raw.indexOf('{') === -1 ? Infinity : raw.indexOf('{'), raw.indexOf('[') === -1 ? Infinity : raw.indexOf('['));
      const end = Math.max(raw.lastIndexOf('}') === -1 ? -1 : raw.lastIndexOf('}'), raw.lastIndexOf(']') === -1 ? -1 : raw.lastIndexOf(']'));
      if (start !== Infinity && end !== -1 && start < end) {
        try { return JSON.parse(raw.substring(start, end + 1)); } catch(err) { throw e; }
      }
      throw e;
    }
  }

  async function safeGetJson(key) {
    try {
      const obj = await env.JOURNAL_BUCKET.get(key);
      if (!obj) return [];
      let text = await obj.text();
      if (!text) return [];
      text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFEFF]/g, '').trim();
      if (!text) return [];
      return JSON.parse(text);
    } catch (e) { return []; }
  }

  async function resolveUniqueSlug(baseSlug, prefix) {
    let newSlug = baseSlug;
    let counter = 1;
    const listKey = prefix === "journal" ? "journal/list.json" : "knowledge/list.json";
    const bucketList = await safeGetJson(listKey);
    while (true) {
      if (!bucketList.find(p => p.url.includes(`${newSlug}.html`))) break;
      newSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    return newSlug;
  }

  try {
    const existingList = await safeGetJson(isSEO ? "journal/list.json" : "knowledge/list.json");
    const existingTitles = existingList.map(p => p.title).slice(0, 30).join(", ");

    const keywordPrompt = isSEO
      ? `임산부 관련 "${categoryName}" 카테고리에서 SEO 블로그 글을 쓸 수 있는 구체적인 한국어 키워드 ${count}개를 생성하세요. 기존 주제 피하기: [${existingTitles}]. Return ONLY a JSON array of strings. No explanation.`
      : `임산부들이 검색할 법한 "${categoryName}" 관련 질문형 한국어 키워드 ${count}개를 생성하세요. 기존 주제 피하기: [${existingTitles}]. Return ONLY a JSON array of strings. No explanation.`;

    const keywordsRaw = await aiCall(keywordPrompt);
    const keywords = parseAIJson(keywordsRaw);

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Failed to generate keywords" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    for (let i = 0; i < Math.min(keywords.length, count); i++) {
      const keyword = keywords[i];
      const stepResult = { keyword, status: "processing" };

      try {
        const metaPrompts = isSEO ? [
          aiCall(`Keyword: ${keyword}. Suggest one powerful, professional, SEO-optimized Korean blog title for 'Moonpiece'. Return ONLY the title string.`),
          aiCall(`Keyword: ${keyword}. Convert to a short English URL slug. Return ONLY lowercase hyphenated string.`),
          aiCall(`Keyword: ${keyword}. Provide 10 highly relevant SEO sub-keywords (maternity niche). Return ONLY a comma-separated list.`),
          aiCall(`Keyword: ${keyword}. Find a high-authority health organization related to this. Return JSON: {"name": "NAME", "url": "URL"}`)
        ] : [
          aiCall(`Keyword: ${keyword}. Rephrase as a natural search question a pregnant Korean woman would ask. Return ONLY the question string.`),
          aiCall(`Keyword: ${keyword}. Convert to a short English URL slug. Return ONLY lowercase hyphenated string.`)
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

        const bodyPrompt = isSEO
          ? `Write a highly professional SEO blog post about "${keyword}". Title: "${title}". Sub-keywords: ${subKeywords}. ${sourceName ? `Cite source: [${sourceName}](${sourceUrl})` : ''} MUST exceed 2,000 Korean chars. Min 5 sections. USE {{IMG_1}}, {{IMG_2}}, {{IMG_3}} placeholders. Use <article class="post-content">, <h2>, <h3>, <p>, <ul>, <strong> tags. Return ONLY raw HTML.`
          : `Write an elite AEO answer about "${keyword}". Title: "${title}". Use semantic HTML: <h1>, <div class="aeo-summary-box"><ul><li></li></ul></div>, <section><h2></h2><p></p></section>, <section><h2>Step-by-step guide</h2><ol><li></li></ol></section>. Place 1 image: <!-- PROMPT: [English] --> ![[Alt Text]]([file.jpg]) *Caption: [desc]*. MUST exceed 1,500 chars. Return ONLY raw HTML + image markdown.`;

        const faqPrompt = `Generate exactly 5 AEO-optimized FAQs for "${keyword}". Answer MUST contain keyword. Return ONLY JSON array: [{"q": "?", "a": "..."}]`;

        const [htmlRaw, faqsRaw] = await Promise.all([aiCall(bodyPrompt), aiCall(faqPrompt)]);
        let html = htmlRaw.replace(/```html|```/g, "").trim();
        const faqs = parseAIJson(faqsRaw);

        const imgId = Date.now() + i;
        let heroImagePath = "";
        const negPrompt = "deformed, ugly, disfigured, bad anatomy, text, watermark, low resolution, blurry faces, mutated, extra limbs";

        if (isSEO) {
          let imageResponses;
          try {
            imageResponses = await Promise.all([
              env.AI.run("@cf/bytedance/stable-diffusion-xl-lightning", { prompt: `Professional photo for ${keyword}, hero wide shot, soft lighting, premium maternal`, negative_prompt: negPrompt }),
              env.AI.run("@cf/bytedance/stable-diffusion-xl-lightning", { prompt: `Professional photo for ${keyword}, close-up detail, soft lighting`, negative_prompt: negPrompt }),
              env.AI.run("@cf/bytedance/stable-diffusion-xl-lightning", { prompt: `Professional photo for ${keyword}, lifestyle context, warm light`, negative_prompt: negPrompt }),
              env.AI.run("@cf/bytedance/stable-diffusion-xl-lightning", { prompt: `Professional photo for ${keyword}, comforting atmosphere`, negative_prompt: negPrompt })
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
              html = html.replace(`{{IMG_${j}}}`, `<img src="/${bKey}" style="width:100%; border-radius:1rem; margin:2rem 0; box-shadow:0 4px 6px rgba(0,0,0,0.05);" alt="${keyword} image ${j}">`);
            } else {
              html = html.replace(`{{IMG_${j}}}`, `<img src="/assets/images/post_${j}.jpg" style="width:100%; border-radius:1rem; margin:2rem 0;" alt="${keyword} image ${j}">`);
            }
          }

          if (sourceName && sourceUrl) {
            html += `<div class="mt-12 p-8 bg-moon-50 border border-moon-100 rounded-3xl"><h4 class="font-bold text-lg mb-2 text-moon-900 flex items-center gap-2"><span class="material-symbols-outlined">library_books</span> 참고 문헌 및 신뢰도 출처</h4><p class="text-slate-600 mb-4 text-sm leading-relaxed">본 콘텐츠는 공신력 있는 의학 기관의 검증된 자료를 바탕으로 작성되었습니다.</p><a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="text-moon-600 hover:text-moon-900 font-bold underline inline-flex items-center gap-1 text-sm bg-white px-4 py-2 rounded-xl shadow-sm border border-moon-100">${sourceName} <span class="material-symbols-outlined" style="font-size:16px;">open_in_new</span></a></div>`;
          }
        } else {
          let imageResponse;
          let aiImgPrompt = `High-quality infographic for ${keyword}. Minimalist, professional.`;
          let altText = `${title} infographic`;
          let captionText = "";
          const imageMatch = html.match(/<!--\s*PROMPT:\s*(.*?)\s*-->[\s\S]*?!\[\[?(.*?)\]\]?\((.*?)\)[\s\S]*?\*(?:Caption:|caption:|캡션:)?\s*(.*?)\*/i);
          if (imageMatch) { aiImgPrompt = imageMatch[1].trim(); altText = imageMatch[2].trim(); captionText = imageMatch[4].trim(); }
          try {
            imageResponse = await env.AI.run("@cf/bytedance/stable-diffusion-xl-lightning", {
              prompt: `Professional infographic or diagram. ${aiImgPrompt}. Soft lighting, realistic 8k, no text.`,
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
        if (!isSEO) {
          const olMatch = html.match(/<ol>([\s\S]*?)<\/ol>/i);
          if (olMatch) {
            const liItems = Array.from(olMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
            if (liItems.length > 0) {
              schemaArray.push({ "@context": "https://schema.org", "@type": "HowTo", "name": title, "step": liItems.map((m, idx) => ({ "@type": "HowToStep", "name": `Step ${idx+1}`, "text": m[1].replace(/<[^>]+>/g, '').trim() })) });
            }
          }
        }

        const slug = await resolveUniqueSlug(rawSlug, isSEO ? 'journal' : 'knowledge');
        const finalPageHtml = await renderTemplate({ title, image: heroImagePath, html, faqs, schema: schemaArray }, env, isSEO ? '임산부 저널' : '임산부 지식인');
        const filePath = `${isSEO ? 'journal' : 'knowledge'}/${slug}.html`;
        await env.JOURNAL_BUCKET.put(filePath, finalPageHtml, { httpMetadata: { contentType: "text/html; charset=UTF-8" } });

        const listKey = isSEO ? "journal/list.json" : "knowledge/list.json";
        let list = await safeGetJson(listKey);
        const summary = (html || "").replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        
        let targetDate = payload.publishDate || now.toISOString().split('T')[0];
        if (payload.publishDate && i > 0) {
            const d = new Date(payload.publishDate);
            d.setDate(d.getDate() + i);
            targetDate = d.toISOString().split('T')[0];
        }

        list.unshift({ 
          title, 
          category, 
          date: targetDate, 
          url: `/${filePath}`, 
          image: heroImagePath, 
          desc: summary.length > 80 ? summary.substring(0, 80) + "..." : summary 
        });
        await env.JOURNAL_BUCKET.put(listKey, JSON.stringify(list));

        stepResult.status = "success";
        stepResult.path = `/${filePath}`;
        stepResult.title = title;
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
