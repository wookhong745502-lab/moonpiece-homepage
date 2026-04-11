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
  "image": "IMAGE_URL (Use high-quality Unsplash image relevant to keyword. Format: https://images.unsplash.com/photo-XXX?w=800&q=80)",
  "desc": "Short 2-line description for the list card",
  "html": "Full HTML article content (Use <h2>, <h3>, <p>, <ul>, <li>, <img> tags, 2500+ chars. Do NOT include <h1> or <html> tags here.)"
}

Rules for HTML:
- FAQ section included at the end
- Internal links to brand.html, journal.html
- Include phrases: "많은 임산부들이 실제로 이렇게 말합니다", "상담을 하다 보면 이런 경우가 많습니다"
- Insert 3~5 images with alt tags using keyword.

Return JSON only. No markdown formatting blocks.`;

  const deepseekUrl = "https://api.deepseek.com/chat/completions";
  
  const aiRes = await fetch(deepseekUrl, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "You are a helpful assistant that outputs JSON only." },
        { role: "user", content: masterPrompt }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!aiRes.ok) return new Response(JSON.stringify({ error: "DeepSeek API failure" }), { status: 500 });

  const aiData = await aiRes.json();
  let aiContent;
  try {
    const rawText = aiData.choices[0].message.content.replace(/```json|```/g, "").trim();
    aiContent = JSON.parse(rawText);
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to parse AI JSON response", detail: aiData.choices[0].message.content }), { status: 500 });
  }

  const { title, category, categoryKey, image, desc, html } = aiContent;

  const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | 문피스 임산부 저널</title>
    <meta name="description" content="${desc}">
    <link rel="stylesheet" href="../styles.css?v=1.3">
    <style>
        .article-content { max-width: 800px; margin: 0 auto; padding: 6rem 1.5rem; line-height: 2; color: var(--on-surface-variant); }
        .article-content h1 { font-size: 3rem; color: var(--primary); margin-bottom: 2rem; font-family: 'Noto Serif KR', serif; }
        .article-content h2 { font-size: 2rem; color: var(--primary); margin-top: 4rem; margin-bottom: 1.5rem; font-family: 'Noto Serif KR', serif; }
        .article-content h3 { font-size: 1.5rem; color: var(--on-surface); margin-top: 3rem; margin-bottom: 1rem; }
        .article-content p { margin-bottom: 2rem; font-size: 1.1rem; }
        .article-content img { width: 100%; border-radius: 2rem; margin: 3rem 0; box-shadow: var(--shadow-xl); }
        .article-content ul, .article-content ol { background: var(--surface-container-low); padding: 3rem; border-radius: 2rem; list-style-position: inside; margin: 2rem 0; }
        .article-content li { margin-bottom: 1rem; }
        .cta-box { background: var(--primary-container); color: var(--on-primary-container); padding: 4rem; border-radius: 2.5rem; text-align: center; margin-top: 6rem; }
    </style>
</head>
<body>
    <nav class="nav-bar">
        <div class="nav-container">
            <a href="../index.html" class="logo font-serif">Moonpiece</a>
            <div class="nav-links">
                <a href="../brand.html" class="nav-link">문피스의 약속</a>
                <a href="../review.html" class="nav-link">엄마들의 이야기</a>
                <a href="../journal.html" class="nav-link active">임산부 저널</a>
                <a href="../knowledge.html" class="nav-link">임산부 지식인</a>
            </div>
        </div>
    </nav>

    <main class="article-content">
        <div style="margin-bottom: 4rem;">
            <span class="px-4 py-2 rounded-full surface-container-high text-primary font-bold" style="font-size: 0.9rem;">${category}</span>
            <h1 style="margin-top: 1.5rem;">${title}</h1>
            <p style="color: var(--outline); font-size: 0.9rem;">문피스 수면연구소 · ${new Date().toLocaleDateString('ko-KR')}</p>
        </div>
        
        <img src="${image}" alt="${title}" style="margin-top:0;">

        ${html}

        <div class="cta-box">
            <h2 style="margin-top:0; color: inherit;">당신의 밤에 달빛 한 조각을 선물하세요</h2>
            <p>문피스 바디필로우는 임산부의 체형 변화를 연구하여 탄생했습니다.</p>
            <a href="https://smartstore.naver.com/moonwalk00/products/2416019050" target="_blank" class="btn-primary" style="display: inline-block; margin-top: 1rem;">스마트스토어에서 제품 보기</a>
        </div>
    </main>

    <footer style="margin-top: 10rem;">
        <div class="container" style="text-align: center; color: var(--on-surface-variant); font-size: 0.85rem; padding: 4rem 0; border-top: 1px solid var(--outline-variant);">
            <div class="logo font-serif mb-4" style="color: var(--primary);">Moonpiece</div>
            <p>© 2024 Moonpiece. All rights reserved.</p>
        </div>
    </footer>
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
