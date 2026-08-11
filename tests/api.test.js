import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import routeHandler from '../api/route.js';
import matrixHandler from '../api/matrix.js';
import configHandler from '../api/config.js';

function request(body, method = 'POST') {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = method;
  return req;
}

function response() {
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const headers = {};
  return {
    statusCode: 200,
    headers,
    body: '',
    done,
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    end(value = '') { this.body += value; resolve(this); }
  };
}

async function withProvider(fn) {
  const oldKey = process.env.OPENROUTESERVICE_API_KEY;
  const oldBase = process.env.ORS_BASE_URL;
  const oldFetch = globalThis.fetch;
  process.env.OPENROUTESERVICE_API_KEY = ['test','key'].join('-');
  process.env.ORS_BASE_URL = 'https://api.heigit.org';
  try { await fn(); }
  finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENROUTESERVICE_API_KEY; else process.env.OPENROUTESERVICE_API_KEY = oldKey;
    if (oldBase === undefined) delete process.env.ORS_BASE_URL; else process.env.ORS_BASE_URL = oldBase;
  }
}

test('matrix makes one-to-many ORS request with lng-lat coordinate order', async () => withProvider(async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).pathname, '/openrouteservice/v2/matrix/driving-car');
    assert.equal(options.headers.Authorization, 'test-key');
    const body = JSON.parse(options.body);
    assert.deepEqual(body.locations, [[108.44, 11.94], [108.45, 11.95], [108.46, 11.96]]);
    assert.deepEqual(body.sources, [0]);
    assert.deepEqual(body.destinations, [1, 2]);
    return new Response(JSON.stringify({ distances: [[1200.3, 2500.8]], durations: [[300.2, 640.7]] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const res = response();
  await matrixHandler(request({ origin: { lat: 11.94, lng: 108.44 }, destinations: [{ lat: 11.95, lng: 108.45 }, { lat: 11.96, lng: 108.46 }] }), res);
  await res.done;
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body).results, [
    { distanceMeters: 1200, durationSeconds: 300 },
    { distanceMeters: 2501, durationSeconds: 641 }
  ]);
}));

test('route uses matrix endpoint for one destination', async () => withProvider(async () => {
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(body.locations, [[108.44, 11.94], [108.45, 11.95]]);
    return new Response(JSON.stringify({ distances: [[1500]], durations: [[360]] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const res = response();
  await routeHandler(request({ origin: { lat: 11.94, lng: 108.44 }, destination: { lat: 11.95, lng: 108.45 } }), res);
  await res.done;
  assert.deepEqual(JSON.parse(res.body), { distanceMeters: 1500, durationSeconds: 360, provider: 'openrouteservice' });
}));

test('API returns explicit config error when ORS key is missing', async () => {
  const oldKey = process.env.OPENROUTESERVICE_API_KEY;
  delete process.env.OPENROUTESERVICE_API_KEY;
  try {
    const res = response();
    await routeHandler(request({ origin: { lat: 11.94, lng: 108.44 }, destination: { lat: 11.95, lng: 108.45 } }), res);
    await res.done;
    assert.equal(res.statusCode, 503);
    assert.equal(JSON.parse(res.body).code, 'ORS_NOT_CONFIGURED');
  } finally {
    if (oldKey !== undefined) process.env.OPENROUTESERVICE_API_KEY = oldKey;
  }
});


test('config exposes only fixed Home and routing availability, never the ORS key', async () => {
  const old = { name: process.env.HOME_NAME, lat: process.env.HOME_LAT, lng: process.env.HOME_LNG, key: process.env.OPENROUTESERVICE_API_KEY };
  process.env.HOME_NAME = 'Hotel Trường An Hotel';
  process.env.HOME_LAT = '11.9370985';
  process.env.HOME_LNG = '108.4220004';
  process.env.OPENROUTESERVICE_API_KEY = ['private','test','key'].join('-');
  try {
    const req = { method: 'GET' };
    const res = response();
    await configHandler(req, res); await res.done;
    const payload = JSON.parse(res.body);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(payload.home, { address: 'Hotel Trường An Hotel', lat: 11.9370985, lng: 108.4220004, source: 'environment' });
    assert.equal(payload.routingConfigured, true);
    assert.equal(res.body.includes(process.env.OPENROUTESERVICE_API_KEY), false);
  } finally {
    for (const [envKey, value] of [['HOME_NAME', old.name], ['HOME_LAT', old.lat], ['HOME_LNG', old.lng], ['OPENROUTESERVICE_API_KEY', old.key]]) {
      if (value === undefined) delete process.env[envKey]; else process.env[envKey] = value;
    }
  }
});

test('config exposes Supabase publishable config but never service-role secret', async () => {
  const old = { env:process.env.APP_ENV,url:process.env.SUPABASE_URL,pub:process.env.SUPABASE_PUBLISHABLE_KEY,service:process.env.SUPABASE_SERVICE_ROLE_KEY,slug:process.env.DEFAULT_TRIP_SLUG };
  process.env.APP_ENV='prod';
  process.env.SUPABASE_URL='https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_public_test';
  process.env.SUPABASE_SERVICE_ROLE_KEY=['super','secret','service'].join('-');
  process.env.DEFAULT_TRIP_SLUG='dalat-2026';
  try {
    const res=response(); await configHandler({method:'GET'},res); await res.done; const payload=JSON.parse(res.body);
    assert.equal(payload.collaboration.configured,true);
    assert.equal(payload.collaboration.supabaseUrl,'https://example.supabase.co');
    assert.equal(payload.collaboration.publishableKey,'sb_publishable_public_test');
    assert.equal(payload.collaboration.defaultTripSlug,'dalat-2026');
    assert.equal(res.body.includes(process.env.SUPABASE_SERVICE_ROLE_KEY),false);
  } finally {
    for(const [k,v] of [['APP_ENV',old.env],['SUPABASE_URL',old.url],['SUPABASE_PUBLISHABLE_KEY',old.pub],['SUPABASE_SERVICE_ROLE_KEY',old.service],['DEFAULT_TRIP_SLUG',old.slug]]) v===undefined?delete process.env[k]:process.env[k]=v;
  }
});


test('config exposes bounded UI defaults from environment', async () => {
  const keys = ['UI_TITLE','UI_SUBTITLE','UI_EYEBROW','UI_DEFAULT_PAGE_SIZE','UI_DEFAULT_RADIUS_KM','UI_DEFAULT_CATEGORY','UI_DEFAULT_SORT','UI_DEFAULT_RADAR_RADIUS_KM','UI_DEFAULT_RADAR_CATEGORY'];
  const old = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  Object.assign(process.env, {
    UI_TITLE:'Trip test', UI_SUBTITLE:'Đi thôi', UI_EYEBROW:'DALAT', UI_DEFAULT_PAGE_SIZE:'12', UI_DEFAULT_RADIUS_KM:'10', UI_DEFAULT_CATEGORY:'cafe', UI_DEFAULT_SORT:'recommended', UI_DEFAULT_RADAR_RADIUS_KM:'3', UI_DEFAULT_RADAR_CATEGORY:'food'
  });
  try {
    const res=response(); await configHandler({method:'GET'},res); await res.done; const payload=JSON.parse(res.body);
    assert.equal(payload.ui.title,'Trip test');
    assert.equal(payload.ui.defaultPageSize,12);
    assert.equal(payload.ui.defaultRadiusKm,10);
    assert.equal(payload.ui.defaultCategory,'cafe');
    assert.equal(payload.ui.defaultSort,'recommended');
    assert.equal(payload.ui.defaultRadarRadiusKm,3);
    assert.equal(payload.ui.defaultRadarCategory,'food');
  } finally { for (const k of keys) old[k] === undefined ? delete process.env[k] : process.env[k] = old[k]; }
});

test('APP_ENV local selects localStorage and hides Supabase client config', async () => {
  const keys=['APP_ENV','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY']; const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  Object.assign(process.env,{APP_ENV:'local',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public'});
  try { const res=response(); await configHandler({method:'GET'},res); await res.done; const p=JSON.parse(res.body); assert.equal(p.appEnv,'local'); assert.equal(p.data.provider,'localStorage'); assert.equal(p.collaboration.configured,false); assert.equal(p.collaboration.supabaseUrl,''); assert.equal(p.collaboration.publishableKey,''); }
  finally { for(const k of keys) old[k]===undefined?delete process.env[k]:process.env[k]=old[k]; }
});

test('APP_ENV prod selects Supabase when public config is present', async () => {
  const keys=['APP_ENV','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','DEFAULT_TRIP_SLUG']; const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  Object.assign(process.env,{APP_ENV:'prod',SUPABASE_URL:'https://abc.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public',DEFAULT_TRIP_SLUG:'dalat-2026'});
  try { const res=response(); await configHandler({method:'GET'},res); await res.done; const p=JSON.parse(res.body); assert.equal(p.appEnv,'prod'); assert.equal(p.data.provider,'supabase'); assert.equal(p.collaboration.configured,true); assert.equal(p.collaboration.supabaseUrl,'https://abc.supabase.co'); assert.equal(p.collaboration.defaultTripSlug,'dalat-2026'); }
  finally { for(const k of keys) old[k]===undefined?delete process.env[k]:process.env[k]=old[k]; }
});
