import { sanitizeAlbumItem, sanitizeChecklist, sanitizeChecklistCompletion, sanitizeExpense, sanitizeHome, sanitizePlace, sanitizeTimelineItem, sanitizeTripSettings } from '../core.js';

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
    const [places, expenses, votes, members, checklists, checklistCompletions, album, timeline] = await Promise.all([
      this.client.rest('places', { query: `trip_id=eq.${this.tripId}&select=*&order=created_at.asc` }),
      this.client.rest('expenses', { query: `trip_id=eq.${this.tripId}&select=*&order=created_at.desc` }),
      this.client.rest('place_votes', { query: `trip_id=eq.${this.tripId}&select=place_id,user_id,created_at` }),
      this.client.rest('trip_members', { query: `trip_id=eq.${this.tripId}&select=trip_id,user_id,role,joined_at,profile:profiles(id,full_name,email,avatar_url)&order=joined_at.asc` }),
      this.client.rest('checklists', { query: `trip_id=eq.${this.tripId}&select=*&order=updated_at.desc` }),
      this.client.rest('checklist_completions', { query: `trip_id=eq.${this.tripId}&select=checklist_id,user_id,completed_at&order=completed_at.asc` }),
      this.client.rest('trip_album_items', { query: `trip_id=eq.${this.tripId}&select=*&order=updated_at.desc` }),
      this.client.rest('trip_timeline_items', { query: `trip_id=eq.${this.tripId}&select=*&order=day_date.asc,start_time.asc` })
    ]);
    const trip = tripRows?.[0];
    return {
      trip,
      home: sanitizeHome({ address: trip?.home_name || 'Home', lat: trip?.home_lat, lng: trip?.home_lng }),
      tripSettings: sanitizeTripSettings({ peopleCount: trip?.people_count }),
      places: (places || []).map(fromPlaceRow),
      expenses: (expenses || []).map(fromExpenseRow),
      votes: votes || [], members: members || [], checklists: (checklists || []).map(fromChecklistRow), checklistCompletions: (checklistCompletions || []).map(fromChecklistCompletionRow), album: (album || []).map(fromAlbumRow), timeline: (timeline || []).map(fromTimelineRow)
    };
  }

  async savePlace(place) {
    const row = toPlaceRow(place, this.tripId);
    const result = await this.client.rest('places', { method: 'POST', query: 'on_conflict=id', body: row, prefer: 'resolution=merge-duplicates,return=representation' });
    return fromPlaceRow(result?.[0] || row);
  }
  async deletePlace(id) { await this.client.rest('places', { method: 'DELETE', query: `id=eq.${id}&trip_id=eq.${this.tripId}`, prefer: 'return=minimal' }); }
  async deletePlaceImage(imageUrl) { return this.client.deletePublicFile('place-images', imageUrl); }

  async saveExpense(expense) {
    const row = toExpenseRow(expense, this.tripId);
    const result = await this.client.rest('expenses', { method: 'POST', query: 'on_conflict=id', body: row, prefer: 'resolution=merge-duplicates,return=representation' });
    return fromExpenseRow(result?.[0] || row);
  }
  async deleteExpense(id) { await this.client.rest('expenses', { method: 'DELETE', query: `id=eq.${id}&trip_id=eq.${this.tripId}`, prefer: 'return=minimal' }); }

  async saveTimelineItem(item) { const row=toTimelineRow(item,this.tripId); const result=await this.client.rest('trip_timeline_items',{method:'POST',query:'on_conflict=id',body:row,prefer:'resolution=merge-duplicates,return=representation'}); return fromTimelineRow(result?.[0]||row); }
  async deleteTimelineItem(id) { await this.client.rest('trip_timeline_items',{method:'DELETE',query:`id=eq.${id}&trip_id=eq.${this.tripId}`,prefer:'return=minimal'}); }

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

  async setChecklistCompletion(checklistId, shouldComplete) {
    if (shouldComplete) {
      await this.client.rest('checklist_completions', { method: 'POST', query: 'on_conflict=checklist_id,user_id', body: { trip_id: this.tripId, checklist_id: checklistId, user_id: this.user.id }, prefer: 'resolution=ignore-duplicates,return=minimal' });
    } else {
      await this.client.rest('checklist_completions', { method: 'DELETE', query: `checklist_id=eq.${checklistId}&user_id=eq.${this.user.id}&trip_id=eq.${this.tripId}`, prefer: 'return=minimal' });
    }
  }

  async saveAlbumItem(item) { const row=toAlbumRow(item,this.tripId); const result=await this.client.rest('trip_album_items',{method:'POST',query:'on_conflict=id',body:row,prefer:'resolution=merge-duplicates,return=representation'}); return fromAlbumRow(result?.[0]||row); }
  async deleteAlbumItem(id) { await this.client.rest('trip_album_items',{method:'DELETE',query:`id=eq.${id}&trip_id=eq.${this.tripId}`,prefer:'return=minimal'}); }
  async deleteAlbumImage(imageUrl) { return this.client.deletePublicFile('trip-album', imageUrl); }
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

  subscribe(onChange) { return this.client.subscribeTables(['places','expenses','place_votes','trip_members','checklists','checklist_completions','trip_album_items','trip_timeline_items','trips'], onChange); }
}

function fromPlaceRow(row) { return sanitizePlace({ id:row.id,name:row.name,address:row.address,category:row.category,priority:row.priority,note:row.note,noteUrl:row.note_url,imageUrl:row.image_url,lat:row.lat,lng:row.lng,distanceMeters:row.distance_meters,durationSeconds:row.duration_seconds,routeSource:row.route_source,source:row.source,createdAt:row.created_at,updatedAt:row.updated_at }); }
function toPlaceRow(p, tripId) { return { id:p.id,trip_id:tripId,name:p.name,address:p.address||'',category:p.category,priority:p.priority,note:p.note||'',note_url:p.noteUrl||'',image_url:String(p.imageUrl||'').startsWith('http')?p.imageUrl:'',lat:p.lat,lng:p.lng,distance_meters:p.distanceMeters,duration_seconds:p.durationSeconds,route_source:p.routeSource||'fallback',source:p.source||'manual',created_at:p.createdAt,updated_at:new Date().toISOString() }; }
function fromExpenseRow(row) { return sanitizeExpense({ id:row.id,payer:row.payer,category:row.category,amountVnd:Number(row.amount_vnd),note:row.note,participants:row.participants||[],createdAt:row.created_at,updatedAt:row.updated_at }); }
function toExpenseRow(e, tripId) { return { id:e.id,trip_id:tripId,payer:e.payer,category:e.category,amount_vnd:e.amountVnd,note:e.note||'',participants:e.participants||[],created_at:e.createdAt,updated_at:new Date().toISOString() }; }
function fromTimelineRow(row){return sanitizeTimelineItem({id:row.id,date:row.day_date,time:String(row.start_time||'08:00').slice(0,5),title:row.title,placeId:row.place_id,placeName:row.place_name,note:row.note,createdAt:row.created_at,updatedAt:row.updated_at})}
function toTimelineRow(item,tripId){return{id:item.id,trip_id:tripId,day_date:item.date,start_time:item.time,title:item.title,place_id:item.placeId||null,place_name:item.placeName||'',note:item.note||'',created_at:item.createdAt,updated_at:new Date().toISOString()}}

function fromChecklistRow(row) { return sanitizeChecklist({ id:row.id,title:row.title,category:row.category,visibility:row.visibility,note:row.note,createdBy:row.created_by,createdAt:row.created_at,updatedAt:row.updated_at }); }
function toChecklistRow(item, tripId) { return { id:item.id,trip_id:tripId,title:item.title,category:item.category,visibility:item.visibility,note:item.note||'',updated_at:new Date().toISOString() }; }
function fromChecklistCompletionRow(row) { return sanitizeChecklistCompletion({ checklistId:row.checklist_id,userId:row.user_id,completedAt:row.completed_at }); }
function fromAlbumRow(row){return sanitizeAlbumItem({id:row.id,title:row.title,status:row.status,note:row.note,noteUrl:row.note_url,imageUrl:row.image_url,createdBy:row.created_by,createdAt:row.created_at,updatedAt:row.updated_at})}
function toAlbumRow(item,tripId){return{id:item.id,trip_id:tripId,title:item.title,status:item.status,note:item.note||'',note_url:item.noteUrl||'',image_url:String(item.imageUrl||'').startsWith('http')?item.imageUrl:'',updated_at:new Date().toISOString()}}
