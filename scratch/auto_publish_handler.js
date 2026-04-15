
// --- Auto-Publish Handler (Full Pipeline: Keyword -> Content -> Deploy) ---
async function autoPublishHandler(request, env, type) {
  const isSEO = type === "seo";
  const payload = await request.json();
  const { category, count = 1 } = payload;

  const categoryNameMap = { sleep: "\uC218\uBA74 \uC790\uC138", pain: "\uD1B5\uC99D \uC644\uD654", health: "\uAC74\uAC15 \uAD00\uB9AC", psychology: "\uC2EC\uB9AC & \uC9C0\uC2DD", others: "\uAE30\uD0C0" };
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
      ? `\uC784\uC0B0\uBD80 \uAD00\uB828 "${categoryName}" \uCE74\uD14C\uACE0\uB9AC\uC5D0\uC11C SEO \uBE14\uB85C\uADF8 \uAE00\uC744 \uC4F8 \uC218 \uC788\uB294 \uAD6C\uCCB4\uC801\uC778 \uD55C\uAD6D\uC5B4 \uD0A4\uC6CC\uB4DC ${count}\uAC1C\uB97C \uC0DD\uC131\uD558\uC138\uC694. \uAE30\uC874 \uC8FC\uC81C \uD53C\uD558\uAE30: [${existingTitles}]. Return ONLY a JSON array of strings. No explanation.`
      : `\uC784\uC0B0\uBD80\uB4E4\uC774 \uAC80\uC0C9\uD560 \uBC95\uD55C "${categoryName}" \uAD00\uB828 \uC9C8\uBB38\uD615 \uD55C\uAD6D\uC5B4 \uD0A4\uC6CC\uB4DC ${count}\uAC1C\uB97C \uC0DD\uC131\uD558\uC138\uC694. \uAE30\uC874 \uC8FC\uC81C \uD53C\uD558\uAE30: [${existingTitles}]. Return ONLY a JSON array of strings. No explanation.`;

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
            const sourceData = parseAIJson(metaResults[3].replace(/```json|```/gi, "").trim());
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
            html += `<div class="mt-12 p-8 bg-moon-50 border border-moon-100 rounded-3xl"><h4 class="font-bold text-lg mb-2 text-moon-900 flex items-center gap-2"><span class="material-symbols-outlined">library_books</span> \uCC38\uACE0 \uBB38\uD5CC \uBC0F \uC2E0\uB8B0\uB3C4 \uCD9C\uCC98</h4><p class="text-slate-600 mb-4 text-sm leading-relaxed">\uBCF8 \uCF58\uD150\uCE20\uB294 \uACF5\uC2E0\uB825 \uC788\uB294 \uC758\uD559 \uAE30\uAD00\uC758 \uAC80\uC99D\uB41C \uC790\uB8CC\uB97C \uBC14\uD0D5\uC73C\uB85C \uC791\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4.</p><a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="text-moon-600 hover:text-moon-900 font-bold underline inline-flex items-center gap-1 text-sm bg-white px-4 py-2 rounded-xl shadow-sm border border-moon-100">${sourceName} <span class="material-symbols-outlined" style="font-size:16px;">open_in_new</span></a></div>`;
          }
        } else {
          let imageResponse;
          let aiImgPrompt = `High-quality infographic for ${keyword}. Minimalist, professional.`;
          let altText = `${title} infographic`;
          let captionText = "";
          const imageMatch = html.match(/<!--\s*PROMPT:\s*(.*?)\s*-->[\s\S]*?!\[\[?(.*?)\]\]?\((.*?)\)[\s\S]*?\*(?:Caption:|caption:|\uCEA1\uC158:)?\s*(.*?)\*/i);
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
          { "@context": "https://schema.org", "@type": "Article", "headline": title, "image": heroImagePath, "author": { "@type": "Person", "name": "Moonpiece Editorial Board" }, "publisher": { "@type": "Organization", "name": "Moonpiece" }, "datePublished": new Date().toISOString(), "description": `${keyword} expert guide` }
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
        const finalPageHtml = await renderTemplate({ title, image: heroImagePath, html, faqs, schema: schemaArray }, env, isSEO ? '\uC784\uC0B0\uBD80 \uC800\uB110' : '\uC784\uC0B0\uBD80 \uC9C0\uC2DD\uC778');
        const filePath = `${isSEO ? 'journal' : 'knowledge'}/${slug}.html`;
        await env.JOURNAL_BUCKET.put(filePath, finalPageHtml, { httpMetadata: { contentType: "text/html; charset=UTF-8" } });

        const listKey = isSEO ? "journal/list.json" : "knowledge/list.json";
        let list = await safeGetJson(listKey);
        const summary = (html || "").replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        list.unshift({ title, category, date: new Date().toLocaleDateString('ko-KR'), url: `/${filePath}`, image: heroImagePath, desc: summary.length > 80 ? summary.substring(0, 80) + "..." : summary });
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
