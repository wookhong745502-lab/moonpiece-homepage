export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. 저널 목록 조회 (GET /list-journals)
    if (url.pathname === "/list-journals" && request.method === "GET") {
      try {
        if (!env.JOURNAL_BUCKET) {
          return new Response(JSON.stringify({ error: "JOURNAL_BUCKET이 바인딩되지 않았습니다. Cloudflare 대시보드에서 R2 버킷을 연결해 주세요." }), { 
            status: 500, headers: { "Content-Type": "application/json" } 
          });
        }
        const existing = await env.JOURNAL_BUCKET.get("journals.json");
        const data = existing ? await existing.json() : [];
        return new Response(JSON.stringify(data), { 
          headers: { "Content-Type": "application/json" } 
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, headers: { "Content-Type": "application/json" } 
        });
      }
    }

    // 2. AI 저널 생성 및 발행 (POST /generate-journal)
    if (url.pathname === "/generate-journal" && request.method === "POST") {
      try {
        if (!env.GEMINI_API_KEY) {
          return new Response(JSON.stringify({ error: "GEMINI_API_KEY 환경 변수가 없습니다." }), { status: 400 });
        }
        if (!env.JOURNAL_BUCKET) {
          return new Response(JSON.stringify({ error: "JOURNAL_BUCKET R2 바인딩이 없습니다." }), { status: 400 });
        }

        const { keyword } = await request.json();
        const slug = encodeURIComponent(keyword.trim().replace(/\s+/g, '-'));
        const filePath = `journal/${slug}.html`;

        const masterPrompt = `You are a maternity sleep expert, SEO strategist, and helpful content writer for the Moonpiece brand.
Write a long Korean HTML article for pregnant women and provide metadata for the list view.
Keyword: ${keyword}

[OUTPUT FORMAT — JSON ONLY]
Return ONLY a valid JSON object with the following structure:
{
  "title": "Article Title (Korean)",
  "category": "Category Name (e.g., 수면 자세, 통증 완화, 건강 관리, 심리 & 지식)",
  "categoryKey": "Category Key (e.g., sleep, pain, health, psychology)",
  "image": "IMAGE_URL (Use high-quality Unsplash image relevant to keyword)",
  "desc": "Short 2-line description for the list card",
  "html": "Full HTML article content (Use <h1>, <h2>, <p>, <ul>, <li>, <img> tags, 2500+ chars)"
}

Rules for HTML:
- Internal links to /why /buy /journal
- High authority medical-style insights.
Return JSON only. No markdown formatting.`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: masterPrompt }] }] })
        });

        const geminiData = await geminiRes.json();
        const rawText = geminiData.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
        const aiContent = JSON.parse(rawText);

        const { title, category, categoryKey, image, desc, html } = aiContent;

        const fullHtml = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${title} | 문피스</title><style>body{font-family:'Noto Serif KR',serif;line-height:1.8;color:#444;max-width:800px;margin:0 auto;padding:3rem 1.5rem;}img{width:100%;border-radius:2rem;margin:2rem 0;}</style></head><body>${html}</body></html>`;

        // 1. 개별 기사 저장
        await env.JOURNAL_BUCKET.put(filePath, fullHtml, {
          httpMetadata: { contentType: "text/html; charset=UTF-8" }
        });

        // 2. 목록 업데이트
        const existingList = await env.JOURNAL_BUCKET.get("journals.json");
        let journals = existingList ? await existingList.json() : [];
        journals.unshift({ title, category, categoryKey, image, date: new Date().toLocaleDateString('ko-KR').replace(/ /g, ''), desc, url: filePath });
        await env.JOURNAL_BUCKET.put("journals.json", JSON.stringify(journals), {
          httpMetadata: { contentType: "application/json; charset=UTF-8" }
        });

        return new Response(JSON.stringify({ success: true, slug, path: `/${filePath}` }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, headers: { "Content-Type": "application/json" } 
        });
      }
    }

    // 3. 정적 파일 서빙 (Assets)
    return env.ASSETS.fetch(request);
  }
};
