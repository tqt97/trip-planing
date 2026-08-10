import { json } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(res, 405, { error: 'Method not allowed' }); }

  const lat = Number(process.env.HOME_LAT);
  const lng = Number(process.env.HOME_LNG);
  const configuredHome = Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180;
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

  return json(res, 200, {
    home: configuredHome ? {
      address: String(process.env.HOME_NAME || 'Home').trim().slice(0, 300), lat, lng, source: 'environment'
    } : null,
    routingConfigured: Boolean(process.env.OPENROUTESERVICE_API_KEY),
    collaboration: {
      configured: Boolean(supabaseUrl && publishableKey),
      supabaseUrl,
      publishableKey,
      defaultTripSlug: String(process.env.DEFAULT_TRIP_SLUG || 'dalat-2026').trim().slice(0, 80)
    }
  });
}
