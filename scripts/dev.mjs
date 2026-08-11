import { buildStyles } from './styles.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routeHandler from '../api/route.js';
import matrixHandler from '../api/matrix.js';
import configHandler from '../api/config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
buildStyles(root);
loadEnv(path.join(root, '.env.local'));
loadEnv(path.join(root, '.env'));

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const apiHandlers = new Map([
  ['/api/route', routeHandler],
  ['/api/matrix', matrixHandler],
  ['/api/config', configHandler],
]);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
    const handler = apiHandlers.get(url.pathname);
    if (handler) {
      await handler(req, res);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end('Method Not Allowed');
      return;
    }

    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const filePath = path.resolve(root, `.${rel}`);
    if (!filePath.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    let target = filePath;
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      target = path.join(root, 'index.html');
    }
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data: https://*.googleusercontent.com https://lh3.googleusercontent.com; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(target).pipe(res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Local dev server error' }));
  }
});

server.listen(port, host, () => {
  const hasKey = Boolean(process.env.OPENROUTESERVICE_API_KEY);
  console.log(`Dalat Nearby Planner: http://${host}:${port}`);
  console.log(`openrouteservice API key: ${hasKey ? 'loaded' : 'not configured (fallback distance still works)'}`);
  console.log(`fixed Home: ${process.env.HOME_LAT && process.env.HOME_LNG ? 'loaded from environment' : 'not configured'}`);
});

function loadEnv(filename) {
  if (!fs.existsSync(filename)) return;
  const content = fs.readFileSync(filename, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
