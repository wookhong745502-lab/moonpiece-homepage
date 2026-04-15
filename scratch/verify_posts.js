// native fetch

async function main() {
    const URL = 'https://moonpiece.co.kr/journal/pregnancy-stretch-marks-prevention.html';
    const res = await fetch(URL);
    const html = await res.text();
    
    console.log("=== Verification of SEO Post 1 ===");
    console.log("Total Length:", html.length);
    console.log("Includes <article>:", html.includes("<article"));
    console.log("Includes FAQ schema:", html.includes(`"@type":"FAQPage"`));
    console.log("Includes Custom category badge correctly?", html.includes("임산부 저널"));
    const imgMatches = html.match(/<img /g);
    console.log("Number of images embedded:", imgMatches ? imgMatches.length : 0);
    
    const URL2 = 'https://moonpiece.co.kr/knowledge/sleeping-on-back-during-pregnancy.html';
    const res2 = await fetch(URL2);
    const html2 = await res2.text();
    
    console.log("\n=== Verification of AEO Post 1 ===");
    console.log("Total Length:", html2.length);
    console.log("Includes AEO Box?", html2.includes("aeo-box"));
    console.log("Includes Direct Answer?", html2.includes("aeo-q"));
}

main();
