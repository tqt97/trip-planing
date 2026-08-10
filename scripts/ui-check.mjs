import fs from 'node:fs';

const html = fs.readFileSync('index.html','utf8');
const css = fs.readFileSync('styles.css','utf8');
const app = fs.readFileSync('app.js','utf8');
const modules = ['src/app/ui.js','src/app/storage.js','src/app/radar-view.js','src/app/demo-seed.js','src/data/supabase-client.js','src/data/repository.js'].map((f)=>[f,fs.readFileSync(f,'utf8')]);
const assert = (ok, message) => { if (!ok) throw new Error(`UI check failed: ${message}`); };

assert(!html.includes('section-caret'), 'collapse icons must stay removed');
assert((css.match(/!important/g)||[]).length === 0, 'CSS must not use !important overrides');
assert(html.includes('class="brand-title"') && html.includes('class="subtitle"') && !html.includes('trip-logo'), 'brand hierarchy must be explicit and logo-free');
assert(css.includes('@media(max-width:820px)') && css.includes('@media(max-width:480px)') && css.includes('@media(max-width:360px)'), 'mobile breakpoints missing');
assert(css.includes('width:100vw;max-width:100vw;max-height:92dvh'), 'mobile dialog viewport guard missing');
assert(css.includes('.shell{width:min(calc(100% - 48px)') && css.includes('.shell{width:calc(100% - 14px)'), 'shell viewport gutters missing');
assert(css.includes('.places-list{padding:0 14px 12px;grid-template-columns:1fr;max-height:520px;overflow:auto'), 'mobile places bounded scroll missing');
assert(css.includes('.expense-list{padding:0 14px 14px;grid-template-columns:1fr;max-height:430px;overflow:auto'), 'mobile expenses bounded scroll missing');
assert(css.includes('.mobile-fab{position:fixed;right:14px;bottom:calc(76px') && css.includes('.back-to-top{right:14px;bottom:calc(122px'), 'floating control stack is not aligned right');
assert(css.includes('.place-form .form-grid-compact{grid-template-columns:repeat(2,minmax(0,1fr))'), 'paired mobile form fields missing');
assert(css.includes('.row-actions{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))'), 'place actions must stay one horizontal row');
assert(css.includes('.cluster-places{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))'), 'cluster details must use two-column layout');
assert(css.includes('.radar-place:hover .radar-place-label') && css.includes('.radar-sweep'), 'radar hover labels and scan lines missing');
assert(html.includes('id="homeMapBtn"'), 'Home Google Maps action missing');
assert(css.includes('.brand-title h1,h1{font-size:40px'), 'mobile H1 must remain 40px');
assert(css.includes('.section-collapse-hit:hover') && css.includes('box-shadow:'), 'collapse affordance must be surface-based');
assert(html.includes('role="button" tabindex="0" aria-expanded="true"'), 'collapsible headers need keyboard semantics');
assert(app.includes("interactive=event.target.closest('button,a,input,select,textarea,label,summary,details')"), 'header collapse must protect nested controls');
assert(Buffer.byteLength(css) < 30000, `CSS budget exceeded (${Buffer.byteLength(css)} bytes)`);
assert(Buffer.byteLength(app) < 40000, `app.js budget exceeded (${Buffer.byteLength(app)} bytes)`);
for (const [file, content] of modules) assert(Buffer.byteLength(content) < 18000, `${file} module budget exceeded`);
const totalJs = Buffer.byteLength(app) + modules.reduce((sum,[,content])=>sum+Buffer.byteLength(content),0);
assert(totalJs < 85000, `total browser JS budget exceeded (${totalJs} bytes)`);
assert(!/<script[^>]+src="https?:\/\//.test(html) && !/<link[^>]+href="https?:\/\//.test(html), 'runtime external CSS/JS dependency detected');

console.log(`ui-check: mobile/desktop layout invariants passed; CSS ${Buffer.byteLength(css)} B, app ${Buffer.byteLength(app)} B, total JS ${totalJs} B, 0 !important`);
