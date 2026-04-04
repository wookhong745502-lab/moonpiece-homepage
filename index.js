export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 전역 바인딩 체크 (Error 1101 방지)
    if (!env.JOURNAL_BUCKET) {
      if (url.pathname === "/list-journals" || url.pathname === "/generate-journal") {
        return new Response(JSON.stringify({ 
          error: "JOURNAL_BUCKET R2 버킷이 바인딩되지 않았습니다. Cloudflare 대시보드 Settings -> Functions -> R2 Bucket Bindings에서 'JOURNAL_BUCKET' 이름으로 버킷을 연결해 주세요." 
        }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    // 1. 저널 목록 조회 (GET /list-journals)
    if (url.pathname === "/list-journals" && (request.method === "GET" || request.method === "OPTIONS")) {
      try {
        const existing = await env.JOURNAL_BUCKET.get("journals.json");
        const data = existing ? await existing.json() : [];
        return new Response(JSON.stringify(data), { 
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to fetch list: " + e.message }), { 
          status: 500, headers: { "Content-Type": "application/json" } 
        });
      }
    }

    // 2. AI 저널 생성 및 발행 (POST /generate-journal)
    if (url.pathname === "/generate-journal" && request.method === "POST") {
      try {
        if (!env.GEMINI_API_KEY) {
          return new Response(JSON.stringify({ error: "GEMINI_API_KEY 환경 변수가 대시보드에 설정되지 않았습니다." }), { status: 400 });
        }

        const { keyword } = await request.json();
        const slug = encodeURIComponent(keyword.trim().replace(/\s+/g, '-'));
        const filePath = `journal/${slug}.html`;

        const masterPrompt = `You are a maternity sleep expert and SEO writer for Moonpiece. Write a long Korean HTML article for: ${keyword}. Return ONLY JSON { "title", "category", "categoryKey", "image", "desc", "html" }`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: masterPrompt }] }] })
        });

        const geminiData = await response.json();
        const rawText = geminiData.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
        const aiContent = JSON.parse(rawText);

        const fullHtml = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${aiContent.title}</title><style>body{font-family:serif;max-width:800px;margin:50px auto;line-height:1.8;padding:20px;}</style></head><body>${aiContent.html}</body></html>`;

        await env.JOURNAL_BUCKET.put(filePath, fullHtml, { httpMetadata: { contentType: "text/html" } });

        const existingList = await env.JOURNAL_BUCKET.get("journals.json");
        let journals = existingList ? await existingList.json() : [];
        journals.unshift({ ...aiContent, date: new Date().toLocaleDateString('ko-KR'), url: filePath });
        await env.JOURNAL_BUCKET.put("journals.json", JSON.stringify(journals), { httpMetadata: { contentType: "application/json" } });

        return new Response(JSON.stringify({ success: true, path: `/${filePath}` }), { 
          headers: { "Content-Type": "application/json" } 
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "AI Generation failed: " + e.message }), { status: 500 });
      }
    }

    // 3. 정적 파일 서빙
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not Found", { status: 404 });
  }
};
