// using native fetch

const BASE_URL = 'https://moonpiece.co.kr';
const HEADERS = {
    'Content-Type': 'application/json',
    'Cookie': 'admin_session=wookhong_verified'
};

async function clearData() {
    console.log('Clearing old data...');
    const res = await fetch(`${BASE_URL}/admin/api/migrate/clear-all`, {
        method: 'POST',
        headers: HEADERS
    });
    console.log('Clear response:', await res.json());
}

async function generateFlow(type, config) {
    console.log(`Starting ${type} generation: ${config.keyword}...`);
    const endpoint = type === 'seo' ? '/admin/api/generate-journal' : '/admin/api/generate-knowledge';
    
    const draftPayload = {
        type,
        keyword: config.keyword,
        title: config.title,
        slug: config.slug,
        subKeywords: config.subKeywords || '',
        sourceName: config.sourceName || '',
        sourceUrl: config.sourceUrl || '',
        category: config.category,
        draft: true
    };
    
    // Step 1: Generate Draft
    console.log(`  - Requesting draft...`);
    const draftRes = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(draftPayload)
    });
    
    if(!draftRes.ok) throw new Error(`Draft Request Failed: ${draftRes.status}`);
    const data = await draftRes.json();
    if(!data.success) throw new Error(`Draft Failed: ${JSON.stringify(data.error)}`);
    console.log(`  - Draft Success! (Score: ${data.draft.score})`);
    
    // Step 2: Publish Final
    console.log(`  - Requesting publish...`);
    const publishPayload = {
        ...data.draft,
        type,
        finalHtml: data.draft.html,
        isFinal: true,
        category: config.category
    };
    
    const pubRes = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(publishPayload)
    });
    
    const pubData = await pubRes.json();
    if(!pubData.success) throw new Error(`Publish Failed: ${JSON.stringify(pubData.error)}`);
    console.log(`  - Publish Success! Path: ${pubData.path}\n`);
}

async function main() {
    try {
        await clearData();
        
        // SEO 1
        await generateFlow('seo', {
            keyword: '임신 후기 튼살 예방',
            title: '[임산부 가이드] 붉은 튼살이 시작되기 전 완벽 예방 크림 활용법 (2026 최신판)',
            slug: 'pregnancy-stretch-marks-prevention',
            subKeywords: '임산부 튼살, 튼살크림 바르는 시기, 임신 후기 튼살, 튼살 오일, 복부 튼살관리',
            sourceName: '의학 전문 사이트',
            sourceUrl: 'https://health.com',
            category: 'health'
        });

        // SEO 2
        await generateFlow('seo', {
            keyword: '임산부 불면증 바디필로우',
            title: '밤새 뒤척이는 당신을 위한 임산부 바디필로우 완전 정복: 숙면을 위한 형태학적 분석',
            slug: 'maternity-pillow-insomnia-guide',
            subKeywords: '바디필로우 추천, U자형 바디필로우, 임산부 수면자세, 왼쪽수면, 불면증 극복',
            sourceName: '최신 연구 문헌',
            sourceUrl: 'https://research.org',
            category: 'sleep'
        });

        // AEO 1
        await generateFlow('aeo', {
            keyword: '임산부 똑바로 자면 안되나요',
            title: '임산부 똑바로 자면 아기에게 무리가 갈까요? 의학적 답변',
            slug: 'sleeping-on-back-during-pregnancy',
            category: 'sleep'
        });

        // AEO 2
        await generateFlow('aeo', {
            keyword: '임산부 다리 쥐나는 원인',
            title: '밤마다 다리에 쥐가 나는 이유는 무엇인가요? 즉각적인 대처법',
            slug: 'pregnancy-leg-cramps-causes-solutions',
            category: 'pain'
        });

        console.log('All generation sequences complete.');
    } catch (e) {
        console.error('Error in sequence:', e);
    }
}

main();
