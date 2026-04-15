// Using global fetch (Node 24+)

const BASE_URL = 'https://moonpiece.co.kr';
const AUTH_COOKIE = 'admin_session=wookhong_verified';

async function generateAndPublish(keyword, title, slug) {
    console.log(`\n--- Processing: ${keyword} ---`);
    
    // 1. Generate Draft
    console.log("Generating draft...");
    const genRes = await fetch(`${BASE_URL}/admin/api/generate-knowledge`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': AUTH_COOKIE
        },
        body: JSON.stringify({
            type: 'aeo',
            keyword: keyword,
            title: title,
            slug: slug,
            category: 'health',
            draft: true
        })
    });
    
    const genData = await genRes.json();
    if (!genData.success) {
        console.error("Draft generation failed:", genData.error);
        return;
    }
    
    console.log("Draft generated successfully. Score:", genData.draft.score);
    
    // 2. Publish
    console.log("Publishing final post...");
    const pubRes = await fetch(`${BASE_URL}/admin/api/generate-knowledge`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': AUTH_COOKIE
        },
        body: JSON.stringify({
            ...genData.draft,
            type: 'aeo',
            finalHtml: genData.draft.html,
            isFinal: true,
            category: 'health'
        })
    });
    
    const pubData = await pubRes.json();
    if (!pubData.success) {
        console.error("Publishing failed:", pubData.error);
        return;
    }
    
    console.log("Published successfully! Path:", pubData.path);
    return pubData.path;
}

async function verify(path) {
    console.log(`Verifying ${path}...`);
    const res = await fetch(`${BASE_URL}${path}`);
    const html = await res.text();
    
    const hasH1 = html.includes('<h1>');
    const hasSummary = html.includes('aeo-summary-box');
    const hasHowTo = html.includes('"@type":"HowTo"');
    const hasFAQ = html.includes('"@type":"FAQPage"');
    const hasArticle = html.includes('"@type":"Article"');
    
    console.log("- H1 exists:", hasH1);
    console.log("- aeo-summary-box exists:", hasSummary);
    console.log("- HowTo Schema exists:", hasHowTo);
    console.log("- FAQ Schema exists:", hasFAQ);
    console.log("- Article Schema exists:", hasArticle);
}

async function main() {
    try {
        const path1 = await generateAndPublish(
            "임산부 복통 원인", 
            "임산부 복통의 주요 원인과 시기별 특징은 무엇인가요?", 
            "pregnancy-abdominal-pain-test"
        );
        if (path1) await verify(path1);
        
        const path2 = await generateAndPublish(
            "임산부 튼살 관리법", 
            "임산부 튼살을 효과적으로 예방하고 관리하는 방법은?", 
            "pregnancy-stretch-marks-care-test"
        );
        if (path2) await verify(path2);
        
    } catch (e) {
        console.error("Test failed:", e);
    }
}

main();
