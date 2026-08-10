import { sanitizeExpense, sanitizeHome, sanitizePlace } from '../core.js';

export class CollaborativeRepository {
  constructor(client, tripSlug) { this.client = client; this.tripSlug = tripSlug; this.tripId = null; this.role = null; this.user = null; }

  async connect() {
    this.user = await this.client.ensureSession();
    if (!this.user) return null;
    const joined = await this.client.rpc('join_trip_by_slug', { p_slug: this.tripSlug });
    const membership = Array.isArray(joined) ? joined[0] : joined;
    if (!membership?.trip_id) throw new Error('Không thể tham gia Trip mặc định.');
    this.tripId = membership.trip_id; this.role = membership.role;
    return { user: this.user, tripId: this.tripId, role: this.role };
  }

  canEdit() { return this.role === 'owner' || this.role === 'editor'; }

  async loadAll() {
    const tripRows = await this.client.rest('trips', { query: `id=eq.${this.tripId}&select=id,slug,name,home_name,home_lat,home_lng,public_join` });
    const [places, expenses, votes, members] = await Promise.all([
      this.client.rest('places', { query: `trip_id=eq.${this.tripId}&select=*&order=created_at.asc` }),
      this.client.rest('expenses', { query: `trip_id=eq.${this.tripId}&select=*&order=created_at.desc` }),
      this.client.rest('place_votes', { query: `trip_id=eq.${this.tripId}&select=place_id,user_id,created_at` }),
      this.client.rest('trip_members', { query: `trip_id=eq.${this.tripId}&select=trip_id,user_id,role,joined_at,profile:profiles(id,full_name,email,avatar_url)&order=joined_at.asc` })
    ]);
    const trip = tripRows?.[0];
    return {
      trip,
      home: sanitizeHome({ address: trip?.home_name || 'Home', lat: trip?.home_lat, lng: trip?.home_lng }),
      places: (places || []).map(fromPlaceRow),
      expenses: (expenses || []).map(fromExpenseRow),
      votes: votes || [], members: members || []
    };
  }

  async savePlace(place) {
    const row = toPlaceRow(place, this.tripId);
    const result = await this.client.rest('places', { method: 'POST', query: 'on_conflict=id', body: row, prefer: 'resolution=merge-duplicates,return=representation' });
    return fromPlaceRow(result?.[0] || row);
  }
  async deletePlace(id) { await this.client.rest('places', { method: 'DELETE', query: `id=eq.${id}&trip_id=eq.${this.tripId}`, prefer: 'return=minimal' }); }

  async saveExpense(expense) {
    const row = toExpenseRow(expense, this.tripId);
    const result = await this.client.rest('expenses', { method: 'POST', query: 'on_conflict=id', body: row, prefer: 'resolution=merge-duplicates,return=representation' });
    return fromExpenseRow(result?.[0] || row);
  }
  async deleteExpense(id) { await this.client.rest('expenses', { method: 'DELETE', query: `id=eq.${id}&trip_id=eq.${this.tripId}`, prefer: 'return=minimal' }); }

  async setVote(placeId, shouldVote) {
    if (shouldVote) {
      await this.client.rest('place_votes', { method: 'POST', query: 'on_conflict=place_id,user_id', body: { trip_id: this.tripId, place_id: placeId, user_id: this.user.id }, prefer: 'resolution=ignore-duplicates,return=minimal' });
    } else {
      await this.client.rest('place_votes', { method: 'DELETE', query: `place_id=eq.${placeId}&user_id=eq.${this.user.id}`, prefer: 'return=minimal' });
    }
  }

  async updateMemberRole(userId, role) {
    if (this.role !== 'owner') throw new Error('Chỉ owner được đổi quyền thành viên.');
    await this.client.rest('trip_members', { method: 'PATCH', query: `trip_id=eq.${this.tripId}&user_id=eq.${userId}`, body: { role }, prefer: 'return=minimal' });
  }

  subscribe(onChange) { return this.client.subscribeTables(['places','expenses','place_votes','trip_members'], onChange); }
}

function fromPlaceRow(row) { return sanitizePlace({ id:row.id,name:row.name,address:row.address,category:row.category,priority:row.priority,note:row.note,lat:row.lat,lng:row.lng,distanceMeters:row.distance_meters,durationSeconds:row.duration_seconds,routeSource:row.route_source,source:row.source,createdAt:row.created_at,updatedAt:row.updated_at }); }
function toPlaceRow(p, tripId) { return { id:p.id,trip_id:tripId,name:p.name,address:p.address||'',category:p.category,priority:p.priority,note:p.note||'',lat:p.lat,lng:p.lng,distance_meters:p.distanceMeters,duration_seconds:p.durationSeconds,route_source:p.routeSource||'fallback',source:p.source||'manual',created_at:p.createdAt,updated_at:new Date().toISOString() }; }
function fromExpenseRow(row) { return sanitizeExpense({ id:row.id,payer:row.payer,category:row.category,amountVnd:Number(row.amount_vnd),note:row.note,createdAt:row.created_at,updatedAt:row.updated_at }); }
function toExpenseRow(e, tripId) { return { id:e.id,trip_id:tripId,payer:e.payer,category:e.category,amount_vnd:e.amountVnd,note:e.note||'',created_at:e.createdAt,updated_at:new Date().toISOString() }; }
