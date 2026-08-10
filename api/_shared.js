const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function json(res, status, payload) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(JSON_HEADERS)) res.setHeader(key, value);
  res.end(JSON.stringify(payload));
}

export function allowPost(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    json(res, 405, { error: 'Method not allowed' });
    return false;
  }
  return true;
}

export async function readJson(req, maxBytes = 32_768) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Payload too large');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  return JSON.parse(text);
}

export function isFiniteCoord(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

export function validCoordPair(value) {
  return value && isFiniteCoord(value.lat, -90, 90) && isFiniteCoord(value.lng, -180, 180);
}

export function requireApiKey(res) {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) {
    json(res, 503, {
      error: 'OPENROUTESERVICE_API_KEY is not configured',
      code: 'ORS_NOT_CONFIGURED'
    });
    return null;
  }
  return apiKey;
}

export function orsBaseUrl() {
  return (process.env.ORS_BASE_URL || 'https://api.heigit.org').replace(/\/+$/, '');
}

export async function fetchJson(url, options = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } finally {
    clearTimeout(timer);
  }
}

export function providerErrorStatus(response) {
  if (response?.status === 401 || response?.status === 403) return 502;
  if (response?.status === 429) return 429;
  return 502;
}

export function providerMessage(payload, fallback) {
  const value = payload?.error?.message || payload?.error || payload?.message;
  return typeof value === 'string' && value.length <= 300 ? value : fallback;
}
