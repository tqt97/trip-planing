import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/001_v2_collaboration.sql', 'utf8');
const featuresSql = fs.readFileSync('supabase/migrations/002_trip_features.sql', 'utf8');
const albumSql = fs.readFileSync('supabase/migrations/003_album_checklist_completion.sql', 'utf8');
const resetSql = fs.readFileSync('supabase/RESET_ALL.sql', 'utf8');
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
  assert.match(sql, /user_id\s*=\s*auth\.uid\(\)/);
});

test('vote schema prevents cross-trip votes and one user has one vote per place', () => {
  assert.match(sql, /primary key \(place_id, user_id\)/i);
  assert.match(sql, /foreign key \(place_id, trip_id\)[\s\S]*?references public\.places\(id, trip_id\)/i);
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


test('join RPC fully qualifies trip_id references and reset script is complete', () => {
  const join = sql.match(/create or replace function public\.join_trip_by_slug[\s\S]*?\$\$;/i)?.[0] || '';
  assert.match(join, /existing_member\.trip_id\s*=\s*v_trip\.id/i);
  assert.match(join, /tm\.trip_id\s*=\s*v_trip\.id/i);
  assert.doesNotMatch(join, /from public\.trip_members\s+where\s+trip_id\s*=/i);
  for (const table of ['place_votes','expenses','places','trip_members','trips','profiles']) {
    assert.match(resetSql, new RegExp('drop table if exists public\\.' + table + ' cascade', 'i'));
  }
  assert.match(resetSql, /drop trigger if exists on_auth_user_created on auth\.users/i);
});


test('v2.6 feature migration secures checklist privacy, trip split settings and media bucket', () => {
  assert.match(featuresSql,/add column if not exists people_count/i);
  assert.match(featuresSql,/add column if not exists note_url/i);
  assert.match(featuresSql,/add column if not exists image_url/i);
  assert.match(featuresSql,/create table if not exists public\.checklists/i);
  assert.match(featuresSql,/visibility = 'public' or public\.checklists\.created_by = auth\.uid\(\)/i);
  assert.match(featuresSql,/alter publication supabase_realtime add table public\.checklists/i);
  assert.match(featuresSql,/insert into storage\.buckets[\s\S]*?'place-images'/i);
  assert.match(featuresSql,/place_images_editor_insert/i);
  assert.match(resetSql,/drop table if exists public\.checklists cascade/i);
  assert.match(resetSql,/delete from storage\.objects where bucket_id (?:= 'place-images'|in \('place-images','trip-album'\))/i);
});


test('v2.7 album migration secures shared album and checklist completion actor', () => {
  assert.match(albumSql,/create table if not exists public\.trip_album_items/i);
  assert.match(albumSql,/album_editor_insert/i);
  assert.match(albumSql,/insert into storage\.buckets[\s\S]*?'trip-album'/i);
  assert.match(albumSql,/capture_checklist_completion/i);
  assert.match(albumSql,/completed_by/i);
  assert.match(albumSql,/alter publication supabase_realtime add table public\.trip_album_items/i);
  assert.match(resetSql,/drop table if exists public\.trip_album_items cascade/i);
  assert.match(resetSql,/trip-album/i);
});
