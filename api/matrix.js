import { allowPost, fetchJson, json, orsBaseUrl, providerErrorStatus, providerMessage, readJson, requireApiKey, validCoordPair } from './_shared.js';

const MAX_DESTINATIONS = 100;

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;
  const apiKey = requireApiKey(res);
  if (!apiKey) return;

  try {
    const { origin, destinations } = await readJson(req, 64_000);
    if (!validCoordPair(origin) || !Array.isArray(destinations) || destinations.length < 1 || destinations.length > MAX_DESTINATIONS || destinations.some((item) => !validCoordPair(item))) {
      return json(res, 400, { error: `Origin and 1-${MAX_DESTINATIONS} valid destinations are required` });
    }

    const locations = [origin, ...destinations].map((point) => [point.lng, point.lat]);
    const body = {
      locations,
      sources: [0],
      destinations: destinations.map((_, index) => index + 1),
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
    }, 12_000);

    if (!response.ok) {
      return json(res, providerErrorStatus(response), {
        error: providerMessage(payload, 'Routing matrix provider failed'),
        code: response.status === 429 ? 'ORS_QUOTA_EXCEEDED' : 'ORS_PROVIDER_ERROR'
      });
    }

    const distanceRow = payload?.distances?.[0];
    const durationRow = payload?.durations?.[0];
    if (!Array.isArray(distanceRow) || !Array.isArray(durationRow)) {
      return json(res, 502, { error: 'Routing matrix provider returned an invalid response', code: 'ORS_PROVIDER_ERROR' });
    }

    const results = destinations.map((_, index) => ({
      distanceMeters: finiteNonNegative(distanceRow[index]),
      durationSeconds: finiteNonNegative(durationRow[index]),
    }));

    return json(res, 200, { results, provider: 'openrouteservice' });
  } catch (error) {
    if (error?.name === 'AbortError') return json(res, 504, { error: 'Routing matrix provider timeout' });
    const status = error?.message === 'Payload too large' ? 413 : 400;
    return json(res, status, { error: status === 413 ? error.message : 'Invalid request' });
  }
}

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}
