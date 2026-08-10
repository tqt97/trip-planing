import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bearingDegrees,
  buildRadarPoints,
  calibrateDurationSeconds,
  compassDirection,
  estimateDurationSeconds,
  estimateRoadMeters,
  exportState,
  filterAndSortPlaces,
  filterRadarPlaces,
  groupNearby,
  googleMapsCoordinateUrl,
  haversineMeters,
  importState,
  parseGoogleMapsCoordinates,
  resolveRadarRadiusKm,
  paginateItems,
  sanitizeExpense,
  sanitizeHome,
  sanitizePlace,
  scorePlace,
  totalExpenses,
  validateExpense,
  validatePlace,
  recommendPlaces,
  hasUserVoted
} from '../src/core.js';

test('sanitizePlace normalizes hostile/oversized inputs', () => {
  const place = sanitizePlace({
    name: '   A   B   ',
    address: ' x '.repeat(500),
    category: 'not-real',
    priority: 'root',
    lat: '999',
    lng: '108.4',
    distanceMeters: -4,
    note: 'n'.repeat(700)
  });
  assert.equal(place.name, 'A B');
  assert.equal(place.category, 'other');
  assert.equal(place.priority, 'want');
  assert.equal(place.lat, null);
  assert.equal(place.lng, 108.4);
  assert.equal(place.distanceMeters, null);
  assert.equal(place.address.length <= 300, true);
  assert.equal(place.note.length, 500);
});

test('validatePlace requires a usable name; address is optional in coordinate-first mode', () => {
  assert.equal(validatePlace(sanitizePlace({ name: 'A' })).length, 1);
  assert.deepEqual(validatePlace(sanitizePlace({ name: 'Cafe ABC' })), []);
});

test('Google Maps parser prefers exact place coordinates over viewport coordinates', () => {
  const url = 'https://www.google.com/maps/place/Hotel+Truong+An/@11.9368184,108.4220488,19.25z/data=!4m9!3m8!1sabc!8m2!3d11.9370985!4d108.4220004!16sabc';
  assert.deepEqual(parseGoogleMapsCoordinates(url), { lat: 11.9370985, lng: 108.4220004 });
  assert.deepEqual(parseGoogleMapsCoordinates('https://maps.google.com/@11.9,108.4,16z'), { lat: 11.9, lng: 108.4 });
  assert.equal(parseGoogleMapsCoordinates('not a maps url'), null);
});

test('haversine returns plausible distance in Dalat', () => {
  const a = { lat: 11.9404, lng: 108.4583 };
  const b = { lat: 11.9425, lng: 108.4367 };
  const meters = haversineMeters(a, b);
  assert.ok(meters > 2200 && meters < 2600, `unexpected ${meters}`);
  assert.equal(estimateRoadMeters(meters) > meters, true);
  assert.equal(estimateDurationSeconds(1000), 345);
  assert.ok(estimateDurationSeconds(11000) >= 1800);
  assert.equal(calibrateDurationSeconds(11000, 720), estimateDurationSeconds(11000));
});

test('filterAndSortPlaces filters radius/category/query and handles unknown distance', () => {
  const places = [
    sanitizePlace({ name:'A', address:'one', category:'food', distanceMeters:500 }),
    sanitizePlace({ name:'B', address:'two', category:'cafe', distanceMeters:2500 }),
    sanitizePlace({ name:'C', address:'three', category:'food', distanceMeters:null })
  ];
  const filtered = filterAndSortPlaces(places,{radiusKm:1,category:'food'});
  assert.deepEqual(filtered.map(p=>p.name), ['A','C']);
  assert.deepEqual(filterAndSortPlaces(places,{radiusKm:10,query:'two'}).map(p=>p.name), ['B']);
});

test('recommendation score favors closer must-go places', () => {
  const nearMust = sanitizePlace({ name:'Near', address:'x', priority:'must', distanceMeters:500, category:'other' });
  const farMaybe = sanitizePlace({ name:'Far', address:'x', priority:'maybe', distanceMeters:5000, category:'other' });
  assert.ok(scorePlace(nearMust,new Date('2026-08-09T14:00:00')) > scorePlace(farMaybe,new Date('2026-08-09T14:00:00')));
});

test('groupNearby creates clusters without duplicate place ids', () => {
  const places = [
    sanitizePlace({id:'a',name:'A',address:'x',lat:11.94,lng:108.44}),
    sanitizePlace({id:'b',name:'B',address:'x',lat:11.941,lng:108.441}),
    sanitizePlace({id:'c',name:'C',address:'x',lat:11.99,lng:108.49})
  ];
  const groups = groupNearby(places,500);
  assert.equal(groups[0].length,2);
  assert.equal(new Set(groups.flat().map(p=>p.id)).size,3);
});

test('state export/import round trip is bounded and sanitized', () => {
  const home=sanitizeHome({address:'Home',lat:11.94,lng:108.44});
  const places=[sanitizePlace({name:'Cafe',address:'Dalat',lat:11.95,lng:108.45})];
  const restored=importState(exportState({home,places}));
  assert.equal(restored.home.address,'Home');
  assert.equal(restored.places.length,1);
  assert.equal(restored.places[0].name,'Cafe');
});

test('import rejects malformed JSON', () => {
  assert.throws(()=>importState('{oops'));
});

test('paginateItems clamps pages and returns stable page metadata', () => {
  const items = Array.from({ length: 11 }, (_, i) => i + 1);
  const first = paginateItems(items, 1, 4);
  assert.deepEqual(first.items, [1,2,3,4]);
  assert.equal(first.totalPages, 3);
  assert.equal(first.startIndex, 0);
  assert.equal(first.endIndex, 4);
  const last = paginateItems(items, 99, 4);
  assert.deepEqual(last.items, [9,10,11]);
  assert.equal(last.currentPage, 3);
  assert.equal(last.endIndex, 11);
});


test('radar helpers compute cardinal direction and normalized position around Home', () => {
  const home = { lat: 11.9370985, lng: 108.4220004 };
  const north = sanitizePlace({ id:'north', name:'North', lat:11.9470985, lng:108.4220004 });
  const east = sanitizePlace({ id:'east', name:'East', lat:11.9370985, lng:108.4320004 });
  const south = sanitizePlace({ id:'south', name:'South', lat:11.9270985, lng:108.4220004 });
  const west = sanitizePlace({ id:'west', name:'West', lat:11.9370985, lng:108.4120004 });
  assert.equal(compassDirection(bearingDegrees(home, north)), 'Bắc');
  assert.equal(compassDirection(bearingDegrees(home, east)), 'Đông');
  assert.equal(compassDirection(bearingDegrees(home, south)), 'Nam');
  assert.equal(compassDirection(bearingDegrees(home, west)), 'Tây');
  const points = buildRadarPoints(home, [north, east, south, west], 3);
  assert.equal(points.length, 4);
  assert.ok(points.every((point) => point.radialRatio > 0 && point.radialRatio < 1));
  assert.ok(points.find((point) => point.id === 'north').y < 0);
  assert.ok(points.find((point) => point.id === 'east').x > 0);
  assert.equal(points.find((point) => point.id === 'north').lat, north.lat);
  assert.equal(points.find((point) => point.id === 'north').lng, north.lng);
});

test('radar radius follows selected radius and derives a nice bound for All', () => {
  const home = { lat: 11.9370985, lng: 108.4220004 };
  const places = [sanitizePlace({ name:'Far', lat:12.02, lng:108.4220004 })];
  assert.equal(resolveRadarRadiusKm(places, 5, home), 5);
  const dynamic = resolveRadarRadiusKm(places, 9999, home);
  assert.ok(dynamic >= 8 && dynamic <= 15, `unexpected dynamic radius ${dynamic}`);
});


test('Google Maps coordinate link is safe and deterministic', () => {
  assert.equal(googleMapsCoordinateUrl(11.9370985, 108.4220004), 'https://www.google.com/maps/search/?api=1&query=11.9370985%2C108.4220004');
  assert.equal(googleMapsCoordinateUrl(999, 108.4), null);
  assert.equal(googleMapsCoordinateUrl('', ''), null);
});


test('radar filters category and straight-line radius independently', () => {
  const home = { lat: 11.9370985, lng: 108.4220004 };
  const places = [
    sanitizePlace({ name:'Near cafe', category:'cafe', lat:11.939, lng:108.423 }),
    sanitizePlace({ name:'Near food', category:'food', lat:11.940, lng:108.424 }),
    sanitizePlace({ name:'Far cafe', category:'cafe', lat:12.02, lng:108.422 })
  ];
  assert.deepEqual(filterRadarPlaces(places, home, { category:'cafe', radiusKm:3 }).map(p=>p.name), ['Near cafe']);
  assert.equal(filterRadarPlaces(places, home, { category:'all', radiusKm:9999 }).length, 3);
});

test('expenses are sanitized, validated, totaled and preserved in export/import', () => {
  const expense = sanitizeExpense({ payer:'  Ní  ', category:'food', amountVnd:'150000', note:'  Bữa tối  ' });
  assert.equal(expense.payer, 'Ní');
  assert.equal(expense.amountVnd, 150000);
  assert.deepEqual(validateExpense(expense), []);
  assert.equal(validateExpense(sanitizeExpense({ payer:'N', amountVnd:0 })).length, 2);
  assert.equal(totalExpenses([expense, sanitizeExpense({ payer:'Bạn', amountVnd:50000 })]), 200000);
  const restored = importState(exportState({ home:sanitizeHome({}), places:[], expenses:[expense] }));
  assert.equal(restored.expenses.length, 1);
  assert.equal(restored.expenses[0].amountVnd, 150000);
});

test('recommendPlaces ranks votes first then distance and limits top 6', () => {
  const places = Array.from({ length: 8 }, (_, i) => sanitizePlace({ id:`p${i}`, name:`P${i}`, lat:11+i*0.001, lng:108, distanceMeters:(i+1)*1000, durationSeconds:600 }));
  const votes = [
    { place_id:'p5', user_id:'u1' }, { place_id:'p5', user_id:'u2' },
    { place_id:'p3', user_id:'u1' }, { place_id:'p3', user_id:'u2' },
    { place_id:'p1', user_id:'u1' }
  ];
  const ranked = recommendPlaces(places, votes, 6);
  assert.equal(ranked.length, 6);
  assert.deepEqual(ranked.slice(0,2).map(x=>x.id), ['p3','p5']);
  assert.equal(ranked[0].voteCount, 2);
  assert.equal(ranked[2].id, 'p1');
});

test('hasUserVoted supports database vote row shape', () => {
  assert.equal(hasUserVoted('p1','u1',[{place_id:'p1',user_id:'u1'}]), true);
  assert.equal(hasUserVoted('p1','u2',[{place_id:'p1',user_id:'u1'}]), false);
});
