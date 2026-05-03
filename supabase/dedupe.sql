-- ============================================================
-- TrailTracker — Merge duplicate trail segments
-- Run AFTER schema.sql + functions.sql + trail-progress.sql
--
-- OpenStreetMap commonly splits popular trails into multiple
-- "way" entries at intersections, road crossings, gates, etc.
-- This script merges segments that share a (name, area) into
-- a single trail with a combined MultiLineString geometry, so
-- "Lafayette-Moraga Regional Trail" appears once instead of
-- eight times.
--
-- Usage:
--   1. Preview what would change:
--        select * from preview_duplicate_trails();
--   2. Apply the merge:
--        select * from merge_duplicate_trails();
--
-- Both functions are safe to re-run. The merge picks a stable,
-- content-derived id (`merged:<md5(name+area)>`) so future seed
-- runs that re-introduce duplicates will collapse the same way.
-- ============================================================

-- ── Preview: shows groups of trails that would be merged ──────
create or replace function preview_duplicate_trails()
returns table(
  name           text,
  area           text,
  segment_count  integer,
  total_miles    numeric
)
language sql
stable
as $$
  select
    t.name,
    t.area,
    count(*)::integer                           as segment_count,
    round((sum(t.distance_m) / 1609.34)::numeric, 2) as total_miles
  from trails t
  where t.name is not null
  group by t.name, t.area
  having count(*) > 1
  order by count(*) desc, t.name;
$$;

-- ── Merge: collapses each duplicate group into one row ────────
create or replace function merge_duplicate_trails()
returns table(
  group_name      text,
  group_area      text,
  segments_merged integer,
  merged_id       text
)
language plpgsql
as $$
declare
  rec         record;
  m_id        text;
  agg_diff    text;
  agg_shape   text;
  agg_dist    float;
  agg_elev    float;
  agg_desc    text;
  agg_tags    jsonb;
  agg_geom    geometry(MultiLineString, 4326);
  agg_created timestamptz;
begin
  for rec in
    select t.name, t.area, count(*) as cnt
    from trails t
    where t.name is not null
    group by t.name, t.area
    having count(*) > 1
  loop
    m_id := 'merged:' || md5(rec.name || ':' || coalesce(rec.area, ''));

    -- Aggregate the segments' attributes
    select
      mode() within group (order by difficulty),
      mode() within group (order by shape),
      sum(distance_m),
      avg(elevation_gain_m),
      string_agg(distinct nullif(description, ''), ' / '),
      coalesce((array_agg(tags))[1], '{}'::jsonb),
      st_multi(st_collect(geometry))::geometry(MultiLineString, 4326),
      min(created_at)
    into
      agg_diff, agg_shape, agg_dist, agg_elev, agg_desc,
      agg_tags, agg_geom, agg_created
    from trails
    where name = rec.name
      and area is not distinct from rec.area;

    -- Drop the originals (cascades to trail_progress)
    delete from trails
    where name = rec.name
      and area is not distinct from rec.area;

    -- Insert the consolidated row
    insert into trails (
      id, name, area, difficulty, shape, distance_m, elevation_gain_m,
      description, tags, geometry, osm_id, osm_type, created_at, updated_at
    ) values (
      m_id, rec.name, rec.area, agg_diff, agg_shape, agg_dist, agg_elev,
      agg_desc, agg_tags, agg_geom, null, 'merged', agg_created, now()
    );

    group_name      := rec.name;
    group_area      := rec.area;
    segments_merged := rec.cnt;
    merged_id       := m_id;
    return next;
  end loop;

  -- Trail IDs changed; rebuild progress for everything
  perform recompute_all_trail_progress();
end;
$$;
