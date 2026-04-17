
const baseUrl = "https://moonpiece.co.kr"; // Change to your actual domain if needed

async function testGeneration() {
    console.log("--- Starting SEO Generation Test ---");
    const seoRes = await fetch(`${baseUrl}/admin/api/generate-journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            keyword: "임산부 수면 부족",
            title: "임산부 수면 부족 해결을 위한 7가지 수면 위생 가이드",
            slug: "pregnancy-sleep-deprivation-guide",
            category: "sleep"
        })
    });
    const seoData = await seoRes.json();
    if (seoData.success) {
        console.log("SEO Draft Generated:", seoData.draft.title);
        // Publish SEO
        const pubRes = await fetch(`${baseUrl}/admin/api/posts/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...seoData.draft,
                type: 'seo',
                category: 'sleep'
            })
        });
        const pubData = await pubRes.json();
        console.log("SEO Publish Result:", pubData);
    } else {
        console.error("SEO Generation Failed:", seoData.error);
    }

    console.log("\n--- Starting AEO Generation Test ---");
    const aeoRes = await fetch(`${baseUrl}/admin/api/generate-knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            keyword: "임신 중 왼쪽으로 자는 이유",
            title: "임산부가 궁금한 수면 지식: 왜 꼭 왼쪽으로 자야 하나요?",
            slug: "why-pregnant-sleep-left-side",
            category: "sleep"
        })
    });
    const aeoData = await aeoRes.json();
    if (aeoData.success) {
        console.log("AEO Draft Generated:", aeoData.draft.title);
        // Publish AEO
        const pubRes = await fetch(`${baseUrl}/admin/api/posts/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...aeoData.draft,
                type: 'aeo',
                category: 'sleep'
            })
        });
        const pubData = await pubRes.json();
        console.log("AEO Publish Result:", pubData);
    } else {
        console.error("AEO Generation Failed:", aeoData.error);
    }
}

testGeneration();
