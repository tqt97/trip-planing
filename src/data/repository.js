import { sanitizeAlbumItem, sanitizeChecklist, sanitizeExpense, sanitizeHome, sanitizePlace, sanitizeTripSettings } from '../core.js';

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
    const tripRows = await this.client.rest('trips', { query: `id=eq.${this.tripId}&select=id,slug,name,home_name,home_lat,home_lng,public_join,people_count` });
    const [places, expenses, votes, members, checklists, album] = await Promise.all([
      this.client.rest('places', { query: `trip_id=eq.${this.tripId}&select=*&order=created_at.asc` }),
      this.client.rest('expenses', { query: `trip_id=eq.${this.tripId}&select=*&order=created_at.desc` }),
      this.client.rest('place_votes', { query: `trip_id=eq.${this.tripId}&select=place_id,user_id,created_at` }),
      this.client.rest('trip_members', { query: `trip_id=eq.${this.tripId}&select=trip_id,user_id,role,joined_at,profile:profiles(id,full_name,email,avatar_url)&order=joined_at.asc` }),
      this.client.rest('checklists', { query: `trip_id=eq.${this.tripId}&select=*&order=updated_at.desc` }),
      this.client.rest('trip_album_items', { query: `trip_id=eq.${this.tripId}&select=*&order=updated_at.desc` })
    ]);
    const trip = tripRows?.[0];
    return {
      trip,
      home: sanitizeHome({ address: trip?.home_name || 'Home', lat: trip?.home_lat, lng: trip?.home_lng }),
      tripSettings: sanitizeTripSettings({ peopleCount: trip?.people_count }),
      places: (places || []).map(fromPlaceRow),
      expenses: (expenses || []).map(fromExpenseRow),
      votes: votes || [], members: members || [], checklists: (checklists || []).map(fromChecklistRow), album: (album || []).map(fromAlbumRow)
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

  async updatePeopleCount(peopleCount) {
    const count = Math.max(1, Math.min(50, Number.parseInt(peopleCount, 10) || 1));
    await this.client.rest('trips', { method: 'PATCH', query: `id=eq.${this.tripId}`, body: { people_count: count }, prefer: 'return=minimal' });
    return count;
  }

  async saveChecklist(item) {
    const row = toChecklistRow(item, this.tripId);
    const result = await this.client.rest('checklists', { method: 'POST', query: 'on_conflict=id', body: row, prefer: 'resolution=merge-duplicates,return=representation' });
    return fromChecklistRow(result?.[0] || row);
  }
  async deleteChecklist(id) { await this.client.rest('checklists', { method: 'DELETE', query: `id=eq.${id}&trip_id=eq.${this.tripId}`, prefer: 'return=minimal' }); }

  async saveAlbumItem(item) { const row=toAlbumRow(item,this.tripId); const result=await this.client.rest('trip_album_items',{method:'POST',query:'on_conflict=id',body:row,prefer:'resolution=merge-duplicates,return=representation'}); return fromAlbumRow(result?.[0]||row); }
  async deleteAlbumItem(id) { await this.client.rest('trip_album_items',{method:'DELETE',query:`id=eq.${id}&trip_id=eq.${this.tripId}`,prefer:'return=minimal'}); }
  async uploadAlbumImage(file, itemId) { if (!file || !String(file.type||'').startsWith('image/')) throw new Error('File phải là hình ảnh.'); if(file.size>5*1024*1024) throw new Error('Hình tối đa 5 MB.'); const ext=String(file.name||'image').split('.').pop().replace(/[^a-zA-Z0-9]/g,'').slice(0,8)||'jpg'; const path=`${this.tripId}/${itemId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`; return this.client.uploadPublicFile('trip-album',path,file); }

  async uploadPlaceImage(file, placeId) {
    if (!file || !String(file.type || '').startsWith('image/')) throw new Error('File phải là hình ảnh.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Hình tối đa 5 MB.');
    const ext = String(file.name || 'image').split('.').pop().replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'jpg';
    const path = `${this.tripId}/${placeId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    return this.client.uploadPublicFile('place-images', path, file);
  }

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

  subscribe(onChange) { return this.client.subscribeTables(['places','expenses','place_votes','trip_members','checklists','trip_album_items','trips'], onChange); }
}

function fromPlaceRow(row) { return sanitizePlace({ id:row.id,name:row.name,address:row.address,category:row.category,priority:row.priority,note:row.note,noteUrl:row.note_url,imageUrl:row.image_url,lat:row.lat,lng:row.lng,distanceMeters:row.distance_meters,durationSeconds:row.duration_seconds,routeSource:row.route_source,source:row.source,createdAt:row.created_at,updatedAt:row.updated_at }); }
function toPlaceRow(p, tripId) { return { id:p.id,trip_id:tripId,name:p.name,address:p.address||'',category:p.category,priority:p.priority,note:p.note||'',note_url:p.noteUrl||'',image_url:String(p.imageUrl||'').startsWith('http')?p.imageUrl:'',lat:p.lat,lng:p.lng,distance_meters:p.distanceMeters,duration_seconds:p.durationSeconds,route_source:p.routeSource||'fallback',source:p.source||'manual',created_at:p.createdAt,updated_at:new Date().toISOString() }; }
function fromExpenseRow(row) { return sanitizeExpense({ id:row.id,payer:row.payer,category:row.category,amountVnd:Number(row.amount_vnd),note:row.note,createdAt:row.created_at,updatedAt:row.updated_at }); }
function toExpenseRow(e, tripId) { return { id:e.id,trip_id:tripId,payer:e.payer,category:e.category,amount_vnd:e.amountVnd,note:e.note||'',created_at:e.createdAt,updated_at:new Date().toISOString() }; }

function fromChecklistRow(row) { return sanitizeChecklist({ id:row.id,title:row.title,category:row.category,visibility:row.visibility,done:row.done,note:row.note,createdBy:row.created_by,completedBy:row.completed_by,completedAt:row.completed_at,createdAt:row.created_at,updatedAt:row.updated_at }); }
function toChecklistRow(item, tripId) { return { id:item.id,trip_id:tripId,title:item.title,category:item.category,visibility:item.visibility,done:Boolean(item.done),note:item.note||'',completed_by:item.completedBy||null,completed_at:item.completedAt||null,updated_at:new Date().toISOString() }; }
function fromAlbumRow(row){return sanitizeAlbumItem({id:row.id,title:row.title,status:row.status,note:row.note,noteUrl:row.note_url,imageUrl:row.image_url,createdBy:row.created_by,createdAt:row.created_at,updatedAt:row.updated_at})}
function toAlbumRow(item,tripId){return{id:item.id,trip_id:tripId,title:item.title,status:item.status,note:item.note||'',note_url:item.noteUrl||'',image_url:String(item.imageUrl||'').startsWith('http')?item.imageUrl:'',updated_at:new Date().toISOString()}}
