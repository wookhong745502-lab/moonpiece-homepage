import { getAssetFromKV } from "@cloudflare/kv-asset-handler";
import manifestJSON from "__STATIC_CONTENT_MANIFEST";
const assetManifest = JSON.parse(manifestJSON);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 저널 목록 조회 (GET /list-journals)
    if (url.pathname === "/list-journals") {
      try {
        if (!env.JOURNAL_BUCKET) {
          return new Response(JSON.stringify([]), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
        const existing = await env.JOURNAL_BUCKET.get("journals.json");
        const data = existing ? await existing.json() : [];
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // 2. AI 저널 생성 및 발행 (POST /generate-journal)
    if (url.pathname === "/generate-journal" && request.method === "POST") {
      try {
        if (!env.GEMINI_API_KEY) {
          return new Response(JSON.stringify({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }), { status: 400 });
        }
        if (!env.JOURNAL_BUCKET) {
          return new Response(JSON.stringify({ error: "JOURNAL_BUCKET이 바인딩되지 않았습니다." }), { status: 400 });
        }

        const { keyword } = await request.json();
        const slug = encodeURIComponent(keyword.trim().replace(/\s+/g, '-'));
        const filePath = `journal/${slug}.html`;

        const masterPrompt = `You are a maternity sleep expert and SEO writer for Moonpiece brand.
Write a long Korean HTML article (2500+ chars) for pregnant women about: ${keyword}

Return ONLY a valid JSON object:
{
  "title": "Korean article title",
  "category": "카테고리 (수면 자세, 통증 완화, 건강 관리, 심리 & 지식 중 하나)",
  "categoryKey": "sleep or pain or health or psychology",
  "image": "https://images.unsplash.com/photo-VALID_ID?w=1200&q=80",
  "desc": "2줄 요약 설명",
  "html": "<h1>...</h1><p>...</p> full HTML content"
}`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: masterPrompt }] }] })
        });

        const geminiData = await response.json();
        const rawText = geminiData.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
        const aiContent = JSON.parse(rawText);

        const fullHtml = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${aiContent.title} | 문피스</title><link rel="stylesheet" href="/styles.css"><style>body{max-width:800px;margin:50px auto;line-height:1.8;padding:20px;}img{width:100%;border-radius:1rem;margin:1.5rem 0;}</style></head><body>${aiContent.html}</body></html>`;

        await env.JOURNAL_BUCKET.put(filePath, fullHtml, { httpMetadata: { contentType: "text/html; charset=UTF-8" } });

        const existingList = await env.JOURNAL_BUCKET.get("journals.json");
        let journals = existingList ? await existingList.json() : [];
        journals.unshift({
          title: aiContent.title,
          category: aiContent.category,
          categoryKey: aiContent.categoryKey,
          image: aiContent.image,
          desc: aiContent.desc,
          date: new Date().toLocaleDateString('ko-KR'),
          url: filePath
        });
        await env.JOURNAL_BUCKET.put("journals.json", JSON.stringify(journals), { httpMetadata: { contentType: "application/json" } });

        return new Response(JSON.stringify({ success: true, path: `/${filePath}` }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // 3. 정적 파일 서빙 (KV Asset Handler)
    try {
      return await getAssetFromKV(
        { request, waitUntil: ctx.waitUntil.bind(ctx) },
        { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: assetManifest }
      );
    } catch (e) {
      return new Response("Not Found", { status: 404 });
    }
  }
};
