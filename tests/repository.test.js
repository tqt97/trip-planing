import test from 'node:test';
import assert from 'node:assert/strict';
import { CollaborativeRepository } from '../src/data/repository.js';

class FakeClient {
  constructor(){this.user={id:'11111111-1111-1111-1111-111111111111'};this.calls=[]}
  async ensureSession(){return this.user}
  async rpc(name,args){this.calls.push(['rpc',name,args]);return [{trip_id:'22222222-2222-2222-2222-222222222222',role:'editor'}]}
  async rest(table,opts={}){this.calls.push(['rest',table,opts]);if(table==='trips')return [{id:'22222222-2222-2222-2222-222222222222',slug:'dalat-2026',name:'Đà Lạt',home_name:'Home',home_lat:11.9,home_lng:108.4,people_count:4}];if(table==='places')return [];if(table==='expenses')return [];if(table==='place_votes')return [];if(table==='trip_members')return [];if(table==='checklists')return [];if(table==='checklist_completions')return [];if(table==='trip_timeline_items')return [];return []}
  async uploadPublicFile(bucket,path,file){this.calls.push(['upload',bucket,path,file]);return `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`}
  async deletePublicFile(bucket,url){this.calls.push(['delete-file',bucket,url]);return true}
  subscribeTables(){return ()=>{}}
}

test('repository joins shared trip and loads collaboration collections', async()=>{
  const client=new FakeClient();const repo=new CollaborativeRepository(client,'dalat-2026');const connection=await repo.connect();
  assert.equal(connection.role,'editor'); assert.equal(repo.canEdit(),true);
  const data=await repo.loadAll(); assert.equal(data.home.address,'Home'); assert.deepEqual(data.places,[]); assert.deepEqual(data.votes,[]); assert.deepEqual(data.checklists,[]); assert.deepEqual(data.checklistCompletions,[]); assert.deepEqual(data.timeline,[]); assert.equal(data.tripSettings.peopleCount,4);
  assert.ok(client.calls.some(c=>c[0]==='rpc'&&c[1]==='join_trip_by_slug'));
});

test('repository vote writes are scoped to current user and trip', async()=>{
  const client=new FakeClient();const repo=new CollaborativeRepository(client,'dalat-2026');await repo.connect();
  await repo.setVote('33333333-3333-3333-3333-333333333333',true);
  const call=client.calls.find(c=>c[0]==='rest'&&c[1]==='place_votes'&&c[2].method==='POST');
  assert.equal(call[2].body.user_id,client.user.id); assert.equal(call[2].body.trip_id,repo.tripId);
});


test('repository persists people count, checklist and place image through scoped APIs', async()=>{
  const client=new FakeClient();const repo=new CollaborativeRepository(client,'dalat-2026');await repo.connect();
  await repo.updatePeopleCount(5);
  await repo.saveChecklist({id:'44444444-4444-4444-4444-444444444444',title:'Mang áo ấm',category:'prepare',visibility:'public',note:''});
  await repo.setChecklistCompletion('44444444-4444-4444-4444-444444444444',true);
  const file={type:'image/jpeg',size:1024,name:'dalat.jpg'};const url=await repo.uploadPlaceImage(file,'33333333-3333-3333-3333-333333333333');
  assert.match(url,/place-images/);
  assert.ok(client.calls.some(c=>c[0]==='rest'&&c[1]==='trips'&&c[2].body.people_count===5));
  assert.ok(client.calls.some(c=>c[0]==='rest'&&c[1]==='checklists'));
  const completion=client.calls.find(c=>c[0]==='rest'&&c[1]==='checklist_completions'&&c[2].method==='POST');
  assert.equal(completion[2].body.user_id,client.user.id);
  assert.ok(client.calls.some(c=>c[0]==='upload'&&c[1]==='place-images'));
  await repo.deletePlaceImage(url);
  assert.ok(client.calls.some(c=>c[0]==='delete-file'&&c[1]==='place-images'&&c[2]===url));
});

test('repository cleans Supabase album media through the scoped storage client', async()=>{
  const client=new FakeClient();const repo=new CollaborativeRepository(client,'dalat-2026');await repo.connect();
  const file={type:'image/jpeg',size:1024,name:'album.jpg'};const url=await repo.uploadAlbumImage(file,'55555555-5555-5555-5555-555555555555');
  await repo.deleteAlbumImage(url);
  assert.ok(client.calls.some(c=>c[0]==='delete-file'&&c[1]==='trip-album'&&c[2]===url));
});


test('repository persists timeline items and expense participants', async()=>{
  const client=new FakeClient();const repo=new CollaborativeRepository(client,'dalat-2026');await repo.connect();
  await repo.saveTimelineItem({id:'66666666-6666-6666-6666-666666666666',date:'2026-08-15',time:'07:30',title:'Ăn sáng',placeId:'',placeName:'',note:''});
  await repo.saveExpense({id:'77777777-7777-7777-7777-777777777777',payer:'An',category:'food',amountVnd:120000,participants:['An','Bình'],note:'',createdAt:new Date().toISOString()});
  const timeline=client.calls.find(c=>c[0]==='rest'&&c[1]==='trip_timeline_items'&&c[2].method==='POST');
  const expense=client.calls.find(c=>c[0]==='rest'&&c[1]==='expenses'&&c[2].method==='POST');
  assert.equal(timeline[2].body.start_time,'07:30');
  assert.deepEqual(expense[2].body.participants,['An','Bình']);
});
