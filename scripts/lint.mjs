import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const files = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist'].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p); else files.push(p);
  }
}
walk(root);

const js = files.filter((f) => /\.(js|mjs)$/.test(f));
for (const f of js) execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });

const forbidden = [];
for (const f of files.filter((f) => /\.(js|mjs|html)$/.test(f))) {
  const text = fs.readFileSync(f, 'utf8');
  if (/innerHTML\s*=/.test(text)) forbidden.push(`${path.relative(root, f)}: innerHTML assignment`);
  if (/(?:GOOGLE_MAPS_API_KEY|OPENROUTESERVICE_API_KEY)\s*=\s*['"][^'"]+/.test(text)) {
    forbidden.push(`${path.relative(root, f)}: hard-coded provider key`);
  }
}
if (forbidden.length) {
  console.error(forbidden.join('\n'));
  process.exit(1);
}
console.log(`lint: ${js.length} JS files syntax-checked; security pattern checks passed`);
