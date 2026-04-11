(async () => {
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': 'admin_session=wookhong_verified'
  };

  const tasks = [
    {
      url: 'https://moonpiece.co.kr/admin/api/generate-journal',
      payload: { keyword: '임산부 수면 자세', title: '임산부 수면 자세 완벽 가이드', slug: 'pregnant-sleep-positions', subKeywords: '임산부 꿀잠', sourceName: '', sourceUrl: '', category: 'sleep', locale: 'ko', mode: 'direct' }
    },
    {
      url: 'https://moonpiece.co.kr/admin/api/generate-journal',
      payload: { keyword: '임산부 바디필로우 추천', title: '임산부 바디필로우 올바른 선택 가이드', slug: 'maternity-pillow-guide', subKeywords: '문피스 바디필로우', sourceName: '', sourceUrl: '', category: 'sleep', locale: 'ko', mode: 'direct' }
    },
    {
      url: 'https://moonpiece.co.kr/admin/api/generate-knowledge',
      payload: { keyword: '임산부 왜 왼쪽으로 자나요?', slug: 'sleep-left-during-pregnancy', tone: 'professional', faq: 'on', category: 'sleep' }
    },
    {
      url: 'https://moonpiece.co.kr/admin/api/generate-knowledge',
      payload: { keyword: '임산부 초기 영양제 순위', slug: 'early-pregnancy-supplements', tone: 'professional', faq: 'on', category: 'health' }
    }
  ];

  for (const t of tasks) {
    try {
      console.log(`Requesting ${t.payload.keyword}...`);
      const res = await fetch(t.url, { method: 'POST', headers, body: JSON.stringify(t.payload) });
      const text = await res.text();
      console.log(`Result for ${t.payload.keyword}: ${res.status} ${text}`);
    } catch (e) {
      console.error(e);
    }
  }
})();
