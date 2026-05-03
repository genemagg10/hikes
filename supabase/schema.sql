-- ============================================================
-- HikeTrack — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Enable PostGIS (geospatial extension)
create extension if not exists postgis;

-- ============================================================
-- 2. Trails table — seeded from OpenStreetMap via Overpass API
-- ============================================================
create table if not exists trails (
  id           text primary key,          -- osm:way:12345 or osm:rel:12345
  name         text not null,
  area         text,                       -- e.g. "Briones Regional Park"
  difficulty   text,                       -- easy | moderate | hard
  shape        text,                       -- loop | out-and-back | point-to-point
  distance_m   float,                      -- meters (computed from geometry)
  elevation_gain_m float,
  description  text,
  tags         jsonb default '{}',         -- raw OSM tags
  geometry     geometry(MultiLineString, 4326) not null,
  bbox         box2d generated always as (box2d(geometry)) stored,
  osm_id       bigint,
  osm_type     text,                       -- way | relation
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists trails_geometry_idx on trails using gist(geometry);
create index if not exists trails_name_idx     on trails (name);
create index if not exists trails_area_idx     on trails (area);

-- ============================================================
-- 3. Workouts table — imported from Apple Health
-- ============================================================
create table if not exists workouts (
  id                      text primary key,
  type                    text not null,   -- hiking | walking | running | cycling
  start_date              timestamptz not null,
  end_date                timestamptz not null,
  duration_seconds        integer not null,
  distance_m              float not null,
  calories                integer,
  elevation_ascended_m    float,
  elevation_descended_m   float,
  trail_name              text,
  notes                   text,
  route                   geometry(LineString, 4326),  -- GPS track from GPX
  matched_trail_ids       text[],                      -- auto-matched trail IDs
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create index if not exists workouts_start_date_idx on workouts (start_date desc);
create index if not exists workouts_type_idx       on workouts (type);
create index if not exists workouts_route_idx      on workouts using gist(route)
  where route is not null;

-- ============================================================
-- 4. Helper: auto-match workout to nearby trails
--    Finds trails whose geometry is within `thresh` meters
--    of the workout route, ordered by overlap score.
-- ============================================================
create or replace function match_workout_to_trails(
  p_workout_id text,
  p_threshold  float default 80  -- meters
)
returns table(trail_id text, score float)
language sql
stable
as $$
  select
    t.id                                          as trail_id,
    st_length(
      st_intersection(
        st_buffer(w.route::geography, p_threshold)::geometry,
        t.geometry
      )::geography
    ) / nullif(st_length(t.geometry::geography), 0) as score
  from workouts w
  join trails   t
    on st_dwithin(w.route::geography, t.geometry::geography, p_threshold * 3)
  where w.id = p_workout_id
  order by score desc
  limit 5;
$$;

-- ============================================================
-- 5. View: workout summary with matched trail names
-- ============================================================
create or replace view workout_summary as
select
  w.id,
  w.type,
  w.start_date,
  w.duration_seconds,
  w.distance_m,
  w.calories,
  w.elevation_ascended_m,
  w.trail_name,
  w.notes,
  w.matched_trail_ids,
  w.route is not null as has_gps,
  st_asgeojson(w.route)::jsonb as route_geojson
from workouts w;

-- ============================================================
-- 6. RLS — enable Row Level Security
--    For a personal app you can disable RLS and rely on the
--    service role key for writes. Enable it here for safety.
-- ============================================================
alter table trails  enable row level security;
alter table workouts enable row level security;

-- Allow public read of trails (trail map is public)
create policy "trails_public_read"
  on trails for select using (true);

-- Authenticated users can manage their own workouts
-- (adjust this if you add auth later)
create policy "workouts_anon_all"
  on workouts for all using (true);
