const axios = require('axios');

const BASE_URL = 'http://localhost:8787'; // Assuming wrangler dev is running or similar
const COOKIE = 'admin_session=wookhong_verified';

async function run() {
    console.log("--- 1. Clearing old data ---");
    await axios.post(`${BASE_URL}/admin/api/migrate/clear-all`, {}, { headers: { Cookie: COOKIE } });
    console.log("Data cleared.");

    console.log("--- 2. Generating SEO Journal Posts (4) ---");
    const seoPosts = [
        { kw: "임산부 환도선다 완화 방법", slug: "maternity-pelvic-pain-relief", cat: "pain" },
        { kw: "임신 초기 불면증 극복 가이드", slug: "early-pregnancy-insomnia-guide", cat: "sleep" },
        { kw: "임산부 부종 예방과 마사지 팁", slug: "maternity-edema-prevention", cat: "health" },
        { kw: "임신 중기 허리 통증 방지 수면 자세", slug: "second-trimester-back-pain-sleep", cat: "sleep" }
    ];

    for (const p of seoPosts) {
        console.log(`Generating Journal: ${p.kw}...`);
        const res = await axios.post(`${BASE_URL}/admin/api/generate-journal`, {
            keyword: p.kw,
            title: `[임산부 가이드] ${p.kw} (2026 최신판)`,
            slug: p.slug,
            subKeywords: "임산부 통증, 숙면 꿀팁, 태교, 바디필로우, 임신 중기",
            category: p.cat,
            draft: false // Direct publish for automation
        }, { headers: { Cookie: COOKIE } });
        console.log(`Done: ${res.data.path} (Score: ${res.data.score})`);
    }

    console.log("--- 3. Generating AEO Knowledge Posts (4) ---");
    const aeoPosts = [
        { kw: "임산부가 왼쪽으로 누워 자야 하는 의학적 이유는?", slug: "why-pregnant-sleep-on-left", cat: "sleep" },
        { kw: "임산부 바디필로우 사용 시기, 언제부터가 적당할까?", slug: "when-to-use-maternity-body-pillow", cat: "health" },
        { kw: "임신 중 엎드려 자면 아기에게 위험한가요?", slug: "sleeping-on-stomach-pregnancy-safety", cat: "sleep" },
        { kw: "임산부 태동이 밤에 더 심하게 느껴지는 이유", slug: "why-fetal-movement-stronger-at-night", cat: "psychology" }
    ];

    for (const p of aeoPosts) {
        console.log(`Generating Knowledge: ${p.kw}...`);
        const res = await axios.post(`${BASE_URL}/admin/api/generate-knowledge`, {
            keyword: p.kw,
            title: p.kw,
            slug: p.slug,
            category: p.cat,
            draft: false
        }, { headers: { Cookie: COOKIE } });
        console.log(`Done: ${res.data.path}`);
    }

    console.log("--- All tasks completed successfully. ---");
}

run().catch(e => console.error(e.message));
