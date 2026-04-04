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
Write a long Korean HTML article for pregnant women and provide metadata for the list view.
Keyword: ${keyword}

[OUTPUT FORMAT — JSON ONLY]
Return ONLY a valid JSON object with the following structure:
{
  "title": "Article Title",
  "category": "Category Name (e.g., 수면 자세, 통증 완화, 건강 관리, 심리 & 지식)",
  "categoryKey": "Category Key (e.g., sleep, pain, health, psychology)",
  "image": "IMAGE_URL (Use high-quality Unsplash image relevant to keyword)",
  "desc": "Short 2-line description for the list card",
  "html": "Full HTML article content (Use <h1>, <h2>, <p>, <ul>, <li>, <img> tags, 2500+ chars)"
}

Rules for HTML:
- FAQ section included
- Internal links to /why /buy /journal
- Include phrases: "많은 임산부들이 실제로 이렇게 말합니다", "상담을 하다 보면 이런 경우가 많습니다"
- Insert 3~5 images with alt tags.

Return JSON only. No markdown formatting blocks like \`\`\`json.`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
  
  const geminiRes = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: masterPrompt }] }]
    })
  });

  if (!geminiRes.ok) return new Response(JSON.stringify({ error: "Gemini API failure" }), { status: 500 });

  const geminiData = await geminiRes.json();
  let aiContent;
  try {
    const rawText = geminiData.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
    aiContent = JSON.parse(rawText);
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to parse AI JSON response", detail: geminiData.candidates[0].content.parts[0].text }), { status: 500 });
  }

  const { title, category, categoryKey, image, desc, html } = aiContent;

  const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${title} | 문피스 임산부 저널</title>
<meta name="description" content="${desc}">
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
${html}
<div class="footer-links">
<a href="/why">편안함의 비밀</a>
<a href="/buy">구매하기</a>
<a href="/journal">임산부 저널</a>
</div>
</body>
</html>`;

  // 1. 개별 HTML 기사 저장
  await env.JOURNAL_BUCKET.put(filePath, fullHtml, {
    httpMetadata: { contentType: "text/html; charset=UTF-8" }
  });

  // 2. journals.json 메타데이터 목록 업데이트
  const listFile = "journals.json";
  let journals = [];
  try {
    const existing = await env.JOURNAL_BUCKET.get(listFile);
    if (existing) {
      journals = await existing.json();
    }
  } catch (e) { journals = []; }

  const newItem = {
    title,
    category,
    categoryKey,
    image,
    date: new Date().toLocaleDateString('ko-KR').replace(/ /g, ''),
    desc,
    url: filePath
  };

  // 신규 항목을 맨 앞으로 추가 (최신순)
  journals.unshift(newItem);

  await env.JOURNAL_BUCKET.put(listFile, JSON.stringify(journals), {
    httpMetadata: { contentType: "application/json; charset=UTF-8" }
  });

  return new Response(JSON.stringify({ success: true, slug, path: `/${filePath}` }), { 
    headers: { "Content-Type": "application/json" } 
  });
}
