-- ============================================================
-- TrailTracker — Trail Progress
-- Run AFTER schema.sql + functions.sql in the Supabase SQL Editor
--
-- Tunables:
--   buffer:    30 m  (how close GPS has to pass to count as "covered")
--   complete:  85%  (fraction of trail length covered to count as done)
-- ============================================================

-- ── 1. Per-trail progress table ────────────────────────────────
create table if not exists trail_progress (
  trail_id        text primary key references trails(id) on delete cascade,
  completion_pct  float    not null default 0,
  is_complete     boolean  generated always as (completion_pct >= 0.85) stored,
  covered_m       float    not null default 0,
  workout_count   integer  not null default 0,
  first_visit     timestamptz,
  last_visit      timestamptz,
  updated_at      timestamptz default now()
);

create index if not exists trail_progress_complete_idx on trail_progress (is_complete);
create index if not exists trail_progress_pct_idx      on trail_progress (completion_pct desc);

alter table trail_progress enable row level security;

drop policy if exists "trail_progress_public_read" on trail_progress;
create policy "trail_progress_public_read"
  on trail_progress for select using (true);

-- ── 2. Recompute progress for a list of trails ─────────────────
--    For each given trail: union the per-workout intersections
--    (avoids double-counting overlapping coverage), then divide
--    by the trail's total length.
create or replace function recompute_trail_progress(p_trail_ids text[])
returns void
language plpgsql
as $$
begin
  with candidates as (
    select id, geometry from trails where id = any(p_trail_ids)
  ),
  pairs as (
    select
      t.id        as trail_id,
      t.geometry  as trail_geom,
      w.id        as workout_id,
      w.start_date,
      st_intersection(
        t.geometry,
        st_buffer(w.route::geography, 30)::geometry
      ) as covered
    from candidates t
    join workouts w on w.route is not null
      and st_dwithin(w.route::geography, t.geometry::geography, 60)
  ),
  agg as (
    select
      t.id as trail_id,
      st_length(t.geometry::geography) as trail_len,
      coalesce(
        st_length(st_union(p.covered)::geography),
        0
      ) as covered_len,
      count(distinct p.workout_id) as wcount,
      min(p.start_date) as first_visit,
      max(p.start_date) as last_visit
    from candidates t
    left join pairs p on p.trail_id = t.id
    group by t.id, t.geometry
  )
  insert into trail_progress (
    trail_id, completion_pct, covered_m, workout_count, first_visit, last_visit, updated_at
  )
  select
    trail_id,
    case when trail_len > 0 then least(1.0, covered_len / trail_len) else 0 end,
    covered_len,
    coalesce(wcount, 0),
    first_visit,
    last_visit,
    now()
  from agg
  on conflict (trail_id) do update set
    completion_pct = excluded.completion_pct,
    covered_m      = excluded.covered_m,
    workout_count  = excluded.workout_count,
    first_visit    = excluded.first_visit,
    last_visit     = excluded.last_visit,
    updated_at     = now();
end;
$$;

-- ── 3. One-shot: recompute every trail ─────────────────────────
--    Run once after seeding, or after a bulk workout import.
create or replace function recompute_all_trail_progress()
returns void
language plpgsql
as $$
declare
  ids text[];
begin
  select array_agg(id) into ids from trails;
  if ids is not null then
    perform recompute_trail_progress(ids);
  end if;
end;
$$;

-- ── 4. Trigger: auto-recompute when workouts change ────────────
--    Fires per row. Picks affected trails by st_dwithin (60 m =
--    2× buffer) so we only recompute trails the workout could
--    actually touch.
create or replace function trg_workout_progress()
returns trigger
language plpgsql
as $$
declare
  affected text[];
begin
  if (tg_op = 'DELETE') then
    if old.route is not null then
      select array_agg(t.id) into affected
      from trails t
      where st_dwithin(old.route::geography, t.geometry::geography, 60);
      if affected is not null then
        perform recompute_trail_progress(affected);
      end if;
    end if;
    return old;
  end if;

  if new.route is not null then
    select array_agg(t.id) into affected
    from trails t
    where st_dwithin(new.route::geography, t.geometry::geography, 60);
    if affected is not null then
      perform recompute_trail_progress(affected);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists workouts_recompute_progress on workouts;
create trigger workouts_recompute_progress
  after insert or update or delete on workouts
  for each row
  execute function trg_workout_progress();

-- ── 5. Convenience view: trails joined with progress ───────────
create or replace view trails_with_progress as
select
  t.id,
  t.name,
  t.area,
  t.difficulty,
  t.shape,
  t.distance_m,
  t.elevation_gain_m,
  t.description,
  coalesce(p.completion_pct, 0)  as completion_pct,
  coalesce(p.is_complete, false) as is_complete,
  coalesce(p.covered_m, 0)       as covered_m,
  coalesce(p.workout_count, 0)   as workout_count,
  p.first_visit,
  p.last_visit
from trails t
left join trail_progress p on p.trail_id = t.id;

-- ── 6. Map RPC: GeoJSON of every trail with progress in props ──
create or replace function get_trails_with_progress_geojson()
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
        'id',               t.id,
        'name',             t.name,
        'area',             t.area,
        'difficulty',       t.difficulty,
        'shape',            t.shape,
        'distance_m',       t.distance_m,
        'elevation_gain_m', t.elevation_gain_m,
        'completion_pct',   coalesce(p.completion_pct, 0),
        'is_complete',      coalesce(p.is_complete, false),
        'covered_m',        coalesce(p.covered_m, 0),
        'workout_count',    coalesce(p.workout_count, 0),
        'last_visit',       p.last_visit
      )
    ) as f
    from trails t
    left join trail_progress p on p.trail_id = t.id
    order by t.name
  ) sub;
$$;

-- ── 7. Hero stats RPC ──────────────────────────────────────────
create or replace function get_trail_stats()
returns json
language sql
stable
as $$
  select json_build_object(
    'total_trails',     (select count(*) from trails),
    'completed',        (select count(*) from trail_progress where is_complete),
    'in_progress',      (select count(*) from trail_progress where completion_pct > 0 and not is_complete),
    'untouched',        (select count(*) from trails) - (select count(*) from trail_progress where completion_pct > 0),
    'total_trail_m',    coalesce((select sum(distance_m) from trails), 0),
    'covered_m',        coalesce((select sum(covered_m)  from trail_progress), 0),
    'workouts_with_gps',(select count(*) from workouts where route is not null),
    'last_visit',       (select max(last_visit) from trail_progress)
  );
$$;

-- ── 8. Initial seed ────────────────────────────────────────────
--    Populates trail_progress with zeros for every trail so the
--    UI renders something even before any workouts exist.
select recompute_all_trail_progress();
