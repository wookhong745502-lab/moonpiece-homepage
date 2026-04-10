const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'knowledge.html');
let content = fs.readFileSync(file, 'utf8');

// Title & Meta
content = content.replace(/<title>임산부 저널 \| Moonpiece Pregnancy Lab<\/title>/, '<title>임산부 지식인 | Moonpiece Pregnancy Lab</title>');
content = content.replace(/<h1 class="font-serif mb-6" style="font-size: 3.5rem; color: var(--primary);">임산부 저널<\/h1>/, '<h1 class="font-serif mb-6" style="font-size: 3.5rem; color: var(--primary);">임산부 지식인</h1>');
content = content.replace(/건강한 숙면을 위한 11년의 연구 데이터/, '어디서도 알려주지 않는 임산부 실전 Q&A');
content = content.replace(/문피스 수면연구소가 전하는 과학적인 휴식 가이드입니다/, '문피스가 빅데이터와 전문가 지식으로 가장 정확한 답변을 드립니다');

// Nav active toggle
// Since the previous script added knowledge.html, let's fix the active classes.
// First remove active from journal.html
content = content.replace(/<a href="journal\.html" class="nav-link active">임산부 저널<\/a>/g, '<a href="journal.html" class="nav-link">임산부 저널</a>');
// Then add active to knowledge.html
content = content.replace(/<a href="knowledge\.html" class="nav-link">임산부 지식인<\/a>/g, '<a href="knowledge.html" class="nav-link active">임산부 지식인</a>');

// JS Data Fetch
content = content.replace(/\/list-journals/g, '/list-knowledge');
content = content.replace(/journalPosts/g, 'knowledgePosts');

// Wipe the static array dummy data, we will just start with an empty array or basic AEO data
content = content.replace(/let knowledgePosts = \[[\s\S]*?\];/, `let knowledgePosts = [];`);

fs.writeFileSync(file, content, 'utf8');
console.log('Updated knowledge.html');
