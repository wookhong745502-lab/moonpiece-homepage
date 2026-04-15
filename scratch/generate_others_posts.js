// '기타' 카테고리 포스트 4개 자동 생성 스크립트
// SEO 저널 2개 + AEO 지식인 2개

const BASE = 'http://127.0.0.1:8787';

const SEO_POSTS = [
  { keyword: '임산부 출산 가방 준비 리스트', category: 'others' },
  { keyword: '임산부 여행 체크리스트 주의사항', category: 'others' }
];

const AEO_POSTS = [
  { keyword: '임산부 카페인 섭취', category: 'others' },
  { keyword: '임산부 영양제 복용 순서', category: 'others' }
];

// 세션 쿠키 저장
let sessionCookie = '';

async function fetchJSON(url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (sessionCookie) headers['Cookie'] = sessionCookie;
  
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    redirect: 'manual'
  });
  
  // Capture Set-Cookie header
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    sessionCookie = setCookie.split(';')[0]; // e.g., admin_session=wookhong_verified
    console.log('  🍪 세션 쿠키 저장:', sessionCookie);
  }
  
  // Handle redirects (auth failures)
  if (res.status === 302) {
    throw new Error(`인증 실패 (302 Redirect to ${res.headers.get('location')})`);
  }
  
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('  ⚠️ JSON parse error. Response:', text.substring(0, 200));
    throw e;
  }
}

async function suggest(type, keyword) {
  const data = await fetchJSON(`${BASE}/admin/api/suggest`, { type, keyword });
  return data.result;
}

async function generateSEOPost(post, index) {
  console.log(`\n=== SEO 포스트 ${index + 1} 생성 시작: "${post.keyword}" ===`);
  
  console.log('  [1/3] 자동 완성 중...');
  const [title, slug, keywords, sourceRaw] = await Promise.all([
    suggest('title', post.keyword),
    suggest('slug', post.keyword),
    suggest('keywords', post.keyword),
    suggest('source', post.keyword)
  ]);
  
  let sourceName = '', sourceUrl = '';
  try {
    const s = JSON.parse(sourceRaw);
    sourceName = s.name;
    sourceUrl = s.url;
  } catch { sourceName = 'WHO'; sourceUrl = 'https://www.who.int'; }
  
  console.log(`  제목: ${title}`);
  console.log(`  슬러그: ${slug}`);
  
  console.log('  [2/3] 초안 생성 중... (10~30초 소요)');
  const draftRes = await fetchJSON(`${BASE}/admin/api/generate-journal`, {
    type: 'seo', keyword: post.keyword, title, slug,
    subKeywords: keywords, sourceName, sourceUrl,
    category: post.category, draft: true
  });
  
  if (!draftRes.success) {
    console.error(`  ❌ 초안 생성 실패:`, draftRes.error);
    return false;
  }
  console.log(`  ✅ 초안 생성 완료 (점수: ${draftRes.draft.score})`);
  
  console.log('  [3/3] 배포 중...');
  const publishRes = await fetchJSON(`${BASE}/admin/api/generate-journal`, {
    ...draftRes.draft, type: 'seo', finalHtml: draftRes.draft.html,
    isFinal: true, category: post.category
  });
  
  if (!publishRes.success) {
    console.error(`  ❌ 배포 실패:`, publishRes.error);
    return false;
  }
  console.log(`  ✅ 배포 완료! 경로: ${publishRes.path}`);
  return true;
}

async function generateAEOPost(post, index) {
  console.log(`\n=== AEO 포스트 ${index + 1} 생성 시작: "${post.keyword}" ===`);
  
  console.log('  [1/3] 자동 완성 중...');
  const [question, slug] = await Promise.all([
    suggest('question', post.keyword),
    suggest('slug', post.keyword)
  ]);
  
  console.log(`  질문: ${question}`);
  console.log(`  슬러그: ${slug}`);
  
  console.log('  [2/3] 초안 생성 중... (10~30초 소요)');
  const draftRes = await fetchJSON(`${BASE}/admin/api/generate-knowledge`, {
    type: 'aeo', keyword: post.keyword, title: question, slug,
    subKeywords: '', sourceName: '', sourceUrl: '',
    category: post.category, draft: true
  });
  
  if (!draftRes.success) {
    console.error(`  ❌ 초안 생성 실패:`, draftRes.error);
    return false;
  }
  console.log(`  ✅ 초안 생성 완료`);
  
  console.log('  [3/3] 배포 중...');
  const publishRes = await fetchJSON(`${BASE}/admin/api/generate-knowledge`, {
    ...draftRes.draft, type: 'aeo', finalHtml: draftRes.draft.html,
    isFinal: true, category: post.category
  });
  
  if (!publishRes.success) {
    console.error(`  ❌ 배포 실패:`, publishRes.error);
    return false;
  }
  console.log(`  ✅ 배포 완료! 경로: ${publishRes.path}`);
  return true;
}

async function main() {
  console.log('🚀 기타 카테고리 포스트 4개 자동 생성 시작\n');
  
  // Auth bypass - 쿠키 캡처
  await fetchJSON(`${BASE}/admin/api/auth/verify`, { bypass: true });
  console.log('✅ 인증 완료\n');
  
  let successCount = 0;
  
  for (let i = 0; i < SEO_POSTS.length; i++) {
    try {
      if (await generateSEOPost(SEO_POSTS[i], i)) successCount++;
    } catch (e) { console.error(`  ❌ SEO ${i+1} 에러:`, e.message); }
  }
  
  for (let i = 0; i < AEO_POSTS.length; i++) {
    try {
      if (await generateAEOPost(AEO_POSTS[i], i)) successCount++;
    } catch (e) { console.error(`  ❌ AEO ${i+1} 에러:`, e.message); }
  }
  
  console.log(`\n========================================`);
  console.log(`🎯 전체 결과: ${successCount}/4 포스트 생성 완료`);
  console.log(`========================================`);
}

main().catch(console.error);
