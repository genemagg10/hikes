/**
 * GET  /api/workouts      — list workouts (summary view, no GPS route)
 * POST /api/workouts      — bulk upsert workouts from Apple Health import
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Workout } from '@/lib/types';

export async function GET() {
  const { data, error } = await supabase
    .from('workout_summary')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body: Workout[] = await req.json();
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected an array of workouts' }, { status: 400 });
  }

  // Convert Workout type to DB columns
  const rows = body.map((w) => ({
    id:                   w.id,
    type:                 w.type,
    start_date:           w.startDate,
    end_date:             w.endDate,
    duration_seconds:     w.duration,
    distance_m:           w.distance,
    calories:             w.calories ?? null,
    elevation_ascended_m: w.elevationAscended ?? null,
    elevation_descended_m: w.elevationDescended ?? null,
    trail_name:           w.trailName ?? null,
    notes:                w.notes ?? null,
    // Convert GpxPoint[] to WKT LineString for PostGIS
    route: w.route && w.route.length >= 2
      ? `SRID=4326;LINESTRING(${w.route.map((p) => `${p.lon} ${p.lat}`).join(',')})`
      : null,
    matched_trail_ids: w.matchedTrailIds ?? null,
  }));

  const { data, error } = await supabase
    .from('workouts')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: data?.length ?? 0 });
}
