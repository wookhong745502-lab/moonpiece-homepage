export async function onRequestPost(context) {
  const { request, env } = context;

  let keyword = "";
  try {
    const body = await request.json();
    keyword = body.keyword;
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  if (!keyword) return new Response(JSON.stringify({ error: "Keyword required" }), { status: 400 });

  const slug = keyword.toLowerCase().trim().replace(/\s+/g, '-');
  const filePath = `journal/${slug}.html`;

  const masterPrompt = `You are a maternity sleep expert, SEO strategist, and helpful content writer for the Moonpiece brand.
Write a long Korean HTML article for pregnant women.
Keyword: ${keyword}

Rules:
- 2500+ chars
- <h1>, <h2>, <p>, <ul>, <li>, <img>
- FAQ section
- Internal links to /why /buy /journal
- Include phrases:
  "많은 임산부들이 실제로 이렇게 말합니다"
  "상담을 하다 보면 이런 경우가 많습니다"

Insert 3~5 images:
<img src="IMAGE_URL" alt="description" />
And HTML comment IMAGE_PROMPT above each.

Return HTML only.`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
  
  const geminiRes = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: masterPrompt }] }]
    })
  });

  if (!geminiRes.ok) return new Response(JSON.stringify({ error: "Gemini API failure" }), { status: 500 });

  const data = await geminiRes.json();
  let articleHtml = data.candidates[0].content.parts[0].text.replace(/```html|```/g, "").trim();

  const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${keyword} | 문피스 임산부 저널</title>
<meta name="description" content="${keyword}에 관한 임산부 건강 및 수면 전문가 가이드입니다.">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { font-family: 'Noto Serif KR', serif; line-height: 1.8; color: #444; max-width: 800px; margin: 0 auto; padding: 3rem 1.5rem; }
h1 { font-size: 2.8rem; color: #4a3c31; margin-bottom: 2rem; border-bottom: 2px solid #f2e9e1; padding-bottom: 1rem; }
h2 { font-size: 2rem; color: #4a3c31; margin-top: 4rem; }
p { margin-bottom: 1.5rem; font-size: 1.15rem; }
img { width: 100%; border-radius: 2rem; margin: 3rem 0; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
ul { background: #fdfaf7; padding: 2.5rem; border-radius: 1.5rem; list-style-position: inside; }
li { margin-bottom: 1rem; font-size: 1.1rem; }
.footer-links { text-align: center; margin-top: 5rem; padding-top: 2rem; border-top: 1px solid #eee; display: flex; gap: 2rem; justify-content: center; }
.footer-links a { text-decoration: none; color: #8c7361; font-weight: bold; }
</style>
</head>
<body>
${articleHtml}
<div class="footer-links">
<a href="/why">편안함의 비밀</a>
<a href="/buy">구매하기</a>
<a href="/journal">임산부 저널</a>
</div>
</body>
</html>`;

  await env.JOURNAL_BUCKET.put(filePath, fullHtml, {
    httpMetadata: { contentType: "text/html" }
  });

  return new Response(JSON.stringify({ success: true, slug, path: `/${filePath}` }), { 
    headers: { "Content-Type": "application/json" } 
  });
}
