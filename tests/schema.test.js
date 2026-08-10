import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/001_v2_collaboration.sql', 'utf8');
const seed = fs.readFileSync('scripts/db-seed.mjs', 'utf8');

test('v2 schema enables RLS on every collaborative table and scopes writes', () => {
  for (const table of ['profiles','trips','trip_members','places','expenses','place_votes']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.match(sql, /places_editor_(insert|update|delete)/);
  assert.match(sql, /expenses_editor_(insert|update|delete)/);
  assert.match(sql, /votes_self_insert/);
  assert.match(sql, /votes_self_delete/);
  assert.match(sql, /members_owner_update[\s\S]*user_id <> auth\.uid\(\)/);
  assert.match(sql, /grant update\(role\) on public\.trip_members to authenticated/i);
  assert.match(sql, /user_id=auth\.uid\(\)/);
});

test('vote schema prevents cross-trip votes and one user has one vote per place', () => {
  assert.match(sql, /primary key \(place_id, user_id\)/i);
  assert.match(sql, /foreign key \(place_id, trip_id\) references public\.places\(id, trip_id\)/i);
});

test('RLS helper functions cannot inspect arbitrary user ids', () => {
  assert.match(sql, /function public\.is_trip_member\(p_trip uuid\)/i);
  assert.match(sql, /function public\.trip_role\(p_trip uuid\)/i);
  assert.doesNotMatch(sql, /p_user uuid default auth\.uid\(\)/i);
  assert.match(sql, /revoke execute on function public\.trip_role\(uuid\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.trip_role\(uuid\) to authenticated/i);
});

test('realtime publication includes all mutable shared collections', () => {
  for (const table of ['places','expenses','place_votes','trip_members']) {
    assert.match(sql, new RegExp(`alter publication supabase_realtime add table public\\.${table}`, 'i'));
  }
});

test('seed script accepts new Supabase secret key without exposing it as bearer JWT', () => {
  assert.match(seed, /SUPABASE_SECRET_KEY/);
  assert.match(seed, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(seed, /startsWith\('sb_secret_'\)/);
  assert.match(seed, /apikey:key/);
  assert.match(seed, /!key\.startsWith\('sb_secret_'\)/);
});
