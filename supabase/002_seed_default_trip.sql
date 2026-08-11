-- Default shared Trip. Edit these values if your Vercel DEFAULT_TRIP_SLUG/Home differs.
insert into public.trips (
  slug,
  name,
  home_name,
  home_lat,
  home_lng,
  public_join,
  people_count
)
values (
  'dalat-2026',
  'Đà Lạt 2026',
  'Hotel Trường An Hotel',
  11.9370985,
  108.4220004,
  true,
  4
)
on conflict (slug) do update
set name = excluded.name,
    home_name = excluded.home_name,
    home_lat = excluded.home_lat,
    home_lng = excluded.home_lng,
    public_join = excluded.public_join,
    people_count = excluded.people_count,
    updated_at = now();
