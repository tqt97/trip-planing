const SESSION_KEY = 'dalat-v2:supabase-session';

export class SupabaseHttpClient {
  constructor({ url, key }) {
    this.url = String(url || '').replace(/\/+$/, '');
    this.key = String(key || '');
    this.session = loadSession();
    this.realtime = null;
    this.realtimeRef = 1;
    this.heartbeat = null;
    this.realtimeReconnectTimer = null;
    this.realtimeSubscription = null;
  }

  get configured() { return Boolean(this.url && this.key); }
  get accessToken() { return this.session?.access_token || null; }
  get user() { return this.session?.user || null; }

  consumeOAuthHash() {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    if (!accessToken) return false;
    this.session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Date.now() + Math.max(60, Number(hash.get('expires_in') || 3600)) * 1000,
      user: null
    };
    saveSession(this.session);
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    return true;
  }

  signInWithGoogle(redirectTo = `${location.origin}/`) {
    const url = new URL(`${this.url}/auth/v1/authorize`);
    url.searchParams.set('provider', 'google');
    url.searchParams.set('redirect_to', redirectTo);
    location.assign(url.toString());
  }

  async signOut() {
    if (this.accessToken) {
      await fetch(`${this.url}/auth/v1/logout`, { method: 'POST', headers: this.headers() }).catch(() => {});
    }
    this.disconnectRealtime();
    this.session = null;
    localStorage.removeItem(SESSION_KEY);
  }

  async ensureSession() {
    this.consumeOAuthHash();
    if (!this.session?.access_token) return null;
    if (this.session.expires_at && Date.now() > this.session.expires_at - 60_000) {
      await this.refreshSession();
    }
    try {
      const user = await this.request('/auth/v1/user');
      this.session.user = user;
      saveSession(this.session);
      return user;
    } catch (error) {
      if (this.session?.refresh_token) {
        try {
          await this.refreshSession();
          const user = await this.request('/auth/v1/user');
          this.session.user = user; saveSession(this.session); return user;
        } catch {}
      }
      this.session = null; localStorage.removeItem(SESSION_KEY); return null;
    }
  }

  async refreshSession() {
    if (!this.session?.refresh_token) throw new Error('Không có refresh token.');
    const res = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { apikey: this.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: this.session.refresh_token })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.msg || payload?.message || 'Không thể refresh phiên đăng nhập.');
    this.session = {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token || this.session.refresh_token,
      expires_at: Date.now() + Math.max(60, Number(payload.expires_in || 3600)) * 1000,
      user: payload.user || this.session.user || null
    };
    saveSession(this.session);
    return this.session;
  }

  headers(extra = {}) {
    return {
      apikey: this.key,
      ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      ...extra
    };
  }

  async request(path, options = {}) {
    const headers = this.headers(options.headers || {});
    const res = await fetch(`${this.url}${path}`, { ...options, headers });
    const text = await res.text();
    const payload = text ? safeJson(text) : null;
    if (!res.ok) {
      const error = new Error(payload?.message || payload?.msg || payload?.hint || payload?.error_description || `Supabase HTTP ${res.status}`);
      error.status = res.status; error.code = payload?.code || `HTTP_${res.status}`; error.details = payload;
      throw error;
    }
    return payload;
  }

  rest(table, { method = 'GET', query = '', body, prefer = 'return=representation' } = {}) {
    return this.request(`/rest/v1/${table}${query ? `?${query}` : ''}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(prefer ? { Prefer: prefer } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
  }

  rpc(name, args = {}) {
    return this.request(`/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(args)
    });
  }

  async uploadPublicFile(bucket, path, file) {
    const cleanPath = String(path || '').replace(/^\/+/, '');
    const res = await fetch(`${this.url}/storage/v1/object/${encodeURIComponent(bucket)}/${cleanPath.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }),
      body: file
    });
    const text = await res.text(); const payload = text ? safeJson(text) : null;
    if (!res.ok) throw new Error(payload?.message || payload?.error || `Storage HTTP ${res.status}`);
    return `${this.url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${cleanPath.split('/').map(encodeURIComponent).join('/')}`;
  }

  subscribeTables(tables, onChange) {
    this.disconnectRealtime();
    if (!this.accessToken || !this.configured || typeof WebSocket === 'undefined') return () => {};
    this.realtimeSubscription = { tables: [...tables], onChange, active: true, attempts: 0 };
    this.connectRealtime();
    return () => this.disconnectRealtime();
  }

  connectRealtime() {
    const sub = this.realtimeSubscription;
    if (!sub?.active || !this.accessToken || typeof WebSocket === 'undefined') return;
    if (this.realtimeReconnectTimer) clearTimeout(this.realtimeReconnectTimer);
    const wsUrl = this.url.replace(/^http/, 'ws') + `/realtime/v1/websocket?apikey=${encodeURIComponent(this.key)}&vsn=1.0.0`;
    const socket = new WebSocket(wsUrl);
    this.realtime = socket;
    const topic = `realtime:trip:${Date.now().toString(36)}`;
    socket.addEventListener('open', () => {
      sub.attempts = 0;
      const postgresChanges = sub.tables.map((table) => ({ event: '*', schema: 'public', table }));
      socket.send(JSON.stringify({ topic, event: 'phx_join', payload: { config: { postgres_changes: postgresChanges }, access_token: this.accessToken }, ref: String(this.realtimeRef++) }));
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(this.realtimeRef++) }));
      }, 25_000);
    });
    socket.addEventListener('message', (event) => {
      const message = safeJson(event.data);
      if (message?.event === 'postgres_changes') sub.onChange(message.payload);
    });
    socket.addEventListener('close', () => {
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = null;
      if (!sub.active) return;
      sub.attempts += 1;
      const delay = Math.min(12_000, 1_000 * (2 ** Math.min(3, sub.attempts - 1)));
      this.realtimeReconnectTimer = setTimeout(() => this.connectRealtime(), delay);
    });
  }

  disconnectRealtime() {
    if (this.realtimeSubscription) this.realtimeSubscription.active = false;
    if (this.realtimeReconnectTimer) clearTimeout(this.realtimeReconnectTimer);
    this.realtimeReconnectTimer = null;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    if (this.realtime && this.realtime.readyState < 2) this.realtime.close();
    this.realtime = null;
    this.realtimeSubscription = null;
  }
}

function saveSession(value) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(value)); } catch {} }
function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }
function safeJson(text) { try { return JSON.parse(text); } catch { return null; } }
