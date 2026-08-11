import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const main = fs.readFileSync('src/app/main.js', 'utf8');
const placeView = fs.readFileSync('src/features/places/place-view.js', 'utf8');
const recommendationView = fs.readFileSync('src/features/recommendations/recommendation-view.js', 'utf8');
const radar = fs.readFileSync('src/app/radar-view.js', 'utf8');
const storage = fs.readFileSync('src/app/storage.js', 'utf8');
const ui = fs.readFileSync('src/app/ui.js', 'utf8');
const core = fs.readFileSync('src/core.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/001_v2_collaboration.sql', 'utf8');
const featureMigration = fs.readFileSync('supabase/migrations/002_trip_features.sql', 'utf8');
const resetSql = fs.readFileSync('supabase/RESET_ALL.sql', 'utf8');
const cssSources = ['styles/00-foundation.css','styles/10-responsive.css','styles/20-collaboration.css'];
const hasCss = (re) => re.test(css);

for (const id of ['homeTitle','addBtn','placesList','placeDialog','homeDialog','radiusSelect','pageSizeSelect','pagination','prevPageBtn','nextPageBtn','radarSvg','radarSummary','radarEmpty','radarRadiusSelect','radarCategorySelect','expenseSection','expenseList','expenseTotal','expenseAverage','peopleCount','expenseDialog','expenseForm','checklistSection','checklistList','checklistDialog','placeImage','placeNoteUrl','backToTop']) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Smoke failed: missing #${id}`);
}
for (const symbol of ['filterAndSortPlaces','filterRadarPlaces','buildRadarPoints','googleMapsCoordinateUrl','sanitizeExpense','totalExpenses','sanitizeChecklist','averageExpensePerPerson']) {
  if (!core.includes(symbol)) throw new Error(`Smoke failed: core missing ${symbol}`);
}
for (const file of ['src/app/radar-view.js','src/app/storage.js','src/app/ui.js','src/data/supabase-client.js','src/data/repository.js','supabase/RESET_ALL.sql','supabase/migrations/001_v2_collaboration.sql','supabase/migrations/002_trip_features.sql','data/default-places.json','api/route.js','api/matrix.js','api/config.js']) {
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
if (!placeView.includes("actionButton('G', 'Mở Google Maps'")) throw new Error('Smoke failed: Google Maps card action missing');
if (!html.includes('id="homeMapBtn"') || !main.includes('homeMapBtn')) throw new Error('Smoke failed: Home Google Maps action missing');
if (!radar.includes("role: 'link'")) throw new Error('Smoke failed: radar point is not keyboard-link semantics');
if (!css.includes('.radar-sweep') || !css.includes('.radar-place:hover .radar-place-label')) throw new Error('Smoke failed: radar scan-line or hover-label treatment missing');
if (!hasCss(/\.row-actions\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s)) throw new Error('Smoke failed: place actions are not locked to one row');

// Responsive hierarchy and collapse affordance.
if (html.includes('section-caret')) throw new Error('Smoke failed: collapse icon returned');
if (!html.includes('class="section-heading compact section-collapse-hit"')) throw new Error('Smoke failed: section header collapse target missing');
if (!main.includes("header.addEventListener('click', toggleSectionFromHeader)")) throw new Error('Smoke failed: header click collapse binding missing');
if (!css.includes('.section-collapse-hit:hover')) throw new Error('Smoke failed: raised collapse header affordance missing');
if (!html.includes('class="brand-title"') || html.includes('trip-logo')) throw new Error('Smoke failed: logo-free brand hierarchy missing');
if (!hasCss(/\.subtitle\s*\{[^}]*max-width:\s*760px[^}]*font-size:\s*15px/s)) throw new Error('Smoke failed: desktop subtitle alignment missing');
if (!hasCss(/@media\s*\(max-width:\s*820px\)[\s\S]*?\.subtitle\s*\{[^}]*max-width:\s*none/s)) throw new Error('Smoke failed: mobile full-width subtitle missing');
if (!hasCss(/\.back-to-top\s*\{[^}]*right:\s*14px[^}]*bottom:\s*calc\(122px/s)) throw new Error('Smoke failed: mobile back-to-top is not below FAB on the right');
if (!hasCss(/\.mobile-fab\s*\{[^}]*right:\s*14px[^}]*bottom:\s*calc\(76px/s)) throw new Error('Smoke failed: compact mobile FAB placement missing');
if (!hasCss(/\.stats article\s*\{[^}]*min-width:\s*0[^}]*min-height:\s*62px/s)) throw new Error('Smoke failed: compact stat cards missing');
if (!hasCss(/@media\s*\(max-width:\s*360px\)[\s\S]*?\.stats\s*\{[^}]*grid-template-columns:\s*repeat\(2/s)) throw new Error('Smoke failed: small-phone stats fallback missing');
if (!hasCss(/@media\s*\(max-width:\s*820px\)[\s\S]*?\.places-list,\.expense-list,\.checklist-list\{[^}]*max-height:\s*none[^}]*overflow:\s*visible/s)) throw new Error('Smoke failed: mobile lists must use natural page scroll');
if (!css.includes('@media (max-width: 360px)')) throw new Error('Smoke failed: small-phone breakpoint missing');
if (!css.includes('font-size: 40px')) throw new Error('Smoke failed: mobile H1 40px guard missing');
if (!hasCss(/body\s*\{[^}]*overflow-x:\s*clip/s)) throw new Error('Smoke failed: horizontal overflow guard missing');

// CSS/JS cleanliness. Source files are checked separately so formatting does not create false failures.
const importantCount = (css.match(/!important/g) || []).length;
if (importantCount !== 0) throw new Error(`Smoke failed: CSS must contain 0 !important usages, got ${importantCount}`);
for (const file of cssSources) {
  const lines = fs.readFileSync(file,'utf8').split('\n').length;
  if (lines > 520) throw new Error(`Smoke failed: ${file} grew beyond maintainability guard (${lines} lines)`);
}
if (main.split('\n').length > 380) throw new Error('Smoke failed: src/app/main.js orchestration file too large after refactor');
if (app.split('\n').length > 5) throw new Error('Smoke failed: root app.js must remain a tiny bootstrap');
if (!storage.includes('persistState') || !ui.includes('collectElements') || !radar.includes('renderRadarView') || !fs.readFileSync('src/data/repository.js','utf8').includes('CollaborativeRepository')) throw new Error('Smoke failed: app modules are not properly split');

// Collaboration and reset/migration guards.
for (const fragment of ['id="bootGate"','id="authGate"','id="googleLoginBtn"','id="membersDialog"']) if (!html.includes(fragment)) throw new Error(`Smoke failed: collaboration markup missing ${fragment}`);
if (!html.includes('<body class="app-booting">') || !css.includes('body.app-booting .topbar') || !main.includes('appShell.auth')) throw new Error('Smoke failed: auth flash prevention shell missing');
if (!recommendationView.includes('recommendPlaces')) throw new Error('Smoke failed: recommendation feature missing recommendPlaces');
if (!placeView.includes('hasUserVoted')) throw new Error('Smoke failed: place vote renderer missing hasUserVoted');
for (const fragment of ['COLLAB_CONNECTED','REALTIME_SYNC']) if (!main.includes(fragment)) throw new Error(`Smoke failed: collaboration app behavior missing ${fragment}`);
for (const fragment of ['enable row level security','join_trip_by_slug','place_votes','trip_members']) if (!migration.includes(fragment)) throw new Error(`Smoke failed: RLS/migration missing ${fragment}`);
for (const fragment of ['create table if not exists public.checklists','people_count','place-images']) if (!featureMigration.includes(fragment)) throw new Error(`Smoke failed: v2.6 feature migration missing ${fragment}`);
if (/from public\.trip_members\s+where\s+trip_id\s*=/i.test(migration)) throw new Error('Smoke failed: ambiguous trip_id reference returned to join RPC');
if (!resetSql.includes('drop table if exists public.place_votes cascade')) throw new Error('Smoke failed: clean reset SQL missing');
if (!fs.readFileSync('scripts/db-seed.mjs','utf8').includes('SUPABASE_SERVICE_ROLE_KEY')) throw new Error('Smoke failed: seed service-role flow missing');

// SEO and mobile navigation.
for (const fragment of ['property="og:title"','name="twitter:card"','type="application/ld+json"','data-scroll="checklist"','data-scroll="expenses"']) {
  if (!html.includes(fragment)) throw new Error(`Smoke failed: SEO/mobile markup missing ${fragment}`);
}
if (html.includes('id="mobileImportInput"')) throw new Error('Smoke failed: mobile Import returned to bottom navigation');

console.log(`smoke: responsive layout, clean CSS/JS modules, clean Supabase reset/migration, maps links, forms, SEO and mobile guards passed (${importantCount} !important)`);
