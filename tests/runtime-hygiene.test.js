import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync('src/app/main.js','utf8');
const storage = fs.readFileSync('src/app/storage.js','utf8');
const client = fs.readFileSync('src/data/supabase-client.js','utf8');

test('production collaboration does not persist shared Trip state into localStorage',()=>{
  assert.match(main,/const persistAppState = \(\) => \{ if\s*\(dataConfig\.provider === 'localStorage'\) persistState\(state\); \};/);
  assert.match(main,/if\s*\(dataConfig\.provider === 'supabase'\) \{[\s\S]*?clearPersistedState\(\)/);
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
  assert.match(sw, /CACHE='dalat-planner-v2\.9\.7'/);
  assert.match(sw, /event\.respondWith\(fetch\(req\)\.then/);
  assert.match(sw, /client=>client\.navigate\(client\.url\)/);
  assert.doesNotMatch(sw, /caches\.match\(req\)\.then\(cached=>cached\|\|fetch/);
});


test('mobile density and unified add actions stay compact', () => {
  const html = fs.readFileSync('index.html','utf8');
  const placeView = fs.readFileSync('src/features/places/place-view.js','utf8');
  const foundation = fs.readFileSync('styles/00-foundation.css','utf8');
  const responsive = fs.readFileSync('styles/10-responsive.css','utf8');
  assert.match(placeView, /meta\.append\(distance, source, eta, voteBtn\)/);
  assert.match(foundation, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(responsive, /font-size:\s*39px/);
  assert.match(html, /id="addTimelineBtn"[^>]*>\+<\/button>/);
  assert.match(html, /id="addAlbumBtn"[^>]*>\+<\/button>/);
  assert.match(html, /id="addChecklistBtn"[^>]*>\+<\/button>/);
  assert.match(html, /id="mobileAddBtn"[^>]*>\+<\/button>/);
  assert.doesNotMatch(html, /backToTop[^>]*>↑<span>/);
  assert.match(html, /<h2>Lịch trình<\/h2>/);
  assert.match(html, /<h2>Ảnh<\/h2>/);
  assert.match(html, /<h2>Công việc<\/h2>/);
});
