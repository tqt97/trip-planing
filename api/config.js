import { json } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(res, 405, { error: 'Method not allowed' }); }

  const rawEnv = String(process.env.APP_ENV || 'local').trim().toLowerCase();
  const appEnv = rawEnv === 'prod' ? 'prod' : 'local';
  const lat = Number(process.env.HOME_LAT);
  const lng = Number(process.env.HOME_LNG);
  const configuredHome = Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180;
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  const collaboration = {
    configured: appEnv === 'prod' && Boolean(supabaseUrl && publishableKey),
    supabaseUrl: appEnv === 'prod' ? supabaseUrl : '',
    publishableKey: appEnv === 'prod' ? publishableKey : '',
    defaultTripSlug: envText('DEFAULT_TRIP_SLUG', 'dalat-2026', 80)
  };

  return json(res, 200, {
    appEnv,
    home: configuredHome ? { address: envText('HOME_NAME', 'Home', 300), lat, lng, source: 'environment' } : null,
    routingConfigured: Boolean(process.env.OPENROUTESERVICE_API_KEY),
    data: { provider: appEnv === 'prod' ? 'supabase' : 'localStorage' },
    collaboration,
    ui: {
      eyebrow: envText('UI_EYEBROW', 'ĐÀ LẠT · TRIP COMPANION', 80),
      title: envText('UI_TITLE', 'Ní ơi, mình đi đâu thế.', 100),
      subtitle: envText('UI_SUBTITLE', 'Lên danh sách, xem khoảng cách và chọn nơi đáng đi ngay lúc này.', 180),
      defaultPageSize: envNumber('UI_DEFAULT_PAGE_SIZE', 8),
      defaultRadiusKm: envNumber('UI_DEFAULT_RADIUS_KM', 9999),
      defaultCategory: envText('UI_DEFAULT_CATEGORY', 'all', 24),
      defaultSort: envText('UI_DEFAULT_SORT', 'distance', 24),
      defaultRadarRadiusKm: envNumber('UI_DEFAULT_RADAR_RADIUS_KM', 9999),
      defaultRadarCategory: envText('UI_DEFAULT_RADAR_CATEGORY', 'all', 24)
    }
  });
}

function envText(name, fallback, max) { const value = String(process.env[name] || '').trim(); return (value || fallback).slice(0, max); }
function envNumber(name, fallback) { const value = Number(process.env[name]); return Number.isFinite(value) ? value : fallback; }
