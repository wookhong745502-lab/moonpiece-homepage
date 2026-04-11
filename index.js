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
          prompt = `Keyword: ${keyword}. Suggest one powerful, professional, and SEO-optimized Korean blog title for 'Moonpiece'. Use click-bait techniques but keep it premium. Return ONLY the title string.`;
          break;
        case "slug":
          prompt = `Keyword: ${keyword}. Convert to a short English URL slug. Return ONLY lowercase hypenated string.`;
          break;
        case "keywords":
          prompt = `Keyword: ${keyword}. Provide 10 highly relevant SEO sub-keywords for Google Search (maternity niche). Return ONLY a comma-separated list.`;
          break;
        case "source":
          prompt = `Keyword: ${keyword}. Find a high-authority global health organization (WHO, Mayo Clinic, etc) or Korean medical news site related to this. Return JSON: {"name": "NAME", "url": "URL"}`;
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
          temperature: 0.7
        })
      });
      const data = await res.json();
      let result = data.choices[0].message.content.trim();
      
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
      return await generateChainContentHandler(request, env, "seo");
    }
    if (url.pathname === "/admin/api/generate-knowledge" && request.method === "POST") {
      return await generateChainContentHandler(request, env, "aeo");
    }

    // --- 5. Post Management APIs ---
    if (url.pathname === "/admin/api/posts" && request.method === "GET") {
      const journals = await env.JOURNAL_BUCKET.get("journal/list.json").then(r => r ? r.json() : []);
      const knowledge = await env.JOURNAL_BUCKET.get("knowledge/list.json").then(r => r ? r.json() : []);
      const all = [...journals.map(p => ({...p, type: 'journal'})), ...knowledge.map(p => ({...p, type: 'knowledge'}))];
      return new Response(JSON.stringify(all), { headers: { "Content-Type": "application/json" } });
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

    if (url.pathname.startsWith("/journal/") || url.pathname.startsWith("/knowledge/") || url.pathname.startsWith("/assets/")) {
      const key = url.pathname.slice(1);
      const object = await env.JOURNAL_BUCKET.get(key);
      if (object) {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("Content-Type", key.endsWith(".html") ? "text/html; charset=UTF-8" : "image/png");
        headers.set("Access-Control-Allow-Origin", "*");
        return new Response(object.body, { headers });
      }
    }

    try {
      return await getAssetFromKV({ request, waitUntil: ctx.waitUntil.bind(ctx) }, { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: assetManifest });
    } catch (e) { return new Response("Not Found", { status: 404 }); }
  }
};

// --- Advanced Content Generation Engine ---
async function generateChainContentHandler(request, env, type) {
  const payload = await request.json();
  const { keyword, title, slug, subKeywords, sourceName, sourceUrl, category, tone, faq, draft = false, isFinal = false, finalHtml = "" } = payload;
  const isSEO = type === "seo";

  if (isFinal) {
    // This is when user clicks "Publish" after draft
    const html = await renderTemplate({ title, slug, html: finalHtml, image: payload.image, faqs: payload.faqs, schema: payload.schema }, env, isSEO ? '임산부 저널' : '임산부 지식인');
    const filePath = `${isSEO ? 'journal' : 'knowledge'}/${slug}.html`;
    await env.JOURNAL_BUCKET.put(filePath, html, { httpMetadata: { contentType: "text/html; charset=UTF-8" } });
    
    const listKey = isSEO ? "journal/list.json" : "knowledge/list.json";
    const list = await env.JOURNAL_BUCKET.get(listKey).then(r => r ? r.json() : []);
    list.unshift({ title, category, date: new Date().toLocaleDateString('ko-KR'), url: `/${filePath}`, image: payload.image });
    await env.JOURNAL_BUCKET.put(listKey, JSON.stringify(list));
    return new Response(JSON.stringify({ success: true, path: `/${filePath}` }));
  }

  async function ai(prompt, system = "You are a professional content architect.") {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: "deepseek-reasoner", messages: [{ role: "system", content: system }, { role: "user", content: prompt }] })
    });
    const d = await res.json();
    return d.choices[0].message.content;
  }

  // 1. Outline
  const outlineRaw = await ai(`Create a 5-section outline for a 2000-word blog about "${keyword}". Title: "${title}". Return ONLY JSON: {"outline": ["...", "..."]}`);
  const { outline } = JSON.parse(outlineRaw.replace(/```json|```/g, "").trim());

  // 2. Body sections
  let html = "";
  for (const section of outline) {
    html += await ai(`Write accurately and empathetically for section "${section}" in the blog "${title}". Target sub-keywords: ${subKeywords}. Use HTML tags like H2, P, UL. Length: 500-600 characters. Language: Korean.`);
  }

  // 3. Scoring
  const scoringRaw = await ai(`Score this content (0-100) for SEO and AEO quality based on keyword "${keyword}". Return ONLY JSON: {"score": 88, "feedback": "..."}`);
  const scoreData = JSON.parse(scoringRaw.replace(/```json|```/g, "").trim());

  // 4. FAQ
  const faqsRaw = await ai(`Generate 5 AEO-optimized FAQs for "${keyword}". Return ONLY JSON array: [{"q": "Question?", "a": "Answer with keyword..."}]`);
  const faqs = JSON.parse(faqsRaw.replace(/```json|```/g, "").trim());

  // 5. Image (with strict negative prompt)
  const imageResponse = await env.AI.run("@cf/bytedance/stable-diffusion-xl-lightning", {
    prompt: `Professional photography for ${keyword}, soft lighting, premium maternal vibes, high quality, realistic.`,
    negative_prompt: "deformed limbs, extra appendages, disfigured, bad anatomy, text, watermark, low resolution, blurry faces"
  });
  const imageKey = `assets/${type}/${slug}.png`;
  await env.JOURNAL_BUCKET.put(imageKey, imageResponse, { httpMetadata: { contentType: "image/png" } });

  const draftData = {
    title,
    slug,
    html,
    faqs,
    score: scoreData.score,
    feedback: scoreData.feedback,
    image: `/${imageKey}`,
    schema: { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs.map(f => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })) }
  };

  return new Response(JSON.stringify({ success: true, draft: draftData }));
}

async function renderTemplate(data, env, categoryName) {
  const listKey = categoryName === '임산부 저널' ? "journal/list.json" : "knowledge/list.json";
  const list = await env.JOURNAL_BUCKET.get(listKey).then(r => r ? r.json() : []);
  const related = list.sort(() => 0.5 - Math.random()).slice(0, 3);
  
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title} | Moonpiece</title>
    <link rel="stylesheet" href="/styles.css">
    <script type="application/ld+json">${JSON.stringify(data.schema)}</script>
</head>
<body class="surface-low">
    <nav class="nav-bar"><div class="nav-container"><a href="/" class="logo font-serif">Moonpiece</a></div></nav>
    <main class="py-24 container" style="max-width: 800px;">
        <div class="category-badge mb-8">${categoryName}</div>
        <h1 class="font-serif mb-12" style="font-size: 3.5rem;">${data.title}</h1>
        <img src="${data.image}" alt="${data.title}" style="width: 100%; border-radius: 2rem; margin-bottom: 4rem;">
        <article class="post-content">${data.html}</article>
        <section class="mt-24">
            <h3 class="font-serif mb-8 text-3xl">자주 묻는 질문 (FAQ)</h3>
            ${data.faqs.map(f => `<details class="faq-card p-6 rounded-2xl surface-container-lowest mb-4 border border-outline-variant"><summary class="font-bold cursor-pointer">${f.q}</summary><p class="mt-4 leading-relaxed">${f.a}</p></details>`).join("")}
        </section>
        <section class="mt-24 border-t border-outline-variant pt-24">
            <h3 class="font-serif mb-12 text-3xl">관련 콘텐츠</h3>
            <div class="grid grid-cols-3 gap-8">
                ${related.map(p => `<a href="${p.url}" class="card overflow-hidden"><img src="${p.image}" class="aspect-video object-cover"><div class="p-4"><h5 class="font-bold text-sm">${p.title}</h5></div></a>`).join("")}
            </div>
        </section>
    </main>
</body>
</html>`;
}

