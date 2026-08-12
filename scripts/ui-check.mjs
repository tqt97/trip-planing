import fs from 'node:fs';

const html = fs.readFileSync('index.html','utf8');
const css = fs.readFileSync('styles.css','utf8');
const app = fs.readFileSync('app.js','utf8');
const main = fs.readFileSync('src/app/main.js','utf8');
const modules = [
  'src/app/ui.js','src/app/storage.js','src/app/radar-view.js','src/app/demo-seed.js','src/app/app-shell.js','src/app/bindings.js',
  'src/data/supabase-client.js','src/data/repository.js','src/app/pwa.js','src/features/timeline/timeline-controller.js','src/features/timeline/timeline-view.js','src/features/expenses/settlement.js','src/features/common/pagination-view.js','src/features/expenses/expense-view.js','src/features/expenses/expense-controller.js','src/features/checklists/checklist-view.js','src/features/checklists/checklist-controller.js','src/features/places/place-media.js','src/features/album/album-view.js','src/features/album/album-controller.js','src/features/album/album-media.js'
].map((f)=>[f,fs.readFileSync(f,'utf8')]);
const assert = (ok, message) => { if (!ok) throw new Error(`UI check failed: ${message}`); };
const has = (re) => re.test(css);

assert(!html.includes('section-caret'), 'collapse icons must stay removed');
assert(html.includes('<body class="app-booting">') && html.includes('id="bootGate"'), 'auth-safe boot shell missing');
assert(css.includes('body.app-booting .topbar') && css.includes('body.app-auth-required .shell'), 'protected UI flash guard missing');
assert(html.includes('rel="modulepreload"') && html.indexOf('src="/app.js"') < html.indexOf('</head>'), 'early module loading optimization missing');
assert((css.match(/!important/g)||[]).length === 0, 'CSS must not use !important overrides');
assert(has(/body\s*\{[^}]*overflow-x:\s*clip/s), 'body horizontal overflow guard missing');
assert(html.includes('class="brand-title"') && html.includes('class="subtitle"') && !html.includes('trip-logo'), 'brand hierarchy must be explicit and logo-free');
assert(/@media\s*\(max-width:\s*820px\)/.test(css) && /@media\s*\(max-width:\s*480px\)/.test(css) && /@media\s*\(max-width:\s*360px\)/.test(css), 'mobile breakpoints missing');
assert(has(/dialog\s*\{[^}]*width:\s*100%[^}]*max-width:\s*100dvw[^}]*max-height:\s*92dvh/s), 'mobile dialog viewport guard missing');

assert(html.includes('id="placeCoordsDetails"'), 'coordinates details id missing');
assert(main.includes("coordsDetails.open=window.matchMedia('(max-width: 820px)').matches"), 'mobile coordinates must default open');
assert(has(/dialog form,\.trace-panel,\.members-panel\{[^}]*background:/s), 'members modal must use the same solid dialog surface');
assert(has(/@media\s*\(min-width:\s*821px\)\s*\{[\s\S]*?content-visibility:\s*auto/s), 'content-visibility must be desktop-only to avoid mobile layout shifts');
assert(has(/\.shell\s*\{[^}]*width:\s*min\(calc\(100% - 48px\)/s) && has(/@media\s*\(max-width:\s*360px\)[\s\S]*?\.shell\s*\{[^}]*width:\s*calc\(100% - 14px\)/s), 'shell viewport gutters missing');
assert(has(/@media\s*\(max-width:\s*820px\)[\s\S]*?\.places-list,\.expense-list,\.checklist-list\{[^}]*max-height:\s*none[^}]*overflow:\s*visible/s), 'mobile lists must use natural page scroll');
assert(has(/\.mobile-fab\s*\{[^}]*right:\s*14px[^}]*bottom:\s*calc\(76px/s) && has(/\.back-to-top\s*\{[^}]*right:\s*14px[^}]*bottom:\s*calc\(122px/s), 'floating control stack is not aligned right');
assert(has(/\.place-form \.form-grid-compact\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s), 'paired mobile form fields missing');
assert(has(/\.row-actions\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s), 'place actions must stay one horizontal row');
assert(has(/\.route-meta\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)[^}]*align-items:\s*stretch/s), 'route-meta must be equal 4-column grid with distance first');
assert(has(/\.route-meta>\.route-pill,\.route-meta>\.vote-btn\{[^}]*height:\s*32px[^}]*align-items:\s*center[^}]*justify-content:\s*center/s), 'route-meta children must share compact height and center alignment');
assert(has(/\.cluster-places\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s), 'cluster details must use two-column layout');
assert(css.includes('.radar-place:hover .radar-place-label') && css.includes('.radar-sweep'), 'radar hover labels and scan lines missing');
assert(html.includes('id="homeMapBtn"'), 'Home Google Maps action missing');
assert(has(/@media\s*\(max-width:\s*480px\)[\s\S]*?font-size:\s*39px/s), 'mobile H1 must remain 39px');
assert(has(/@media\s*\(max-width:\s*360px\)[\s\S]*?\.stats\s*\{[^}]*grid-template-columns:\s*repeat\(2/s), '320-360px stats must fall back to two columns');
assert(css.includes('.section-collapse-hit:hover') && css.includes('box-shadow:'), 'collapse affordance must be surface-based');
assert(html.includes('role="button" tabindex="0" aria-expanded="true"'), 'collapsible headers need keyboard semantics');
assert(main.includes("interactive=event.target.closest('button,a,input,select,textarea,label,summary,details')"), 'header collapse must protect nested controls');
assert(fs.readFileSync('src/app/bindings.js','utf8').includes('OPTIONAL_UI_BIND_SKIPPED') && main.includes('bindScrollControl({'), 'optional navigation controls must use null-safe binding');
assert(!/document\.querySelector\([^\n;]+\)\.addEventListener/.test(main), 'direct querySelector().addEventListener binding can crash when optional layout controls are absent');
assert(/\.timeline-board\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s.test(css), 'desktop Timeline must render three day columns');
assert(/\.timeline-events\{[^}]*--tw:[^;]+;[^}]*--rw:[^;]+;[^}]*--rh:[^;]+;[^}]*--tg:[^;]+/s.test(css) && /\.timeline-events:before\{[^}]*left:calc\(var\(--tw\) \+ var\(--tg\) \+ var\(--rh\)\)/s.test(css), 'Timeline rail must use precomputed half-rail geometry for browser-compatible alignment');
assert(/\.timeline-event-card\{[^}]*border:0[^}]*background:transparent[^}]*box-shadow:none/s.test(css), 'Timeline event content must stay flat and borderless');
assert(/@media\s*\(max-width:\s*820px\)[\s\S]*?\.timeline-day-tab,\.timeline-day\{display:none\}[\s\S]*?\.timeline-day-tab\.is-active,\.timeline-day\.is-active\{display:block\}/s.test(css), 'mobile Timeline must show only the active day');
assert(Buffer.byteLength(css) < 41500, `CSS budget exceeded (${Buffer.byteLength(css)} bytes)`);
assert(Buffer.byteLength(app) < 1000, `bootstrap app.js budget exceeded (${Buffer.byteLength(app)} bytes)`);
assert(Buffer.byteLength(main) < 36000, `src/app/main.js budget exceeded (${Buffer.byteLength(main)} bytes)`);
for (const [file, content] of modules) assert(Buffer.byteLength(content) < 18000, `${file} module budget exceeded`);
const totalJs = Buffer.byteLength(app) + Buffer.byteLength(main) + modules.reduce((sum,[,content])=>sum+Buffer.byteLength(content),0);
assert(totalJs < 110000, `total browser JS budget exceeded (${totalJs} bytes)`);
assert(html.includes('id="albumSection"') && html.includes('id="albumLightbox"'), 'Image section UI missing');
assert(!html.includes('TRIP ALBUM') && !html.includes('Album đang trống') && !html.includes('>Lưu album<'), 'User-facing Album wording must stay replaced by Ảnh');
assert(html.includes('id="peopleCount"') && html.includes('id="checklistSection"') && html.includes('id="placeImage"') && html.includes('id="placeNoteUrl"'), 'v2.6 trip utility UI missing');
assert(css.includes('.album-strip') && css.includes('.check-completer'), 'v2.7 album/checklist completion styles missing');
assert(/\.album-strip\s*\{[^}]*grid-template-columns:\s*repeat\(4/.test(css) && /@media\s*\(max-width:\s*820px\)[\s\S]*?\.album-strip\s*\{[^}]*grid-template-columns:\s*repeat\(2/.test(css), 'album must use responsive thumbnail grid instead of horizontal scroller');
assert(html.includes('class="album-toolbar"') && !html.includes('id="albumImagePreview"'), 'album filter placement or preview removal regression');
assert(css.includes('.checklist-row') && css.includes('.place-image-preview'), 'v2.6 feature styles missing');

assert(/id="addAlbumBtn"[^>]*>\+<\/button>/.test(html), 'Image CTA must use the shared plus icon');
assert(/id="addTimelineBtn"[^>]*>\+<\/button>/.test(html) && /id="addChecklistBtn"[^>]*>\+<\/button>/.test(html) && /id="addExpenseBtn"[^>]*>\+<\/button>/.test(html), 'section add CTAs must use the same plus icon');
assert(!/id="backToTop"[^>]*>[\s\S]*?<span>🌲<\/span>/.test(html), 'Back-to-top must not contain the tree decoration');
assert(html.includes('<h2>Lịch trình</h2>') && html.includes('<h2>Ảnh</h2>') && html.includes('<h2>Công việc</h2>'), 'compact section titles missing');

assert(html.includes('id="expensePagination"') && html.includes('id="albumPagination"'), 'Expense and Album pagination controls missing');
const compactPagerSource = fs.readFileSync('src/features/common/pagination-view.js', 'utf8');
const placeViewSource = fs.readFileSync('src/features/places/place-view.js', 'utf8');
assert(compactPagerSource.includes('page.totalPages > 1') && placeViewSource.includes('page.totalPages > 1'), 'Pagination must stay hidden when content fits on one page');
assert(/\.pagination\[hidden\]\{[^}]*display:\s*none/s.test(css), 'Pagination hidden attribute must override .pagination display:flex');
assert(!html.includes('albumLightboxPlaceholder') && !css.includes('album-lightbox-placeholder'), 'unused album lightbox placeholder must stay removed');
assert(/\.album-toolbar\{[^}]*margin:14px 20px 10px[^}]*padding:10px 13px[^}]*display:flex[^}]*gap:10px[^}]*min-width:0/s.test(css), 'Image toolbar must keep compact one-row flex spacing');
assert(!css.includes('.album-head-actions') && !css.includes('grid-auto-columns:min(82vw,286px)'), 'stale carousel-era image CSS must stay removed');
assert(/@media \(max-width:520px\)\{[^}]*\.album-toolbar\{[^}]*gap:6px/s.test(css), 'Image toolbar must stay compact on phones');


assert(/\.places-list\{[^}]*padding:10px 20px 18px/s.test(css) && /@media\s*\(max-width:\s*820px\)[\s\S]*?\.places-list\s*\{[^}]*padding:\s*8px 14px 12px/s.test(css), 'Places filter/list spacing must remain even on desktop and mobile');
assert(/\.page-numbers\{[^}]*display:flex[^}]*gap:6px/s.test(css) && /@media\s*\(max-width:\s*820px\)[\s\S]*?\.page-numbers\s*\{[^}]*gap:\s*5px/s.test(css), 'Page number buttons must keep visible spacing');
const timelineControllerSource = fs.readFileSync('src/features/timeline/timeline-controller.js','utf8');
assert(!timelineControllerSource.includes("document.createElement('small')") && !timelineControllerSource.includes("const short = document.createElement('span')"), 'Timeline day selector must stay single-line without redundant nested date labels');
assert(/\.timeline-navigator\{[^}]*margin:10px 0 12px/s.test(css), 'Timeline date navigator needs balanced vertical spacing');
assert(html.includes('id="timelineSection"') && html.includes('id="timelineDialog"'), 'Timeline UI missing');
assert(/\.timeline-board\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(css), 'desktop Timeline must compare three day columns');
assert(css.includes('.timeline-events:before') && css.includes('.timeline-marker'), 'Timeline must render a visible time rail and event markers');
assert(/@media\(max-width:820px\)[\s\S]*?\.timeline-day-tab,\.timeline-day\{display:none\}[\s\S]*?\.timeline-day\.is-active\{display:block\}/.test(css), 'mobile Timeline must show one active day at a time');
assert(fs.readFileSync('src/features/timeline/timeline-controller.js','utf8').includes('timelineWindowDates(dates, activeDate, 3)'), 'Timeline controller must keep a three-day desktop window');
assert(html.includes('rel="manifest"') && fs.existsSync('manifest.webmanifest') && fs.existsSync('sw.js'), 'PWA manifest/service worker missing');
assert(fs.readFileSync('src/app/pwa.js','utf8').includes("serviceWorker.register('/sw.js')"), 'PWA registration missing');
assert(!/<script[^>]+src="https?:\/\//.test(html) && !/<link[^>]+href="https?:\/\//.test(html), 'runtime external CSS/JS dependency detected');

console.log(`ui-check: responsive invariants passed; CSS ${Buffer.byteLength(css)} B, app ${Buffer.byteLength(app)} B, total JS ${totalJs} B, 0 !important`);
