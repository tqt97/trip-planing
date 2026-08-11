import test from 'node:test';
import assert from 'node:assert/strict';
import { FirebaseTripRepository } from '../src/data/firebase-repository.js';

class Snap { constructor(id,value){this.id=id;this.value=value} exists(){return this.value!=null} data(){return this.value} }
class FakeClient {
  constructor({trip=null,member=null}={}){this.user={id:'user-1',email:'ni@example.com',displayName:'Ní'};this.trip=trip;this.member=member;this.writes=[]}
  async init(){return this} async ensureSession(){return this.user} doc(...s){return s.join('/')} collection(...s){return s.join('/')} serverTimestamp(){return 'SERVER_TIME'}
  async runTransaction(fn){const tx={get:async(ref)=>ref==='trips/dalat-2026'?new Snap('dalat-2026',this.trip):new Snap('user-1',this.member),set:(ref,data)=>{this.writes.push(['set',ref,data]);if(ref==='trips/dalat-2026')this.trip=data;if(ref.endsWith('/members/user-1'))this.member=data},update:(ref,data)=>{this.writes.push(['update',ref,data]);if(ref==='trips/dalat-2026')this.trip={...this.trip,...data}}};return fn(tx)}
  async getDoc(){return new Snap('dalat-2026',this.trip)} async getDocs(){return {docs:[]}} async setDoc(ref,data,opts){this.writes.push(['setDoc',ref,data,opts])} async updateDoc(ref,data){this.writes.push(['updateDoc',ref,data])} async deleteDoc(ref){this.writes.push(['deleteDoc',ref])} onSnapshot(){return()=>{}}
}

test('first Firebase user bootstraps trip and becomes owner',async()=>{const c=new FakeClient(),r=new FirebaseTripRepository(c,{tripSlug:'dalat-2026',tripName:'Đà Lạt',home:{address:'Home',lat:11.9,lng:108.4}});const x=await r.connect();assert.equal(x.role,'owner');assert.equal(c.trip.ownerUid,'user-1');assert.equal(c.member.role,'owner')});
test('subsequent user joins public Firebase trip as editor',async()=>{const c=new FakeClient({trip:{slug:'dalat-2026',publicJoin:true,ownerUid:'owner-1'}}),r=new FirebaseTripRepository(c,{tripSlug:'dalat-2026'});const x=await r.connect();assert.equal(x.role,'editor');assert.equal(c.member.role,'editor')});
test('closed Firebase trip rejects new member',async()=>{const c=new FakeClient({trip:{slug:'dalat-2026',publicJoin:false,ownerUid:'owner-1'}}),r=new FirebaseTripRepository(c,{tripSlug:'dalat-2026'});await assert.rejects(()=>r.connect(),/không cho phép/)});
