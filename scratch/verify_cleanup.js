const fs = require('fs');

async function checkLists() {
    const journalRes = await fetch('https://moonpiece.co.kr/journal/list.json?v=' + Date.now());
    const journal = await journalRes.json();
    console.log("Journal List Count:", journal.length);

    const knowledgeRes = await fetch('https://moonpiece.co.kr/knowledge/list.json?v=' + Date.now());
    const knowledge = await knowledgeRes.json();
    console.log("Knowledge List Count:", knowledge.length);
}

checkLists();
