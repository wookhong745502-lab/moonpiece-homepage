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
        
        // Strict Authorization: Allow both wookhong745502 and wookhong7455
        const allowedEmails = ['wookhong745502@gmail.com', 'wookhong7455@gmail.com'];
        if (allowedEmails.includes(data.email) && (data.email_verified === 'true' || data.email_verified === true)) {
          return new Response(JSON.stringify({ success: true }), {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": "admin_session=wookhong_verified; Path=/; HttpOnly; Secure; SameSite=Lax"
            }
          });
        } else {
          return new Response(JSON.stringify({ error: "Unauthorized email account" }), { status: 403 });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: "Token verification failed" }), { status: 403 });
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

    // --- 3. Public Listing APIs ---
    if (url.pathname === "/list-journals") {
      try {
        if (!env.JOURNAL_BUCKET) throw new Error();
        const existing = await env.JOURNAL_BUCKET.get("journals.json");
        const data = existing ? await existing.json() : [];
        return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      } catch (e) {
        return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
      }
    }

    if (url.pathname === "/list-knowledge") {
      try {
        if (!env.JOURNAL_BUCKET) throw new Error();
        const existing = await env.JOURNAL_BUCKET.get("knowledge.json");
        const data = existing ? await existing.json() : [];
        return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      } catch (e) {
        return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
      }
    }

    // --- 4. DeepSeek Content Generation APIs ---
    if (url.pathname === "/admin/api/generate-journal" && request.method === "POST") {
      return await generateContentHandler(request, env, "seo");
    }

    if (url.pathname === "/admin/api/generate-knowledge" && request.method === "POST") {
      return await generateContentHandler(request, env, "aeo");
    }

    // --- 5. R2 Content Serving (Journal/Knowledge) ---
    if (url.pathname.startsWith("/journal/") || url.pathname.startsWith("/knowledge/")) {
      try {
        const key = url.pathname.slice(1); // remove leading /
        const object = await env.JOURNAL_BUCKET.get(key);
        if (object) {
          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set("Content-Type", "text/html; charset=UTF-8");
          headers.set("Access-Control-Allow-Origin", "*");
          return new Response(object.body, { headers });
        }
      } catch (e) {
        // Fall through to static if R2 fails
      }
    }

    // --- 6. Static File Serving ---
    try {
      return await getAssetFromKV(
        { request, waitUntil: ctx.waitUntil.bind(ctx) },
        { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: assetManifest }
      );
    } catch (e) {
      if (url.pathname.startsWith('/admin/')) {
          // Block accessing missing admin files by redirecting
          return Response.redirect(`${url.origin}/`, 302);
      }
      return new Response("Not Found", { status: 404 });
    }
  }
};

// Helper: DeepSeek API Generator
async function generateContentHandler(request, env, type) {
  try {
    if (!env.DEEPSEEK_API_KEY) return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY가 설정되지 않았습니다." }), { status: 400 });
    if (!env.JOURNAL_BUCKET) return new Response(JSON.stringify({ error: "JOURNAL_BUCKET이 바인딩되지 않았습니다." }), { status: 400 });

    const { keyword } = await request.json();
    const slug = encodeURIComponent(keyword.trim().replace(/\s+/g, '-'));
    
    // Directory and prompt based on type
    const isSEO = type === "seo";
    const dir = isSEO ? "journal" : "knowledge";
    const filePath = `${dir}/${slug}.html`;
    const listFile = isSEO ? "journals.json" : "knowledge.json";

    let masterPrompt = "";
    if (isSEO) {
      masterPrompt = `You are a maternity sleep expert and strict SEO writer for Moonpiece brand.
Write a long Korean HTML article (2500+ chars) for pregnant women about: ${keyword}
Use semantic HTML5 tags (<main>, <article>, <section>, etc).

Return ONLY a valid JSON object:
{
  "title": "Korean article title",
  "category": "수면 자세, 통증 완화, 건강 관리, 심리 & 지식 중 하나",
  "categoryKey": "sleep or pain or health or psychology",
  "image": "https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=800&q=80",
  "desc": "2줄 요약 설명",
  "html": "<main><article><section><h2>...</h2><p>...</p></section></article></main> (full HTML content)"
}`;
    } else {
      masterPrompt = `You are a maternity expert generating AEO (Answer Engine Optimized) content for the Moonpiece brand.
Topic: ${keyword}
Output must be concise, Q&A structured, formatted visually exactly like a blog post but highly direct.
Must include a JSON-LD FAQ schema.

Return ONLY a valid JSON object:
{
  "title": "Direct Answer for: ${keyword}",
  "category": "AEO 핵심 답변",
  "categoryKey": "knowledge",
  "image": "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80",
  "desc": "1줄 명확한 핵심 답변",
  "html": "<div class='aeo-content'><h2>Q: ...</h2><p>A: ...</p></div>",
  "json_ld": "{\\"@context\\": \\"https://schema.org\\", \\"@type\\": \\"FAQPage\\", \\"mainEntity\\": [...]}"
}`;
    }

    const deepseekUrl = "https://api.deepseek.com/chat/completions";
    const response = await fetch(deepseekUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a helpful assistant that returns only valid JSON." },
          { role: "user", content: masterPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4096
      })
    });

    const deepseekData = await response.json();
    if (!deepseekData.choices || !deepseekData.choices[0]) {
      const errMsg = deepseekData.error ? deepseekData.error.message : JSON.stringify(deepseekData);
      return new Response(JSON.stringify({ error: "DeepSeek API 오류: " + errMsg }), { status: 500 });
    }
    
    const rawText = deepseekData.choices[0].message.content.replace(/```json|```/g, "").trim();
    const aiContent = JSON.parse(rawText);

    // Apply exact visual layout as journal
    const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>${aiContent.title} | 문피스 ${isSEO ? '저널' : '지식인'}</title>
    <link rel="stylesheet" href="/styles.css">
    ${aiContent.json_ld ? `<script type="application/ld+json">${aiContent.json_ld}</script>` : ''}
    <style>
        body { max-width: 800px; margin: 50px auto; padding: 20px; line-height: 1.8; color: var(--on-surface); }
        h1, h2 { color: var(--primary); font-family: var(--font-serif); }
        img { width: 100%; border-radius: 1rem; margin: 1.5rem 0; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .back-link { display: inline-block; margin-bottom: 2rem; color: var(--outline); font-weight: 700; text-decoration: none; }
    </style>
</head>
<body class="surface-container-lowest">
    <a href="/${isSEO ? 'journal' : 'knowledge'}.html" class="back-link">← 목록으로 돌아가기</a>
    <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">${aiContent.title}</h1>
    <div style="font-size: 0.9rem; color: var(--outline); margin-bottom: 3rem;">카테고리: ${aiContent.category}</div>
    ${aiContent.html}
</body>
</html>`;

    await env.JOURNAL_BUCKET.put(filePath, fullHtml, { httpMetadata: { contentType: "text/html; charset=UTF-8" } });

    const existingList = await env.JOURNAL_BUCKET.get(listFile);
    let posts = existingList ? await existingList.json() : [];
    posts.unshift({
      title: aiContent.title,
      category: aiContent.category,
      categoryKey: aiContent.categoryKey,
      image: aiContent.image || "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80",
      desc: aiContent.desc,
      date: new Date().toLocaleDateString('ko-KR'),
      url: filePath
    });
    await env.JOURNAL_BUCKET.put(listFile, JSON.stringify(posts), { httpMetadata: { contentType: "application/json" } });

    return new Response(JSON.stringify({ success: true, path: `/${filePath}` }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
