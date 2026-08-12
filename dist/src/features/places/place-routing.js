import { calibrateDurationSeconds, estimateDurationSeconds, estimateRoadMeters, haversineMeters, uid } from '../../core.js';
import { validCoords } from '../../app/ui.js';

export function createPlaceRouting({ state, trace, errorDetails }) {
  async function api(url, body) {
    const clientTrace = uid('trace'); const started = performance.now();
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client-Trace-Id': clientTrace }, body: JSON.stringify(body) });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) { const err = new Error(payload.error || `HTTP ${res.status}`); err.code = payload.code || `HTTP_${res.status}`; err.traceId = clientTrace; throw err; }
      const elapsed = Math.round(performance.now() - started);
      trace(elapsed > 1500 ? 'warn' : 'info', elapsed > 1500 ? 'API_SLOW' : 'API_OK', `${url} ${elapsed}ms`, { traceId: clientTrace, elapsedMs: elapsed });
      return payload;
    } catch (error) {
      trace('error', 'API_FAILED', `${url}: ${error.message}`, { traceId: clientTrace, code: error.code }); throw error;
    }
  }

  function applyFallbackDistance(place) {
    const straight = haversineMeters(state.home, place); const road = estimateRoadMeters(straight);
    place.distanceMeters = road; place.durationSeconds = estimateDurationSeconds(road); place.routeSource = 'fallback';
  }

  async function calculateDistance(place) {
    if (!validCoords(state.home) || !validCoords(place)) { place.distanceMeters = null; place.durationSeconds = null; return; }
    try {
      const result = await api('/api/route', { origin: { lat: state.home.lat, lng: state.home.lng }, destination: { lat: place.lat, lng: place.lng } });
      place.distanceMeters = result.distanceMeters; place.durationSeconds = calibrateDurationSeconds(result.distanceMeters, result.durationSeconds); place.routeSource = 'ors';
    } catch (err) { applyFallbackDistance(place); throw err; }
  }

  async function refreshAllDistances() {
    const places = state.places.filter(validCoords); if (!validCoords(state.home) || !places.length) return;
    try {
      const result = await api('/api/matrix', { origin: { lat: state.home.lat, lng: state.home.lng }, destinations: places.map((p) => ({ lat: p.lat, lng: p.lng })) });
      places.forEach((place, index) => { const route = result.results?.[index]; if (Number.isFinite(route?.distanceMeters)) { place.distanceMeters = route.distanceMeters; place.durationSeconds = calibrateDurationSeconds(route.distanceMeters, route.durationSeconds); place.routeSource = 'ors'; } else applyFallbackDistance(place); });
      trace('info', 'MATRIX_REFRESH_OK', `Đã cập nhật ${places.length} địa điểm bằng ORS.`);
    } catch (err) {
      places.forEach(applyFallbackDistance); trace('warn', 'MATRIX_REFRESH_FALLBACK', 'ORS không sẵn sàng; chuyển toàn bộ sang ETA fallback.', errorDetails(err)); throw err;
    }
  }

  return { applyFallbackDistance, calculateDistance, refreshAllDistances };
}
