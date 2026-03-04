-- ============================================================
-- Run this AFTER schema.sql in the Supabase SQL Editor
-- ============================================================

-- upsert_trail_wkt: inserts or updates a trail using WKT geometry
-- (needed because Supabase JS client can't send raw WKT for geometry columns)
create or replace function upsert_trail_wkt(
  p_id         text,
  p_name       text,
  p_area       text,
  p_difficulty text,
  p_shape      text,
  p_distance_m float,
  p_tags       jsonb,
  p_osm_id     bigint,
  p_osm_type   text,
  p_wkt        text          -- WKT MultiLineString
)
returns void
language plpgsql
as $$
begin
  insert into trails (id, name, area, difficulty, shape, distance_m, tags, osm_id, osm_type, geometry)
  values (
    p_id, p_name, p_area, p_difficulty, p_shape, p_distance_m,
    p_tags, p_osm_id, p_osm_type,
    st_geomfromtext(p_wkt, 4326)
  )
  on conflict (id) do update set
    name        = excluded.name,
    area        = excluded.area,
    difficulty  = excluded.difficulty,
    shape       = excluded.shape,
    distance_m  = excluded.distance_m,
    tags        = excluded.tags,
    geometry    = excluded.geometry,
    updated_at  = now();
end;
$$;


-- get_trails_geojson: returns all trails as a GeoJSON FeatureCollection
-- Used by the map's initial load to fetch all trail geometries at once
create or replace function get_trails_geojson(
  p_bbox geometry default null   -- optional bounding box filter
)
returns json
language sql
stable
as $$
  select json_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(json_agg(f), '[]'::json)
  )
  from (
    select json_build_object(
      'type', 'Feature',
      'id',   t.id,
      'geometry', st_asgeojson(t.geometry)::json,
      'properties', json_build_object(
        'id',         t.id,
        'name',       t.name,
        'area',       t.area,
        'difficulty', t.difficulty,
        'shape',      t.shape,
        'distance_m', t.distance_m,
        'elevation_gain_m', t.elevation_gain_m,
        'description', t.description
      )
    ) as f
    from trails t
    where (p_bbox is null or st_intersects(t.geometry, p_bbox))
    order by t.name
  ) sub;
$$;


-- get_workouts_geojson: returns workout routes as a GeoJSON FeatureCollection
create or replace function get_workouts_geojson()
returns json
language sql
stable
as $$
  select json_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(json_agg(f), '[]'::json)
  )
  from (
    select json_build_object(
      'type', 'Feature',
      'id',   w.id,
      'geometry', st_asgeojson(w.route)::json,
      'properties', json_build_object(
        'id',           w.id,
        'type',         w.type,
        'start_date',   w.start_date,
        'distance_m',   w.distance_m,
        'duration_s',   w.duration_seconds,
        'trail_name',   w.trail_name,
        'elevation_m',  w.elevation_ascended_m
      )
    ) as f
    from workouts w
    where w.route is not null
    order by w.start_date desc
  ) sub;
$$;
