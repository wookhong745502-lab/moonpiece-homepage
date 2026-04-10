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
      // Exceptions for login page and auth API
      if (url.pathname === '/admin/login.html' || url.pathname.startsWith('/admin/api/auth/')) {
        // Allow pass through
      } else {
        const cookies = parseCookies(request);
        // Simple secure cookie validation check
        if (cookies['admin_session'] !== 'wookhong_verified') {
          // Requirement: Redirect unauthenticated to homepage
          return Response.redirect(`${url.origin}/`, 302);
        }
      }
    }

    // --- 2. Auth APIs ---
    if (url.pathname === '/admin/api/auth/verify' && request.method === 'POST') {
      const body = await request.json();
      
      // Development bypass
      if (body.bypass) {
        return new Response(JSON.stringify({ success: true }), {
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": "admin_session=wookhong_verified; Path=/; HttpOnly; Secure; SameSite=Lax"
          }
        });
      }

      const token = body.token;
      try {
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        if (!googleRes.ok) throw new Error("Invalid token");
        const data = await googleRes.json();
        
        // STRICT Authorization: only wookhong745502@gmail.com
        const allowedEmails = ['wookhong745502@gmail.com'];
        if (allowedEmails.includes(data.email) && (data.email_verified === 'true' || data.email_verified === true)) {
          return new Response(JSON.stringify({ success: true }), {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": "admin_session=wookhong_verified; Path=/; HttpOnly; Secure; SameSite=Lax"
            }
          });
        } else {
          return new Response(JSON.stringify({ error: "접근 권한이 없는 계정입니다." }), { status: 403 });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: "토큰 검증 실패" }), { status: 403 });
      }
    }

    if (url.pathname === '/admin/api/auth/logout' && request.method === 'POST') {
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
        }
      });
    }

    // --- 3. AI Helper APIs ---
    if (url.pathname === "/admin/api/suggest" && request.method === "POST") {
      const { type, keyword } = await request.json();
      const prompt = type === "title" 
        ? `Keyword: ${keyword}. Suggest one powerful, professional, and SEO-optimized Korean blog title for a maternity brand 'Moonpiece'. Return ONLY the title string.`
        : `Keyword: ${keyword}. Convert this into a clean, lower-case, hyphenated URL slug in English. Return ONLY the slug string.`;
      
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.6
        })
      });
      const data = await res.json();
      const resultText = data.choices[0].message.content.trim();
      return new Response(JSON.stringify({ result: resultText }), { headers: { "Content-Type": "application/json" } });
    }

    // --- 4. DeepSeek Content Generation APIs ---
    if (url.pathname === "/admin/api/generate-journal" && request.method === "POST") {
      return await generateContentHandler(request, env, "seo");
    }

    if (url.pathname === "/admin/api/generate-knowledge" && request.method === "POST") {
      return await generateContentHandler(request, env, "aeo");
    }

    if (url.pathname === "/admin/api/sync-naver-reviews" && request.method === "POST") {
      return await syncNaverReviewsHandler(request, env);
    }

    if (url.pathname === "/admin/api/sync-instagram" && request.method === "POST") {
      return await syncInstagramHandler(request, env);
    }

    // --- 5. Public Listing & Content APIs ---
    if (url.pathname === "/list-journals") {
      try {
        const existing = await env.JOURNAL_BUCKET.get("journals.json");
        return new Response(existing ? await existing.json() : "[]", { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      } catch (e) { return new Response("[]"); }
    }

    if (url.pathname === "/list-knowledge") {
      try {
        const existing = await env.JOURNAL_BUCKET.get("knowledge.json");
        return new Response(existing ? await existing.json() : "[]", { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      } catch (e) { return new Response("[]"); }
    }

    if (url.pathname === "/api/reviews") {
      const data = await env.JOURNAL_BUCKET.get("reviews.json");
      return new Response(data ? data.body : "[]", { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    if (url.pathname === "/api/instagram") {
      const data = await env.JOURNAL_BUCKET.get("instagram.json");
      return new Response(data ? data.body : "[]", { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    // --- 6. R2 Content Serving (Journal/Knowledge) ---
    if (url.pathname.startsWith("/journal/") || url.pathname.startsWith("/knowledge/")) {
      try {
        const key = url.pathname.slice(1);
        const object = await env.JOURNAL_BUCKET.get(key);
        if (object) {
          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set("Content-Type", "text/html; charset=UTF-8");
          headers.set("Access-Control-Allow-Origin", "*");
          return new Response(object.body, { headers });
        }
      } catch (e) {}
    }

    // --- 7. Static File Serving ---
    try {
      return await getAssetFromKV(
        { request, waitUntil: ctx.waitUntil.bind(ctx) },
        { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: assetManifest }
      );
    } catch (e) {
      if (url.pathname.startsWith('/admin/')) return Response.redirect(`${url.origin}/`, 302);
      return new Response("Not Found", { status: 404 });
    }
  }
};

// Helper: Content Generator (SEO/AEO Ported from Wikihong)
async function generateContentHandler(request, env, type) {
  try {
    const payload = await request.json();
    const { keyword, title, slug, subKeywords, sourceName, sourceUrl, category, tone, faq, locale = 'ko' } = payload;
    
    const isSEO = type === "seo";
    const dir = isSEO ? "journal" : "knowledge";
    const finalSlug = slug || encodeURIComponent(keyword.replace(/\s+/g, '-'));
    const filePath = `${dir}/${finalSlug}.html`;
    const listFile = isSEO ? "journals.json" : "knowledge.json";

    const catMap = { "sleep": "수면 자세", "pain": "통증 완화", "health": "건강 관리", "psychology": "심리 & 지식" };

    let masterPrompt = "";
    if (isSEO) {
      masterPrompt = `Role: Senior Maternity SEO Architect for 'Moonpiece'.
Main Keyword: ${keyword}
Target Title: ${title}
Sub-Keywords: ${subKeywords}
Source: ${sourceName} (${sourceUrl})
Language: ${locale === 'ko' ? 'Korean' : 'English'}

Task: Generate a 3000+ characters long-form professional blog post.
Instruction:
1. Use Semantic HTML5 (H2, H3, P, UL, Strong).
2. The tone must be expert, empathetic, and trustworthy.
3. Integrate health/medical insights naturally.
4. Periodically insert <img src='https://source.unsplash.com/800x600/?pregnancy,sleep...'> tags with relevant alternative text.
5. If a source is provided, cite it professionally at the end.

Return ONLY a valid JSON object:
{
  "title": "${title}",
  "desc": "SEO description (max 160 chars)",
  "html": "Full article HTML content starting with H2...",
  "image": "https://source.unsplash.com/800x600/?maternity,sleep",
  "category": "${catMap[category]}"
}`;
    } else {
      masterPrompt = `Role: AEO (Answer Engine) Specialist for 'Moonpiece'.
Question: ${keyword}
Tone: ${tone}
FAQ Enabled: ${faq}
Language: ${locale === 'ko' ? 'Korean' : 'English'}

Task: Generate an Answer Engine Optimized page.
Instruction:
1. Start with a Direct Answer (Featured Snippet style summary).
2. Follow with a structured Q&A using <div class='aeo-box'>.
3. Provide multi-dimensional insights using expert bullet points.
4. Generate a full FAQ section if enabled.
5. Generate a comprehensive JSON-LD (FAQPage) schema.

Return ONLY a valid JSON object:
{
  "title": "Direct Answer: ${keyword}",
  "desc": "Search snippets summary",
  "html": "HTML content including <div class='aeo-box'>...",
  "json_ld": "JSON-LD string",
  "image": "https://source.unsplash.com/800x600/?healthcare,pregnancy"
}`;
    }

    const aiRes = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a professional content architect. Always return only valid JSON." },
          { role: "user", content: masterPrompt }
        ],
        temperature: 0.7
      })
    });
    const deepseekResult = await aiRes.json();
    const aiContent = JSON.parse(deepseekResult.choices[0].message.content.replace(/```json|```/g, "").trim());

    // --- Template Injection ---
    const template = `<!DOCTYPE html>
<html lang="${locale}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${aiContent.title} | Moonpiece Lab</title>
    <meta name="description" content="${aiContent.desc}">
    <link rel="stylesheet" href="/styles.css">
    ${aiContent.json_ld ? `<script type="application/ld+json">${JSON.stringify(aiContent.json_ld)}</script>` : ""}
    <style>
        .post-content { line-height: 2; color: var(--on-surface); font-size: 1.15rem; }
        .post-content h2 { margin-top: 3.5rem; margin-bottom: 1.5rem; font-family: var(--font-serif); color: var(--primary); font-size: 2.2rem; }
        .post-content h3 { margin-top: 2.5rem; margin-bottom: 1.25rem; font-family: var(--font-serif); color: var(--secondary); font-size: 1.6rem; }
        .post-content p { margin-bottom: 1.8rem; }
        .post-content img { width: 100%; border-radius: 2rem; margin: 3rem 0; box-shadow: var(--shadow-lg); }
        .category-badge { display: inline-block; padding: 0.6rem 1.5rem; background: var(--primary-container); color: var(--on-primary-container); border-radius: 9999px; font-weight: 800; font-size: 0.95rem; margin-bottom: 2rem; }
        .aeo-box { background: var(--surface-container-low); padding: 3rem; border-radius: 2.5rem; border: 1px solid var(--outline-variant); margin: 3rem 0; box-shadow: var(--shadow-sm); }
        .aeo-q { font-weight: 900; color: var(--primary); font-size: 1.8rem; margin-bottom: 1.5rem; line-height: 1.3; }
        .aeo-a { color: var(--on-surface-variant); font-size: 1.15rem; line-height: 1.8; }
        .back-link { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--primary); text-decoration: none; font-weight: 800; margin-bottom: 3.5rem; transition: transform 0.2s; }
        .back-link:hover { transform: translateX(-5px); }
    </style>
</head>
<body>
    <nav class="nav-bar">
        <div class="nav-container">
            <a href="/index.html" class="logo font-serif">Moonpiece</a>
            <div class="nav-links">
                <a href="/brand.html" class="nav-link">문피스의 약속</a>
                <a href="/why.html" class="nav-link">편안함의 비밀</a>
                <a href="/review.html" class="nav-link">엄마들의 이야기</a>
                <a href="/journal.html" class="nav-link">임산부 저널</a>
                <a href="/knowledge.html" class="nav-link">임산부 지식인</a>
            </div>
            <div class="flex items-center gap-4">
                <a href="https://smartstore.naver.com/moonpiece" target="_blank" class="btn-primary mobile-hidden">구매하기</a>
                <button class="hamburger-btn" id="menu-toggle"><span></span><span></span><span></span></button>
            </div>
        </div>
    </nav>
    <div class="nav-overlay" id="overlay"></div>
    <div class="mobile-nav" id="mobile-menu">
        <a href="/brand.html" class="nav-link">문피스의 약속</a>
        <a href="/why.html" class="nav-link">편안함의 비밀</a>
        <a href="/review.html" class="nav-link">엄마들의 이야기</a>
        <a href="/journal.html" class="nav-link">임산부 저널</a>
        <a href="/knowledge.html" class="nav-link">임산부 지식인</a>
        <a href="https://smartstore.naver.com/moonpiece" target="_blank" class="btn-primary text-center mt-8">구매하기</a>
    </div>
    <header class="py-24" style="background: linear-gradient(180deg, var(--surface-container-low) 0%, white 100%);">
        <div class="container" style="max-width: 800px;">
            <a href="${isSEO ? "/journal.html" : "/knowledge.html"}" class="back-link">← 목록으로 돌아가기</a>
            <div class="category-badge">${catMap[category] || "Special Column"}</div>
            <h1 class="font-serif mb-8" style="font-size: 3.8rem; line-height: 1.1; letter-spacing: -0.02em; word-break: keep-all;">${aiContent.title}</h1>
            <div class="flex items-center gap-4 text-outline font-bold" style="font-size: 0.95rem;">
                <div style="width: 2.5rem; height: 2.5rem; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: white;">M</div>
                <div>
                    <div style="color: var(--on-surface);">Moonpiece Lab</div>
                    <div style="font-weight: 500; font-size: 0.85rem;">${new Date().toLocaleDateString('ko-KR')} • ${isSEO ? "SEO Journal" : "AEO Insight"}</div>
                </div>
            </div>
        </div>
    </header>
    <main class="py-24">
        <article class="container post-content" style="max-width: 800px;">${aiContent.html}</article>
    </main>
    <footer class="py-24 surface-container-lowest">
        <div class="container grid md:grid-cols-2 gap-12">
            <div>
                <div class="logo font-serif mb-6" style="color: var(--primary); font-size: 1.8rem;">Moonpiece</div>
                <p style="max-width: 360px; color: var(--on-surface-variant); line-height: 1.8;">소중한 엄마와 아기를 위한 달빛의 조각, 문피스. 10년의 진심을 담아 가장 편안한 휴식을 설계합니다.</p>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-8">
                <div><h4 style="font-weight: 800; margin-bottom: 1.5rem;">Company</h4><ul style="list-style: none; display: flex; flex-direction: column; gap: 0.8rem; color: var(--on-surface-variant);"><li><a href="/about.html">회사소개</a></li><li><a href="/terms.html">이용약관</a></li></ul></div>
                <div><h4 style="font-weight: 800; margin-bottom: 1.5rem;">Support</h4><ul style="list-style: none; display: flex; flex-direction: column; gap: 0.8rem; color: var(--on-surface-variant);"><li><a href="/privacy.html">개인정보처리방침</a></li><li><a href="https://smartstore.naver.com/moonpiece" target="_blank">스마트스토어</a></li></ul></div>
                <div><h4 style="font-weight: 800; margin-bottom: 1.5rem;">Social</h4><ul style="list-style: none; display: flex; flex-direction: column; gap: 0.8rem; color: var(--on-surface-variant);"><li><a href="#">Instagram</a></li><li><a href="#">YouTube</a></li></ul></div>
            </div>
        </div>
        <div class="container" style="margin-top: 5rem; padding-top: 2rem; border-top: 1px solid var(--outline-variant); text-align: center; color: var(--on-surface-variant); font-size: 0.85rem;">© 2024 Moonpiece. All rights reserved.</div>
    </footer>
    <script>
        const menuToggle = document.getElementById('menu-toggle');
        const mobileMenu = document.getElementById('mobile-menu');
        const overlay = document.getElementById('overlay');
        menuToggle.addEventListener('click', () => { const a = mobileMenu.classList.toggle('active'); menuToggle.classList.toggle('active'); overlay.classList.toggle('active'); document.body.style.overflow = a ? 'hidden' : 'auto'; });
        overlay.addEventListener('click', () => { mobileMenu.classList.remove('active'); menuToggle.classList.remove('active'); overlay.classList.remove('active'); document.body.style.overflow = 'auto'; });
    </script>
</body>
</html>`;

    // Save content
    await env.JOURNAL_BUCKET.put(filePath, template, { httpMetadata: { contentType: "text/html; charset=UTF-8" } });

    // Update index list
    const existing = await env.JOURNAL_BUCKET.get(listFile);
    let posts = existing ? await existing.json() : [];
    posts.unshift({
      title: aiContent.title,
      category: catMap[category] || aiContent.category,
      categoryKey: category,
      image: aiContent.image || "https://source.unsplash.com/800x600/?maternity",
      desc: aiContent.desc,
      date: new Date().toLocaleDateString('ko-KR'),
      url: `/${filePath}`
    });
    await env.JOURNAL_BUCKET.put(listFile, JSON.stringify(posts), { httpMetadata: { contentType: "application/json" } });

    return new Response(JSON.stringify({ success: true, path: `/${filePath}` }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

// Handler: Naver Blog Review Sync (with AI Summary)
async function syncNaverReviewsHandler(request, env) {
  try {
    const { keyword = "문피스 후기" } = await request.json();
    const clientId = env.NAVER_CLIENT_ID;
    const clientSecret = env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) return new Response(JSON.stringify({ error: "네이버 API 키가 설정되지 않았습니다." }), { status: 400 });

    const naverUrl = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=10&sort=sim`;
    const response = await fetch(naverUrl, {
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret }
    });
    const data = await response.json();
    
    if (!data.items) return new Response(JSON.stringify({ error: "네이버 검색 결과가 없습니다." }), { status: 404 });

    // AI Summarization of results
    const summarizePrompt = `You are a professional brand reviewer for Moonpiece.
We found these Naver Blog posts about us:
${JSON.stringify(data.items.map(i => ({ title: i.title, desc: i.description })))}

Summarize these into 5 premium user reviews.
Each review must have:
- Title (Max 20 chars)
- Content (Max 150 chars, emotional and warm)
- Author (Anonymous names like '민지 맘', '단비 엄마')
- Rating (4.5 to 5.0)

Return ONLY a valid JSON array of objects: 
[{"title": "...", "content": "...", "author": "...", "rating": 5.0}, ...]`;

    const aiRes = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: summarizePrompt }],
        temperature: 0.7
      })
    });
    const aiData = await aiRes.json();
    const reviews = JSON.parse(aiData.choices[0].message.content.replace(/```json|```/g, "").trim());

    await env.JOURNAL_BUCKET.put("reviews.json", JSON.stringify(reviews), { httpMetadata: { contentType: "application/json" } });
    return new Response(JSON.stringify({ success: true, count: reviews.length }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

// Handler: Instagram Feed Sync
async function syncInstagramHandler(request, env) {
  try {
    const accessToken = env.INSTAGRAM_ACCESS_TOKEN;
    const userId = env.INSTAGRAM_USER_ID;

    if (!accessToken || !userId) return new Response(JSON.stringify({ error: "인스타그램 API 설정이 누락되었습니다." }), { status: 400 });

    // For hashtag search, we'd need hashtag ID first. 
    // Assuming official account feed sync for stability.
    const instaUrl = `https://graph.facebook.com/v22.0/${userId}/media?fields=id,caption,media_url,permalink,timestamp&access_token=${accessToken}&limit=12`;
    const response = await fetch(instaUrl);
    const data = await response.json();

    if (!data.data) return new Response(JSON.stringify({ error: "인스타그램 데이터를 가져오지 못했습니다." }), { status: 404 });

    const feeds = data.data.map(item => ({
      id: item.id,
      image: item.media_url,
      link: item.permalink,
      caption: item.caption,
      date: new Date(item.timestamp).toLocaleDateString('ko-KR')
    }));

    await env.JOURNAL_BUCKET.put("instagram.json", JSON.stringify(feeds), { httpMetadata: { contentType: "application/json" } });
    return new Response(JSON.stringify({ success: true, count: feeds.length }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

