import fs from 'node:fs';
import path from 'node:path';

export function buildStyles(root = process.cwd()) {
  const sourceDir = path.join(root, 'styles');
  const files = fs.readdirSync(sourceDir).filter(name => name.endsWith('.css')).sort();
  if (!files.length) throw new Error('No CSS sources found in styles/');
  const readable = files.map(name => fs.readFileSync(path.join(sourceDir, name), 'utf8').trim()).join('\n');
  const output = readable.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  if ((output.match(/!important/g) || []).length) throw new Error('CSS policy: !important is not allowed');
  fs.writeFileSync(path.join(root, 'styles.css'), output);
  return { files, bytes: Buffer.byteLength(output) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = buildStyles();
  console.log(`styles: ${result.files.length} sources -> styles.css (${result.bytes} B)`);
}
