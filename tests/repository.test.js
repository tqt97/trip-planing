import test from 'node:test';
import assert from 'node:assert/strict';
import { CollaborativeRepository } from '../src/data/repository.js';

class FakeClient {
  constructor(){this.user={id:'11111111-1111-1111-1111-111111111111'};this.calls=[]}
  async ensureSession(){return this.user}
  async rpc(name,args){this.calls.push(['rpc',name,args]);return [{trip_id:'22222222-2222-2222-2222-222222222222',role:'editor'}]}
  async rest(table,opts={}){this.calls.push(['rest',table,opts]);if(table==='trips')return [{id:'22222222-2222-2222-2222-222222222222',slug:'dalat-2026',name:'Đà Lạt',home_name:'Home',home_lat:11.9,home_lng:108.4,people_count:4}];if(table==='places')return [];if(table==='expenses')return [];if(table==='place_votes')return [];if(table==='trip_members')return [];if(table==='checklists')return [];return []}
  async uploadPublicFile(bucket,path,file){this.calls.push(['upload',bucket,path,file]);return `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`}
  subscribeTables(){return ()=>{}}
}

test('repository joins shared trip and loads collaboration collections', async()=>{
  const client=new FakeClient();const repo=new CollaborativeRepository(client,'dalat-2026');const connection=await repo.connect();
  assert.equal(connection.role,'editor'); assert.equal(repo.canEdit(),true);
  const data=await repo.loadAll(); assert.equal(data.home.address,'Home'); assert.deepEqual(data.places,[]); assert.deepEqual(data.votes,[]); assert.deepEqual(data.checklists,[]); assert.equal(data.tripSettings.peopleCount,4);
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
  await repo.saveChecklist({id:'44444444-4444-4444-4444-444444444444',title:'Mang áo ấm',category:'prepare',visibility:'public',done:false,note:''});
  const file={type:'image/jpeg',size:1024,name:'dalat.jpg'};const url=await repo.uploadPlaceImage(file,'33333333-3333-3333-3333-333333333333');
  assert.match(url,/place-images/);
  assert.ok(client.calls.some(c=>c[0]==='rest'&&c[1]==='trips'&&c[2].body.people_count===5));
  assert.ok(client.calls.some(c=>c[0]==='rest'&&c[1]==='checklists'));
  assert.ok(client.calls.some(c=>c[0]==='upload'&&c[1]==='place-images'));
});
