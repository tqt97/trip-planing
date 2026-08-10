import { allowPost, fetchJson, json, orsBaseUrl, providerErrorStatus, providerMessage, readJson, requireApiKey, validCoordPair } from './_shared.js';

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;
  const apiKey = requireApiKey(res);
  if (!apiKey) return;

  try {
    const { origin, destination } = await readJson(req);
    if (!validCoordPair(origin) || !validCoordPair(destination)) {
      return json(res, 400, { error: 'Invalid coordinates' });
    }

    const body = {
      locations: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
      sources: [0],
      destinations: [1],
      metrics: ['distance', 'duration'],
      units: 'm'
    };

    const { response, payload } = await fetchJson(`${orsBaseUrl()}/openrouteservice/v2/matrix/driving-car`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body)
    }, 10_000);

    if (!response.ok) {
      return json(res, providerErrorStatus(response), {
        error: providerMessage(payload, 'Routing provider failed'),
        code: response.status === 429 ? 'ORS_QUOTA_EXCEEDED' : 'ORS_PROVIDER_ERROR'
      });
    }

    const distanceMeters = finiteNonNegative(payload?.distances?.[0]?.[0]);
    const durationSeconds = finiteNonNegative(payload?.durations?.[0]?.[0]);
    if (distanceMeters === null || durationSeconds === null) {
      return json(res, 502, { error: 'No drivable route found', code: 'ROUTE_NOT_FOUND' });
    }

    return json(res, 200, { distanceMeters, durationSeconds, provider: 'openrouteservice' });
  } catch (error) {
    if (error?.name === 'AbortError') return json(res, 504, { error: 'Routing provider timeout' });
    const status = error?.message === 'Payload too large' ? 413 : 400;
    return json(res, status, { error: status === 413 ? error.message : 'Invalid request' });
  }
}

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}
