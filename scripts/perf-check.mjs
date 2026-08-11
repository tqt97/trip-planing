import fs from 'node:fs';
import zlib from 'node:zlib';

const files = [
  'index.html','styles.css','app.js','src/app/main.js','src/core.js','src/data/supabase-client.js','src/data/repository.js',
  'src/app/ui.js','src/app/radar-view.js','src/features/places/place-view.js','src/features/recommendations/recommendation-view.js','src/features/expenses/expense-view.js','src/features/checklists/checklist-view.js','src/features/checklists/checklist-controller.js','src/features/places/place-media.js'
];
const size = file => fs.statSync(file).size;
const gzip = file => zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;
const budgets = { 'styles.css': 40000, 'src/app/main.js': 36000, 'src/core.js': 22000, 'src/data/supabase-client.js': 12000 };
for (const [file, max] of Object.entries(budgets)) if (size(file) > max) throw new Error(`perf: ${file} ${size(file)} B exceeds ${max} B budget`);
const html = fs.readFileSync('index.html','utf8');
if (/<script[^>]+src="https?:\/\//.test(html) || /<link[^>]+href="https?:\/\//.test(html)) throw new Error('perf: external blocking runtime assets are not allowed');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dup.length) throw new Error(`perf: duplicate DOM ids: ${[...new Set(dup)].join(', ')}`);
const totalRaw = files.reduce((sum, file) => sum + size(file), 0);
const totalGzip = files.reduce((sum, file) => sum + gzip(file), 0);
console.log(`perf-check: ${files.length} critical assets · ${totalRaw} B raw · ${totalGzip} B gzip-equivalent · budgets passed`);
