export const DEFAULT_RADIUS_KM = 5;
export const CATEGORIES = ['food', 'cafe', 'attraction', 'shopping', 'other'];
export const PRIORITIES = ['must', 'want', 'maybe'];
export const EXPENSE_CATEGORIES = ['food', 'cafe', 'transport', 'attraction', 'shopping', 'stay', 'other'];

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeText(value, max = 300) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function sanitizePlace(input = {}) {
  return {
    id: normalizeText(input.id, 80) || uid('place'),
    name: normalizeText(input.name, 120),
    address: normalizeText(input.address, 300),
    category: CATEGORIES.includes(input.category) ? input.category : 'other',
    priority: PRIORITIES.includes(input.priority) ? input.priority : 'want',
    note: normalizeText(input.note, 500),
    lat: finiteOrNull(input.lat, -90, 90),
    lng: finiteOrNull(input.lng, -180, 180),
    distanceMeters: nonNegativeOrNull(input.distanceMeters),
    durationSeconds: nonNegativeOrNull(input.durationSeconds),
    routeSource: ['ors', 'fallback'].includes(input.routeSource) ? input.routeSource : 'fallback',
    source: ['manual', 'google-maps-url', 'imported'].includes(input.source) ? input.source : 'manual',
    createdAt: validIso(input.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}


export function sanitizeExpense(input = {}) {
  return {
    id: normalizeText(input.id, 80) || uid('expense'),
    payer: normalizeText(input.payer, 80),
    category: EXPENSE_CATEGORIES.includes(input.category) ? input.category : 'other',
    amountVnd: positiveIntegerOrNull(input.amountVnd),
    note: normalizeText(input.note, 300),
    createdAt: validIso(input.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function validateExpense(expense) {
  const errors = [];
  if (!expense.payer || expense.payer.length < 2) errors.push('Tên người chi trả cần ít nhất 2 ký tự.');
  if (!Number.isFinite(expense.amountVnd) || expense.amountVnd <= 0) errors.push('Số tiền phải lớn hơn 0.');
  return errors;
}

export function totalExpenses(expenses) {
  return (Array.isArray(expenses) ? expenses : []).reduce((sum, expense) => sum + (Number.isFinite(expense.amountVnd) ? expense.amountVnd : 0), 0);
}

export function sanitizeHome(input = {}) {
  return {
    address: normalizeText(input.address, 300),
    lat: finiteOrNull(input.lat, -90, 90),
    lng: finiteOrNull(input.lng, -180, 180),
    updatedAt: new Date().toISOString()
  };
}

export function validatePlace(place) {
  const errors = [];
  if (!place.name || place.name.length < 2) errors.push('Tên địa điểm cần ít nhất 2 ký tự.');
  return errors;
}

export function parseGoogleMapsCoordinates(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const placeMatch = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (placeMatch) {
    const lat = Number(placeMatch[1]); const lng = Number(placeMatch[2]);
    if (coordsValid({ lat, lng })) return { lat, lng };
  }
  const viewportMatch = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (viewportMatch) {
    const lat = Number(viewportMatch[1]); const lng = Number(viewportMatch[2]);
    if (coordsValid({ lat, lng })) return { lat, lng };
  }
  return null;
}


export function googleMapsCoordinateUrl(lat, lng) {
  const point = { lat: finiteOrNull(lat, -90, 90), lng: finiteOrNull(lng, -180, 180) };
  if (!coordsValid(point)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${point.lat},${point.lng}`)}`;
}

export function haversineMeters(a, b) {
  if (!coordsValid(a) || !coordsValid(b)) return null;
  const R = 6371000; const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat); const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat); const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}


export function bearingDegrees(a, b) {
  if (!coordsValid(a) || !coordsValid(b)) return null;
  const toRad = (deg) => deg * Math.PI / 180;
  const toDeg = (rad) => rad * 180 / Math.PI;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function compassDirection(degrees) {
  if (!Number.isFinite(degrees)) return '—';
  const labels = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];
  return labels[Math.round(((degrees % 360) + 360) % 360 / 45) % 8];
}


export function filterRadarPlaces(places, home, { category = 'all', radiusKm = DEFAULT_RADIUS_KM } = {}) {
  if (!coordsValid(home)) return [];
  const radius = Number(radiusKm);
  return (Array.isArray(places) ? places : []).filter((place) => {
    if (!coordsValid(place)) return false;
    if (category !== 'all' && place.category !== category) return false;
    if (Number.isFinite(radius) && radius > 0 && radius < 9999) {
      const meters = haversineMeters(home, place);
      if (!Number.isFinite(meters) || meters > radius * 1000) return false;
    }
    return true;
  });
}

export function resolveRadarRadiusKm(places, requestedRadiusKm = DEFAULT_RADIUS_KM, home = null) {
  const requested = Number(requestedRadiusKm);
  if (Number.isFinite(requested) && requested > 0 && requested < 9999) return requested;
  if (!coordsValid(home)) return DEFAULT_RADIUS_KM;
  const maxMeters = (Array.isArray(places) ? places : [])
    .filter(coordsValid)
    .map((place) => haversineMeters(home, place))
    .filter(Number.isFinite)
    .reduce((max, meters) => Math.max(max, meters), 0);
  const maxKm = Math.max(1, maxMeters / 1000);
  const niceSteps = [1, 2, 3, 5, 8, 10, 15, 20, 30, 50, 80, 100];
  return niceSteps.find((step) => step >= maxKm) ?? Math.ceil(maxKm / 25) * 25;
}

export function buildRadarPoints(home, places, radiusKm = DEFAULT_RADIUS_KM) {
  if (!coordsValid(home)) return [];
  const maxMeters = Math.max(1, Number(radiusKm) * 1000);
  return (Array.isArray(places) ? places : [])
    .filter(coordsValid)
    .map((place) => {
      const straightMeters = haversineMeters(home, place);
      const bearing = bearingDegrees(home, place);
      if (!Number.isFinite(straightMeters) || !Number.isFinite(bearing)) return null;
      const theta = bearing * Math.PI / 180;
      const radialRatio = Math.min(1, straightMeters / maxMeters);
      return {
        id: place.id,
        name: place.name,
        category: place.category,
        priority: place.priority,
        lat: place.lat,
        lng: place.lng,
        distanceMeters: straightMeters,
        bearingDegrees: bearing,
        direction: compassDirection(bearing),
        radialRatio,
        x: Math.sin(theta) * radialRatio,
        y: -Math.cos(theta) * radialRatio,
        isOutside: straightMeters > maxMeters
      };
    })
    .filter(Boolean);
}

export function estimateRoadMeters(straightMeters) {
  if (!Number.isFinite(straightMeters)) return null;
  return Math.round(straightMeters * 1.32);
}

// Conservative Dalat ETA model for fallback and sanity-flooring provider durations.
// It accounts for steep roads, intersections, urban traffic and slower average speeds.
export function estimateDurationSeconds(distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return null;
  if (distanceMeters === 0) return 60;
  const km = distanceMeters / 1000;
  let speedKmh; let bufferMinutes;
  if (km <= 2) { speedKmh = 16; bufferMinutes = 2; }
  else if (km <= 5) { speedKmh = 20; bufferMinutes = 3; }
  else if (km <= 12) { speedKmh = 24; bufferMinutes = 5; }
  else { speedKmh = 28; bufferMinutes = 7; }
  return Math.max(120, Math.round((km / speedKmh) * 3600 + bufferMinutes * 60));
}

export function calibrateDurationSeconds(distanceMeters, providerDurationSeconds) {
  const floor = estimateDurationSeconds(distanceMeters);
  if (!Number.isFinite(providerDurationSeconds) || providerDurationSeconds < 0) return floor;
  return Math.max(Math.round(providerDurationSeconds), floor ?? 0);
}

export function voteCountFor(placeId, votes = []) {
  return (Array.isArray(votes) ? votes : []).reduce((count, vote) => count + (vote?.place_id === placeId || vote?.placeId === placeId ? 1 : 0), 0);
}

export function hasUserVoted(placeId, userId, votes = []) {
  return Boolean(userId) && (Array.isArray(votes) ? votes : []).some((vote) => (vote?.place_id === placeId || vote?.placeId === placeId) && (vote?.user_id === userId || vote?.userId === userId));
}

export function recommendPlaces(places, votes = [], limit = 6) {
  const safeLimit = Math.max(1, Math.min(24, Number.parseInt(limit, 10) || 6));
  return (Array.isArray(places) ? places : [])
    .filter((place) => Number.isFinite(place.distanceMeters))
    .map((place) => ({ place, votes: voteCountFor(place.id, votes) }))
    .sort((a, b) => b.votes - a.votes || numericOrInfinity(a.place.distanceMeters) - numericOrInfinity(b.place.distanceMeters) || scorePlace(b.place) - scorePlace(a.place) || a.place.name.localeCompare(b.place.name, 'vi'))
    .slice(0, safeLimit)
    .map((entry) => ({ ...entry.place, voteCount: entry.votes }));
}

export function scorePlace(place, now = new Date()) {
  const km = Number.isFinite(place.distanceMeters) ? place.distanceMeters / 1000 : 999;
  const distanceScore = Math.max(0, 55 - km * 8);
  const priorityScore = place.priority === 'must' ? 25 : place.priority === 'want' ? 14 : 5;
  const hour = now.getHours(); let contextScore = 0;
  if (place.category === 'food' && ((hour >= 6 && hour <= 9) || (hour >= 11 && hour <= 13) || (hour >= 17 && hour <= 20))) contextScore += 12;
  if (place.category === 'cafe' && hour >= 7 && hour <= 18) contextScore += 8;
  if (place.category === 'attraction' && hour >= 8 && hour <= 17) contextScore += 7;
  return Math.round(distanceScore + priorityScore + contextScore);
}

export function filterAndSortPlaces(places, { radiusKm = DEFAULT_RADIUS_KM, category = 'all', query = '', sort = 'distance' } = {}) {
  const normalizedQuery = normalizeText(query, 100).toLocaleLowerCase('vi');
  const result = places.filter((place) => {
    if (category !== 'all' && place.category !== category) return false;
    if (Number.isFinite(radiusKm) && radiusKm > 0 && Number.isFinite(place.distanceMeters) && place.distanceMeters > radiusKm * 1000) return false;
    if (normalizedQuery) {
      const haystack = `${place.name} ${place.address} ${place.note}`.toLocaleLowerCase('vi');
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  });
  return result.sort((a, b) => {
    if (sort === 'recommended') return scorePlace(b) - scorePlace(a);
    if (sort === 'name') return a.name.localeCompare(b.name, 'vi');
    return numericOrInfinity(a.distanceMeters) - numericOrInfinity(b.distanceMeters);
  });
}


export function paginateItems(items, page = 1, pageSize = 8) {
  const safeItems = Array.isArray(items) ? items : [];
  const safePageSize = Math.max(1, Math.min(100, Number.parseInt(pageSize, 10) || 8));
  const totalItems = safeItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(Math.max(1, Number.parseInt(page, 10) || 1), totalPages);
  const startIndex = (currentPage - 1) * safePageSize;
  return {
    items: safeItems.slice(startIndex, startIndex + safePageSize),
    currentPage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    startIndex,
    endIndex: Math.min(startIndex + safePageSize, totalItems)
  };
}

export function groupNearby(places, thresholdMeters = 1800) {
  const withCoords = places.filter(coordsValid); const groups = []; const seen = new Set();
  for (const seed of withCoords) {
    if (seen.has(seed.id)) continue;
    const group = [seed]; seen.add(seed.id);
    for (const candidate of withCoords) {
      if (seen.has(candidate.id)) continue;
      const distance = haversineMeters(seed, candidate);
      if (distance !== null && distance <= thresholdMeters) { group.push(candidate); seen.add(candidate.id); }
    }
    groups.push(group);
  }
  return groups.sort((a, b) => b.length - a.length);
}

export function exportState(state) {
  return JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), home: sanitizeHome(state.home), places: Array.isArray(state.places) ? state.places.map(sanitizePlace) : [], expenses: Array.isArray(state.expenses) ? state.expenses.map(sanitizeExpense) : [] }, null, 2);
}

export function importState(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('File không hợp lệ.');
  return { home: sanitizeHome(parsed.home ?? {}), places: Array.isArray(parsed.places) ? parsed.places.slice(0, 1000).map(sanitizePlace) : [], expenses: Array.isArray(parsed.expenses) ? parsed.expenses.slice(0, 5000).map(sanitizeExpense) : [] };
}

function finiteOrNull(value, min, max) { if (value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) && n >= min && n <= max ? n : null; }
function positiveIntegerOrNull(value) { if (value === null || value === undefined || value === '') return null; const n = Number(String(value).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; }
function nonNegativeOrNull(value) { if (value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.round(n) : null; }
function coordsValid(value) { return value && Number.isFinite(value.lat) && Number.isFinite(value.lng) && value.lat >= -90 && value.lat <= 90 && value.lng >= -180 && value.lng <= 180; }
function numericOrInfinity(value) { return Number.isFinite(value) ? value : Infinity; }
function validIso(value) { if (typeof value !== 'string') return null; return Number.isNaN(Date.parse(value)) ? null : new Date(value).toISOString(); }
