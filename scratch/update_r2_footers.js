const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function run() {
  const journalListPath = path.join(__dirname, 'journal_list_remote_temp.json');
  const knowledgeListPath = path.join(__dirname, 'knowledge_list_remote_temp.json');

  if (!fs.existsSync(journalListPath) || !fs.existsSync(knowledgeListPath)) {
    console.error("오류: 필요한 리스트 임시 파일이 없습니다.");
    process.exit(1);
  }

  const journals = JSON.parse(fs.readFileSync(journalListPath, 'utf8'));
  const knowledges = JSON.parse(fs.readFileSync(knowledgeListPath, 'utf8'));

  const allItems = [
    ...journals.map(item => ({ ...item, type: 'journal' })),
    ...knowledges.map(item => ({ ...item, type: 'knowledge' }))
  ];

  console.log(`총 ${allItems.length}개의 리소스가 발견되었습니다.`);

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const url = item.url;
    const key = url.startsWith('/') ? url.slice(1) : url;
    const tempFileName = `temp_r2_${key.replace(/\//g, '_')}`;
    const tempFilePath = path.join(__dirname, tempFileName);

    console.log(`\n[${i + 1}/${allItems.length}] 처리 중: ${key}`);

    try {
      // 1. Download from R2
      console.log(`  R2에서 다운로드 중...`);
      execSync(`npx wrangler r2 object get moonpiece-journal/${key} --file="${tempFilePath}" --remote`, { stdio: 'inherit' });

      // 2. Read and Replace
      let content = fs.readFileSync(tempFilePath, 'utf8');
      const originalContent = content;

      // 교체 규칙 정의
      content = content.replace(/1544-0000/g, '070-7604-1123');
      content = content.replace(/support@moonpiece\.co\.kr/g, 'coboselly@naver.com');
      content = content.replace(/상호명:\s*문피스\s*수면연구소/g, '상호명: 문워크');
      content = content.replace(/123-45-67890/g, '690-49-00272');
      content = content.replace(/서울특별시\s*성동구\s*아차산로\s*123,\s*405호/g, '부산시 사하구 괴정로 179 세화빌딩 4층');
      content = content.replace(/제2024-서울성동-0000호/g, '2019-부산사하-0620');
      content = content.replace(/2024-서울성동-0000/g, '2019-부산사하-0620');

      if (content === originalContent) {
        console.log(`  ⚠️ 변경 사항이 감지되지 않았습니다. (이미 업데이트 되었거나 매칭 실패)`);
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        continue;
      }

      fs.writeFileSync(tempFilePath, content, 'utf8');
      console.log(`  업데이트 완료 (파일 수정 완료).`);

      // 3. Put back to R2
      console.log(`  R2에 재업로드 중...`);
      execSync(`npx wrangler r2 object put moonpiece-journal/${key} --file="${tempFilePath}" --remote --content-type="text/html"`, { stdio: 'inherit' });
      console.log(`  성공적으로 R2에 업로드되었습니다.`);
      
      // 4. Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (err) {
      console.error(`  ❌ 에러 발생: ${key} 처리 실패`, err.message);
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }

  console.log("\n모든 작업이 끝났습니다!");
}

run();
