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

function assertBalancedCss(file, text) {
  let depth = 0;
  let quote = null;
  let inComment = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inComment) {
      if (ch === '*' && next === '/') { inComment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '*') { inComment = true; i += 1; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth < 0) throw new Error(`${path.relative(root, file)}: unexpected closing CSS brace`);
  }
  if (inComment) throw new Error(`${path.relative(root, file)}: unterminated CSS comment`);
  if (quote) throw new Error(`${path.relative(root, file)}: unterminated CSS string`);
  if (depth !== 0) throw new Error(`${path.relative(root, file)}: unbalanced CSS braces (${depth})`);
}
for (const f of files.filter((f) => f.endsWith('.css'))) assertBalancedCss(f, fs.readFileSync(f, 'utf8'));
for (const f of files.filter((f) => f.endsWith('.css'))) {
  const text = fs.readFileSync(f, 'utf8');
  if (/calc\([^)]*\/\s*\d/.test(text)) throw new Error(`${path.relative(root, f)}: avoid CSS division in calc(); use an explicit precomputed variable for browser compatibility`);
}

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
