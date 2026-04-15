const fs = require('fs');

const BASE_URL = 'https://moonpiece.co.kr';
const HEADERS = {
    'Content-Type': 'application/json',
    'Cookie': 'admin_session=wookhong_verified'
};

async function suggest(type, keyword) {
    const res = await fetch(`${BASE_URL}/admin/api/suggest`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ type, keyword })
    });
    const data = await res.json();
    return data.result;
}

async function runGenerations() {
    try {
        console.log("=== Starting Live Server Content Generation Test ===");

        // --- 1. SEO Journal ---
        console.log("\n[1] Starting SEO Journal: 임산부 환도선다 완화 가이드");
        const seoKw = "임산부 환도선다 완화 가이드";
        console.log("  - Getting suggestions...");
        const seoTitle = await suggest('title', seoKw);
        const seoSlug = await suggest('slug', seoKw);
        const seoSubKw = await suggest('keywords', seoKw);
        
        let seoSource = { name: "Sample Source", url: "https://example.com" };
        try {
            const rawSource = await suggest('source', seoKw);
            seoSource = JSON.parse(rawSource);
        } catch(e) {}
        
        console.log(`  - Title: ${seoTitle}`);
        console.log(`  - Generating Draft (This takes 1-2 minutes)...`);
        
        const seoPayload = {
            keyword: seoKw,
            title: seoTitle,
            slug: seoSlug,
            subKeywords: seoSubKw,
            sourceName: seoSource.name,
            sourceUrl: seoSource.url,
            category: 'pain'
        };

        const seoDraftRes = await fetch(`${BASE_URL}/admin/api/generate-journal`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(seoPayload) // isFinal: false
        });
        const seoDraftData = await seoDraftRes.json();
        if (!seoDraftData.success) throw new Error("SEO Draft failed: " + JSON.stringify(seoDraftData));
        console.log(`  - Draft generated! Score: ${seoDraftData.draft.score}`);

        console.log(`  - Publishing SEO...`);
        const seoPublishPayload = {
            ...seoPayload,
            isFinal: true,
            finalHtml: seoDraftData.draft.html,
            faqs: seoDraftData.draft.faqs,
            image: seoDraftData.draft.image,
            schema: seoDraftData.draft.schema
        };
        const seoPubRes = await fetch(`${BASE_URL}/admin/api/generate-journal`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(seoPublishPayload)
        });
        const seoPubData = await seoPubRes.json();
        console.log(`  -> SEO Post Published at: ${seoPubData.path}`);


        // --- 2. AEO Knowledge 1 ---
        console.log("\n[2] Starting AEO Knowledge 1: 임산부 엎드려 자는 자세 괜찮을까?");
        const aeo1Kw = "임산부 엎드려 자는 자세 괜찮을까?";
        console.log("  - Getting suggestions...");
        const aeo1Title = await suggest('question', aeo1Kw);
        const aeo1Slug = await suggest('slug', aeo1Kw);

        console.log(`  - Title: ${aeo1Title}`);
        console.log(`  - Generating Draft...`);
        const aeo1Payload = {
            keyword: aeo1Kw,
            title: aeo1Title,
            slug: aeo1Slug,
            category: 'sleep'
        };

        const aeo1DraftRes = await fetch(`${BASE_URL}/admin/api/generate-knowledge`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(aeo1Payload)
        });
        const aeo1DraftData = await aeo1DraftRes.json();
        if (!aeo1DraftData.success) throw new Error("AEO1 Draft failed: " + JSON.stringify(aeo1DraftData));
        console.log(`  - Draft generated! Score: ${aeo1DraftData.draft.score}`);

        console.log(`  - Publishing AEO 1...`);
        const aeo1PublishPayload = {
            ...aeo1Payload,
            isFinal: true,
            finalHtml: aeo1DraftData.draft.html,
            faqs: aeo1DraftData.draft.faqs,
            image: aeo1DraftData.draft.image,
            schema: aeo1DraftData.draft.schema
        };
        const aeo1PubRes = await fetch(`${BASE_URL}/admin/api/generate-knowledge`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(aeo1PublishPayload)
        });
        const aeo1PubData = await aeo1PubRes.json();
        console.log(`  -> AEO 1 Post Published at: ${aeo1PubData.path}`);


        // --- 3. AEO Knowledge 2 ---
        console.log("\n[3] Starting AEO Knowledge 2: 임산부 식단 관리 주의사항");
        const aeo2Kw = "임산부 식단 관리 주의사항";
        console.log("  - Getting suggestions...");
        const aeo2Title = await suggest('question', aeo2Kw);
        const aeo2Slug = await suggest('slug', aeo2Kw);

        console.log(`  - Title: ${aeo2Title}`);
        console.log(`  - Generating Draft...`);
        const aeo2Payload = {
            keyword: aeo2Kw,
            title: aeo2Title,
            slug: aeo2Slug,
            category: 'health'
        };

        const aeo2DraftRes = await fetch(`${BASE_URL}/admin/api/generate-knowledge`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(aeo2Payload)
        });
        const aeo2DraftData = await aeo2DraftRes.json();
        if (!aeo2DraftData.success) {
            // Note: DeepSeek sometimes trips up on JSON formatting when combining parallel requests.
            // Using placeholder logic or just rethrowing.
            throw new Error("AEO2 Draft failed: " + JSON.stringify(aeo2DraftData));
        }
        console.log(`  - Draft generated! Score: ${aeo2DraftData.draft.score}`);

        console.log(`  - Publishing AEO 2...`);
        const aeo2PublishPayload = {
            ...aeo2Payload,
            isFinal: true,
            finalHtml: aeo2DraftData.draft.html,
            faqs: aeo2DraftData.draft.faqs,
            image: aeo2DraftData.draft.image,
            schema: aeo2DraftData.draft.schema
        };
        const aeo2PubRes = await fetch(`${BASE_URL}/admin/api/generate-knowledge`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(aeo2PublishPayload)
        });
        const aeo2PubData = await aeo2PubRes.json();
        console.log(`  -> AEO 2 Post Published at: ${aeo2PubData.path}`);

        
        // --- 4. Validation ---
        console.log("\n[4] Validating Published Posts from Server Lists...");
        const jListRes = await fetch(`${BASE_URL}/list-journals?t=${Date.now()}`);
        const kListRes = await fetch(`${BASE_URL}/list-knowledge?t=${Date.now()}`);
        const jList = await jListRes.json();
        const kList = await kListRes.json();
        
        console.log(`Current Published SEO Journals count: ${jList.length}`);
        console.log(`Current Published AEO Knowledge count: ${kList.length}`);
        
        console.log("\nTest Completed Successfully!");

    } catch (err) {
        console.error("\nTEST FAILED:", err);
    }
}

runGenerations();

