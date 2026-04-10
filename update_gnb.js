const fs = require('fs');
const path = require('path');

const files = [
    'index.html',
    'brand.html',
    'why.html',
    'review.html',
    'journal.html',
    'about.html',
    'privacy.html',
    'terms.html',
    'admin/admin.html',
    'templates/journal_template.html'
];

for (const file of files) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${file}, not found`);
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // For files in root and admin
    content = content.replace(/(<a href="journal\.html" class="nav-link(?: active)?">임산부 저널<\/a>)/g, 
        '$1\n                <a href="knowledge.html" class="nav-link">임산부 지식인</a>');

    // For templates in subdirectory (using ../)
    content = content.replace(/(<a href="\.\.\/journal\.html" class="nav-link(?: active)?">임산부 저널<\/a>)/g, 
        '$1\n                <a href="../knowledge.html" class="nav-link">임산부 지식인</a>');

    // Mobile nav (might have different spacing, but usually same format)
    content = content.replace(/(<a href="journal\.html" class="nav-link(?: active)?">임산부 저널<\/a>)\n\s*<a href="https:\/\/smartstore/g, 
        '$1\n        <a href="knowledge.html" class="nav-link">임산부 지식인</a>\n        <a href="https://smartstore');

    // Mobile nav with ../ (templates)
    content = content.replace(/(<a href="\.\.\/journal\.html" class="nav-link(?: active)?">임산부 저널<\/a>)\n\s*<a href="https:\/\/smartstore/g, 
        '$1\n        <a href="../knowledge.html" class="nav-link">임산부 지식인</a>\n        <a href="https://smartstore');

    // Fix active state if applicable
    if (file === 'knowledge.html') {
        content = content.replace(/<a href="knowledge\.html" class="nav-link">/, '<a href="knowledge.html" class="nav-link active">');
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
}
