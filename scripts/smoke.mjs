import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const radar = fs.readFileSync('src/app/radar-view.js', 'utf8');
const storage = fs.readFileSync('src/app/storage.js', 'utf8');
const ui = fs.readFileSync('src/app/ui.js', 'utf8');
const core = fs.readFileSync('src/core.js', 'utf8');

for (const id of ['homeTitle','addBtn','placesList','placeDialog','homeDialog','radiusSelect','pageSizeSelect','pagination','prevPageBtn','nextPageBtn','radarSvg','radarSummary','radarEmpty','radarRadiusSelect','radarCategorySelect','expenseSection','expenseList','expenseTotal','expenseDialog','expenseForm','backToTop']) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Smoke failed: missing #${id}`);
}
for (const symbol of ['filterAndSortPlaces','filterRadarPlaces','buildRadarPoints','googleMapsCoordinateUrl','sanitizeExpense','totalExpenses']) {
  if (!core.includes(symbol)) throw new Error(`Smoke failed: core missing ${symbol}`);
}
for (const file of ['src/app/radar-view.js','src/app/storage.js','src/app/ui.js','src/data/supabase-client.js','src/data/repository.js','supabase/migrations/001_v2_collaboration.sql','data/default-places.json','api/route.js','api/matrix.js','api/config.js']) {
  if (!fs.existsSync(file)) throw new Error(`Smoke failed: missing ${file}`);
}
JSON.parse(fs.readFileSync('vercel.json','utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
if (!pkg.scripts?.quality) throw new Error('Smoke failed: quality script missing');

// Security/accessibility/form basics.
for (const rule of ['font-size:16px','env(safe-area-inset-left)','input::placeholder','.required-mark']) {
  if (!css.includes(rule)) throw new Error(`Smoke failed: form/accessibility rule missing ${rule}`);
}
if (!html.includes('class="required-mark"')) throw new Error('Smoke failed: required marker missing');
if (html.includes('(không bắt buộc)')) throw new Error('Smoke failed: verbose optional text returned');
if (!app.includes("actionButton('G','Mở Google Maps'")) throw new Error('Smoke failed: Google Maps card action missing');
if (!html.includes('id="homeMapBtn"') || !app.includes('homeMapBtn')) throw new Error('Smoke failed: Home Google Maps action missing');
if (!radar.includes("role: 'link'")) throw new Error('Smoke failed: radar point is not keyboard-link semantics');
if (!css.includes('.radar-sweep') || !css.includes('.radar-place:hover .radar-place-label')) throw new Error('Smoke failed: radar scan-line or hover-label treatment missing');
if (!css.includes('.row-actions{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))')) throw new Error('Smoke failed: place actions are not locked to one row');

// v1.14 refactor + interaction guards.
if (html.includes('section-caret')) throw new Error('Smoke failed: collapse icon returned');
if (!html.includes('class="section-heading compact section-collapse-hit"')) throw new Error('Smoke failed: section header collapse target missing');
if (!app.includes("header.addEventListener('click', toggleSectionFromHeader)")) throw new Error('Smoke failed: header click collapse binding missing');
if (!css.includes('.section-collapse-hit:hover')) throw new Error('Smoke failed: raised collapse header affordance missing');
if (!html.includes('class="brand-title"') || html.includes('trip-logo')) throw new Error('Smoke failed: logo-free brand hierarchy missing');
if (!css.includes('.subtitle{margin:0;max-width:760px;font-size:15px')) throw new Error('Smoke failed: desktop subtitle alignment missing');
if (!css.includes('.subtitle{padding-left:0;max-width:none')) throw new Error('Smoke failed: mobile full-width subtitle missing');
if (!css.includes('.back-to-top{right:14px;bottom:calc(122px')) throw new Error('Smoke failed: mobile back-to-top is not below FAB on the right');
if (!css.includes('.mobile-fab{position:fixed;right:14px;bottom:calc(76px')) throw new Error('Smoke failed: compact mobile FAB placement missing');
if (!css.includes('.stats article{min-width:0;min-height:62px')) throw new Error('Smoke failed: compact stat cards missing');
if (!css.includes('grid-template-columns:repeat(2,minmax(0,1fr))')) throw new Error('Smoke failed: desktop two-column density missing');
if (!css.includes('max-height:520px') || !css.includes('max-height:430px')) throw new Error('Smoke failed: mobile bounded list scroll missing');
if (!css.includes('@media(max-width:360px)')) throw new Error('Smoke failed: small-phone breakpoint missing');
if (!css.includes('font-size:40px')) throw new Error('Smoke failed: mobile H1 40px guard missing');

// CSS cleanliness: one !important is allowed only for sr-only accessibility.
const importantCount = (css.match(/!important/g) || []).length;
if (importantCount > 6) throw new Error(`Smoke failed: CSS override debt too high (${importantCount} !important usages)`);
if (importantCount && !css.includes('.sr-only{position:absolute!important')) throw new Error('Smoke failed: unexpected !important usage');
if (css.split('\n').length > 500) throw new Error('Smoke failed: stylesheet grew beyond clean-refactor guard');
if (app.split('\n').length > 410) throw new Error('Smoke failed: app.js orchestration file too large after refactor');
if (!storage.includes('persistState') || !ui.includes('collectElements') || !radar.includes('renderRadarView') || !fs.readFileSync('src/data/repository.js','utf8').includes('CollaborativeRepository')) throw new Error('Smoke failed: app modules are not properly split');

// v2 collaboration guards.
for (const fragment of ['id="authGate"','id="googleLoginBtn"','id="membersDialog"']) if (!html.includes(fragment)) throw new Error(`Smoke failed: collaboration markup missing ${fragment}`);
for (const fragment of ['recommendPlaces','hasUserVoted','COLLAB_CONNECTED','REALTIME_SYNC']) if (!app.includes(fragment)) throw new Error(`Smoke failed: collaboration app behavior missing ${fragment}`);
const migration=fs.readFileSync('supabase/migrations/001_v2_collaboration.sql','utf8');
for (const fragment of ['enable row level security','join_trip_by_slug','place_votes','trip_members']) if (!migration.includes(fragment)) throw new Error(`Smoke failed: RLS/migration missing ${fragment}`);
if (!fs.readFileSync('scripts/db-seed.mjs','utf8').includes('SUPABASE_SERVICE_ROLE_KEY')) throw new Error('Smoke failed: seed service-role flow missing');

// SEO and mobile navigation.
for (const fragment of ['property="og:title"','name="twitter:card"','type="application/ld+json"','data-scroll="together"','data-scroll="expenses"']) {
  if (!html.includes(fragment)) throw new Error(`Smoke failed: SEO/mobile markup missing ${fragment}`);
}
if (html.includes('id="mobileImportInput"')) throw new Error('Smoke failed: mobile Import returned to bottom navigation');

console.log(`smoke: responsive layout, clean CSS/JS modules, collapse affordance, maps links, forms, SEO and mobile guards passed (${importantCount} !important)`);
