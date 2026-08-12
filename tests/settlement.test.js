import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSettlement, parseParticipants } from '../src/features/expenses/settlement.js';

test('settlement minimizes transfers for shared expenses',()=>{
  const expenses=[
    {payer:'An',amountVnd:400000,participants:['An','Bình','Chi','Dũng']},
    {payer:'Bình',amountVnd:200000,participants:['An','Bình','Chi','Dũng']}
  ];
  const transfers=calculateSettlement(expenses);
  assert.equal(transfers.reduce((s,x)=>s+x.amount,0),300000);
  assert.ok(transfers.every(x=>x.from&&x.to&&x.amount>0));
});

test('participants parser deduplicates names',()=>assert.deepEqual(parseParticipants('An, Bình, An, Chi'),['An','Bình','Chi']));
