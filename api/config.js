import { json } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(res, 405, { error: 'Method not allowed' }); }
  const lat = Number(process.env.HOME_LAT);
  const lng = Number(process.env.HOME_LNG);
  const configuredHome = Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180;
  const appEnv = normalizeAppEnv(process.env.APP_ENV);
  const firebase = firebaseConfig();
  return json(res, 200, {
    appEnv,
    home: configuredHome ? { address: envText('HOME_NAME', 'Home', 300), lat, lng, source: 'environment' } : null,
    routingConfigured: Boolean(process.env.OPENROUTESERVICE_API_KEY),
    data: {
      provider: appEnv === 'prod' ? 'firebase' : 'localStorage',
      defaultTripSlug: envText('DEFAULT_TRIP_SLUG', 'dalat-2026', 80),
      defaultTripName: envText('DEFAULT_TRIP_NAME', 'Đà Lạt 2026', 120),
      firebase: appEnv === 'prod' ? firebase : null
    },
    ui: {
      eyebrow: envText('UI_EYEBROW', 'ĐÀ LẠT · TRIP COMPANION', 80),
      title: envText('UI_TITLE', 'Ní ơi, mình đi đâu thế.', 100),
      subtitle: envText('UI_SUBTITLE', 'Lên danh sách, xem khoảng cách và chọn nơi đáng đi ngay lúc này.', 180),
      defaultPageSize: envNumber('UI_DEFAULT_PAGE_SIZE', 8),
      defaultRadiusKm: envNumber('UI_DEFAULT_RADIUS_KM', 5),
      defaultCategory: envText('UI_DEFAULT_CATEGORY', 'all', 24),
      defaultSort: envText('UI_DEFAULT_SORT', 'distance', 24),
      defaultRadarRadiusKm: envNumber('UI_DEFAULT_RADAR_RADIUS_KM', 5),
      defaultRadarCategory: envText('UI_DEFAULT_RADAR_CATEGORY', 'all', 24)
    }
  });
}
function normalizeAppEnv(value) { return String(value || 'local').trim().toLowerCase() === 'prod' ? 'prod' : 'local'; }
function envText(name, fallback, max) { const value = String(process.env[name] || '').trim(); return (value || fallback).slice(0, max); }
function envNumber(name, fallback) { const value = Number(process.env[name]); return Number.isFinite(value) ? value : fallback; }
function firebaseConfig() {
  const config = {
    apiKey: envText('FIREBASE_API_KEY', '', 256),
    authDomain: envText('FIREBASE_AUTH_DOMAIN', '', 256),
    projectId: envText('FIREBASE_PROJECT_ID', '', 128),
    appId: envText('FIREBASE_APP_ID', '', 256),
    messagingSenderId: envText('FIREBASE_MESSAGING_SENDER_ID', '', 128),
    storageBucket: envText('FIREBASE_STORAGE_BUCKET', '', 256)
  };
  return { configured: Boolean(config.apiKey && config.authDomain && config.projectId && config.appId), sdkVersion: '12.16.0', autoSeedDefaults: String(process.env.FIREBASE_AUTO_SEED_DEFAULTS || 'true').toLowerCase() !== 'false', ...config };
}
