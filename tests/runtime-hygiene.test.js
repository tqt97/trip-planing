import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync('src/app/main.js','utf8');
const storage = fs.readFileSync('src/app/storage.js','utf8');
const client = fs.readFileSync('src/data/supabase-client.js','utf8');

test('production collaboration does not persist shared Trip state into localStorage',()=>{
  assert.match(main,/const persistAppState = \(\) => \{ if \(dataConfig\.provider === 'localStorage'\) persistState\(state\); \};/);
  assert.match(main,/if \(dataConfig\.provider === 'supabase'\) \{[\s\S]*?clearPersistedState\(\)/);
  assert.match(storage,/export function clearPersistedState\(\)/);
  assert.match(storage,/dalat-nearby-planner:v6/);
});

test('Supabase storage client can safely delete only its own public bucket URLs',()=>{
  assert.match(client,/async deletePublicFile\(bucket, publicUrl\)/);
  assert.match(client,/if \(!value\.startsWith\(prefix\)\) return false/);
  assert.match(client,/method: 'DELETE'/);
});


test('service worker refreshes deploy assets online and only falls back to cache offline', () => {
  const sw = fs.readFileSync('sw.js','utf8');
  assert.match(sw, /CACHE='dalat-planner-v2\.9\.4'/);
  assert.match(sw, /event\.respondWith\(fetch\(req\)\.then/);
  assert.match(sw, /client=>client\.navigate\(client\.url\)/);
  assert.doesNotMatch(sw, /caches\.match\(req\)\.then\(cached=>cached\|\|fetch/);
});
