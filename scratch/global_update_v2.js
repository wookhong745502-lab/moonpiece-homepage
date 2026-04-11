const fs = require('fs');
const path = require('path');

const rootDir = 'c:/homepage';
const journalDir = path.join(rootDir, 'journal');

const mainFiles = [
    'index.html', 'brand.html', 'review.html', 'journal.html', 'knowledge.html',
    'about.html', 'privacy.html', 'terms.html'
];

const adminFiles = ['admin/admin.html'];

function getGnb(activeFile, prefix = '') {
    const pages = [
        { href: 'brand.html', text: '문피스의 약속' },
        { href: 'review.html', text: '엄마들의 이야기' },
        { href: 'journal.html', text: '임산부 저널' },
        { href: 'knowledge.html', text: '임산부 지식인' }
    ];

    let links = pages.map(p => {
        const isActive = activeFile === p.href ? ' active' : '';
        return `                <a href="${prefix}${p.href}" class="nav-link${isActive}">${p.text}</a>`;
    }).join('\n');

    return `    <nav class="nav-bar">
        <div class="nav-container">
            <a href="${prefix}index.html" class="logo font-serif">Moonpiece</a>
            <div class="nav-links">
${links}
            </div>
            <div class="flex items-center gap-4">
                <a href="https://smartstore.naver.com/moonwalk00/products/2416019050" target="_blank" class="btn-primary mobile-hidden">구매하기</a>
                <button class="hamburger-btn" id="menu-toggle">
                    <span></span><span></span><span></span>
                </button>
            </div>
        </div>
    </nav>`;
}

function getMobileNav(activeFile, prefix = '') {
    const pages = [
        { href: 'brand.html', text: '문피스의 약속' },
        { href: 'review.html', text: '엄마들의 이야기' },
        { href: 'journal.html', text: '임산부 저널' },
        { href: 'knowledge.html', text: '임산부 지식인' }
    ];

    let links = pages.map(p => {
        const isActive = activeFile === p.href ? ' active' : '';
        return `        <a href="${prefix}${p.href}" class="nav-link${isActive}">${p.text}</a>`;
    }).join('\n');

    return `    <div class="nav-overlay" id="overlay"></div>
    <div class="mobile-nav" id="mobile-menu">
${links}
        <a href="https://smartstore.naver.com/moonwalk00/products/2416019050" target="_blank" class="btn-primary text-center mt-8">구매하기</a>
    </div>`;
}

function getFooter(prefix = '') {
    return `    <footer>
        <div class="container grid md:grid-cols-2 gap-12">
            <div>
                <div class="logo font-serif mb-4" style="color: var(--primary);">Moonpiece</div>
                <p style="max-width: 320px; color: var(--on-surface-variant); line-height: 1.8;">
                    소중한 엄마와 아기를 위한 달빛의 조각, 문피스. 10년의 진심을 담아 가장 편안한 휴식을 설계합니다.
                </p>
            </div>
            <div class="grid md:grid-cols-3 gap-8">
                <div>
                    <h4 style="font-weight: 800; margin-bottom: 1.5rem;">Company</h4>
                    <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.75rem; color: var(--on-surface-variant);">
                        <li><a href="${prefix}about.html">회사소개</a></li>
                        <li><a href="${prefix}terms.html">이용약관</a></li>
                    </ul>
                </div>
                <div>
                    <h4 style="font-weight: 800; margin-bottom: 1.5rem;">Support</h4>
                    <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.75rem; color: var(--on-surface-variant);">
                        <li><a href="${prefix}privacy.html">개인정보처리방침</a></li>
                        <li><a href="https://smartstore.naver.com/moonwalk00/products/2416019050" target="_blank">네이버 스마트스토어</a></li>
                    </ul>
                </div>
                <div>
                    <h4 style="font-weight: 800; margin-bottom: 1.5rem;">Social</h4>
                    <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.75rem; color: var(--on-surface-variant);">
                        <li><a href="#">Instagram</a></li>
                        <li><a href="#">YouTube</a></li>
                    </ul>
                </div>
            </div>
        </div>
        <div class="container" style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--outline-variant); text-align: center; color: var(--on-surface-variant); font-size: 0.85rem;">
            © 2024 Moonpiece. All rights reserved.
        </div>
    </footer>`;
}

function getPrescription(prefix = '') {
    return `            <div class="card p-12 mt-20 surface-container-low shadow-md" style="border: 1px solid var(--outline-variant); border-radius: 2rem;">
                <h4 style="font-weight: 900; font-size: 1.5rem; margin-bottom: 1.5rem; color: var(--on-surface);">🌙 엄마의 밤을 위한 문피스 처방전</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <a href="${prefix}brand.html" class="flex flex-col gap-2 p-6 surface-container-high rounded-2xl transition hover:shadow-lg" style="text-decoration: none;">
                        <span class="material-symbols-outlined text-primary" style="font-size: 2rem;">verified</span>
                        <span style="font-weight: 800; font-size: 1.1rem; color: var(--primary);">문피스의 약속</span>
                        <span style="font-size: 0.9rem; color: var(--on-surface-variant);">문피스 바디필로우의 인체공학적 설계가 궁금하다면?</span>
                    </a>
                    <a href="https://smartstore.naver.com/moonwalk00/products/2416019050" target="_blank" class="flex flex-col gap-2 p-6 surface-container-high rounded-2xl transition hover:shadow-lg" style="text-decoration: none;">
                        <span class="material-symbols-outlined text-primary" style="font-size: 2rem;">shopping_bag</span>
                        <span style="font-weight: 800; font-size: 1.1rem; color: var(--primary);">구매하러 가기</span>
                        <span style="font-size: 0.9rem; color: var(--on-surface-variant);">임산부 수면 과학의 결정체, 네이버 스마트스토어 공식몰</span>
                    </a>
                </div>
            </div>`;
}

function updateFile(filePath, activeFile, prefix = '') {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    // More flexible regex
    const gnbRegex = /<nav class="nav-bar">[\s\S]*?<\/nav>/;
    const mobileNavRegex = /<div class="nav-overlay" id="overlay"><\/div>\s*<div class="mobile-nav" id="mobile-menu">[\s\S]*?(?:<\/div>\s*<\/div>|<\/div>)/;
    const footerRegex = /<footer[\s\S]*?<\/footer>/;
    const prescriptionRegex = /<div class="card p-12 mt-20 surface-container-low shadow-md"[\s\S]*?<\/div>\s*<\/div>/;

    content = content.replace(gnbRegex, getGnb(activeFile, prefix));
    
    // For mobile nav, some files have extra closing div or complex structure
    content = content.replace(mobileNavRegex, getMobileNav(activeFile, prefix));
    
    content = content.replace(footerRegex, getFooter(prefix));
    
    if (filePath.includes('journal/')) {
        content = content.replace(prescriptionRegex, getPrescription(prefix));
    }

    // Global clean up for any remaining why.html links in text or links
    const whyHtmlRegex = new RegExp(`${prefix}why\\.html`, 'g');
    content = content.replace(whyHtmlRegex, `${prefix}brand.html`);
    content = content.replace(/편안함의 비밀/g, '문피스의 약속');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
}

// Update Main Files
mainFiles.forEach(f => updateFile(path.join(rootDir, f), f));

// Update Admin Files
adminFiles.forEach(f => updateFile(path.join(rootDir, f), 'none', '../'));

// Update Journal Files
if (fs.existsSync(journalDir)) {
    const journalFiles = fs.readdirSync(journalDir).filter(f => f.endsWith('.html') && f !== 'index.html');
    journalFiles.forEach(f => {
        updateFile(path.join(journalDir, f), 'journal.html', '../');
    });
}

// Delete journal/index.html if exists
const journalIndexPath = path.join(journalDir, 'index.html');
if (fs.existsSync(journalIndexPath)) {
    fs.unlinkSync(journalIndexPath);
    console.log(`Deleted: ${journalIndexPath}`);
}
