import fs from 'node:fs';
import path from 'node:path';

loadEnv('.env.local'); loadEnv('.env');
const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
if (!url || !key) throw new Error('Cần SUPABASE_URL và SUPABASE_SECRET_KEY (hoặc legacy SUPABASE_SERVICE_ROLE_KEY) để seed.');
const seedPath = process.argv[2] || 'data/default-places.json';
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const trip = seed.trip || {};
if (!trip.slug || !trip.name) throw new Error('seed.trip cần slug và name.');
const headers = { apikey:key, 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=representation', ...(!key.startsWith('sb_secret_') ? { Authorization:`Bearer ${key}` } : {}) };
const tripRows = await request(`/rest/v1/trips?on_conflict=slug`, { method:'POST', headers, body:JSON.stringify({ slug:trip.slug,name:trip.name,home_name:trip.homeName||'Home',home_lat:trip.homeLat??null,home_lng:trip.homeLng??null,public_join:trip.publicJoin!==false,people_count:Math.max(1,Math.min(50,Number.parseInt(trip.peopleCount,10)||4)) }) });
const tripId = tripRows?.[0]?.id;
if (!tripId) throw new Error('Không lấy được trip id sau khi seed.');
const places = Array.isArray(seed.places) ? seed.places : [];
for (let i=0;i<places.length;i++) {
  const p = places[i];
  const seedKey = String(p.seedKey || `${slugify(p.name || 'place')}-${i+1}`).slice(0,120);
  await request('/rest/v1/places?on_conflict=trip_id,seed_key', { method:'POST', headers, body:JSON.stringify({ trip_id:tripId,name:String(p.name||'').trim(),address:String(p.address||''),category:p.category||'other',priority:p.priority||'want',note:String(p.note||''),note_url:String(p.noteUrl||''),image_url:String(p.imageUrl||''),lat:Number.isFinite(Number(p.lat))?Number(p.lat):null,lng:Number.isFinite(Number(p.lng))?Number(p.lng):null,route_source:'fallback',source:'seed',seed_key:seedKey }) });
}
const checklists=Array.isArray(seed.checklists)?seed.checklists:[];
for(let i=0;i<checklists.length;i++){const c=checklists[i];await request('/rest/v1/checklists?on_conflict=id',{method:'POST',headers,body:JSON.stringify({id:c.id||crypto.randomUUID(),trip_id:tripId,title:String(c.title||'').trim(),category:c.category||'prepare',visibility:c.visibility||'public',done:Boolean(c.done),note:String(c.note||'')})});}
console.log(`seed: ${trip.name} (${trip.slug}) · ${places.length} địa điểm · ${checklists.length} checklist`);

async function request(pathname, options){const res=await fetch(`${url}${pathname}`,options);const text=await res.text();const payload=text?JSON.parse(text):null;if(!res.ok)throw new Error(`Seed HTTP ${res.status}: ${text}`);return payload}
function slugify(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'place'}
function loadEnv(filename){const full=path.resolve(filename);if(!fs.existsSync(full))return;for(const line of fs.readFileSync(full,'utf8').split(/\r?\n/)){const t=line.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<1)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!(k in process.env))process.env[k]=v}}
