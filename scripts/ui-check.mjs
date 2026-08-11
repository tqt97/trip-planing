import fs from 'node:fs';

const html = fs.readFileSync('index.html','utf8');
const css = fs.readFileSync('styles.css','utf8');
const app = fs.readFileSync('app.js','utf8');
const main = fs.readFileSync('src/app/main.js','utf8');
const modules = [
  'src/app/ui.js','src/app/storage.js','src/app/radar-view.js','src/app/demo-seed.js','src/app/app-shell.js',
  'src/data/supabase-client.js','src/data/repository.js'
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
assert(css.includes('@media (max-width: 820px)') && css.includes('@media (max-width: 480px)') && css.includes('@media (max-width: 360px)'), 'mobile breakpoints missing');
assert(has(/dialog\s*\{[^}]*width:\s*100vw[^}]*max-width:\s*100vw[^}]*max-height:\s*92dvh/s), 'mobile dialog viewport guard missing');
assert(has(/\.shell\s*\{[^}]*width:\s*min\(calc\(100% - 48px\)/s) && has(/@media\s*\(max-width:\s*360px\)[\s\S]*?\.shell\s*\{[^}]*width:\s*calc\(100% - 14px\)/s), 'shell viewport gutters missing');
assert(has(/\.places-list\s*\{[^}]*max-height:\s*520px[^}]*overflow:\s*auto/s), 'mobile places bounded scroll missing');
assert(has(/\.expense-list\s*\{[^}]*max-height:\s*430px[^}]*overflow:\s*auto/s), 'mobile expenses bounded scroll missing');
assert(has(/\.mobile-fab\s*\{[^}]*right:\s*14px[^}]*bottom:\s*calc\(76px/s) && has(/\.back-to-top\s*\{[^}]*right:\s*14px[^}]*bottom:\s*calc\(122px/s), 'floating control stack is not aligned right');
assert(has(/\.place-form \.form-grid-compact\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s), 'paired mobile form fields missing');
assert(has(/\.row-actions\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s), 'place actions must stay one horizontal row');
assert(has(/\.route-meta\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)[^}]*align-items:\s*stretch/s), 'route-meta must be equal 3-column grid on base/desktop');
assert(has(/\.route-meta>\.route-pill,\.route-meta>\.vote-btn\{[^}]*height:\s*34px[^}]*align-items:\s*center[^}]*justify-content:\s*center/s), 'route-meta children must share height and center alignment');
assert(has(/\.cluster-places\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s), 'cluster details must use two-column layout');
assert(css.includes('.radar-place:hover .radar-place-label') && css.includes('.radar-sweep'), 'radar hover labels and scan lines missing');
assert(html.includes('id="homeMapBtn"'), 'Home Google Maps action missing');
assert(has(/@media\s*\(max-width:\s*480px\)[\s\S]*?font-size:\s*40px/s), 'mobile H1 must remain 40px');
assert(has(/@media\s*\(max-width:\s*360px\)[\s\S]*?\.stats\s*\{[^}]*grid-template-columns:\s*repeat\(2/s), '320-360px stats must fall back to two columns');
assert(css.includes('.section-collapse-hit:hover') && css.includes('box-shadow:'), 'collapse affordance must be surface-based');
assert(html.includes('role="button" tabindex="0" aria-expanded="true"'), 'collapsible headers need keyboard semantics');
assert(main.includes("interactive=event.target.closest('button,a,input,select,textarea,label,summary,details')"), 'header collapse must protect nested controls');
assert(Buffer.byteLength(css) < 34000, `CSS budget exceeded (${Buffer.byteLength(css)} bytes)`);
assert(Buffer.byteLength(app) < 1000, `bootstrap app.js budget exceeded (${Buffer.byteLength(app)} bytes)`);
assert(Buffer.byteLength(main) < 36000, `src/app/main.js budget exceeded (${Buffer.byteLength(main)} bytes)`);
for (const [file, content] of modules) assert(Buffer.byteLength(content) < 18000, `${file} module budget exceeded`);
const totalJs = Buffer.byteLength(app) + Buffer.byteLength(main) + modules.reduce((sum,[,content])=>sum+Buffer.byteLength(content),0);
assert(totalJs < 85000, `total browser JS budget exceeded (${totalJs} bytes)`);
assert(!/<script[^>]+src="https?:\/\//.test(html) && !/<link[^>]+href="https?:\/\//.test(html), 'runtime external CSS/JS dependency detected');

console.log(`ui-check: responsive invariants passed; CSS ${Buffer.byteLength(css)} B, app ${Buffer.byteLength(app)} B, total JS ${totalJs} B, 0 !important`);
