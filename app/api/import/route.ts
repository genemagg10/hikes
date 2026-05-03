/**
 * POST /api/import
 *
 * Accepts workouts pushed from an iOS Shortcut (or any HTTP client).
 * Auth: Authorization: Bearer <IMPORT_TOKEN>
 *
 * Body shapes accepted:
 *   - Single workout object   { type, startDate, ... }
 *   - Array of workouts       [ {...}, {...} ]
 *   - Wrapped object          { workouts: [ {...} ] }
 *
 * Field aliases for Shortcut friendliness:
 *   type:       "hiking" | "Hiking" | "HKWorkoutActivityTypeHiking"
 *   duration:   seconds (or "durationMinutes" in minutes)
 *   distance:   meters  (or "distanceMiles" in miles)
 *   elevation / elevationAscended: meters
 *   route:      [{ lat, lon, ele?, time? }]
 *               or string "lat,lon\nlat,lon\n..."
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ACTIVITY_MAP: Record<string, string> = {
  hiking: 'hiking',
  hike: 'hiking',
  hkworkoutactivitytypehiking: 'hiking',
  walking: 'walking',
  walk: 'walking',
  hkworkoutactivitytypewalking: 'walking',
  running: 'running',
  run: 'running',
  hkworkoutactivitytyperunning: 'running',
  cycling: 'cycling',
  cycle: 'cycling',
  bike: 'cycling',
  biking: 'cycling',
  hkworkoutactivitytypecycling: 'cycling',
};

interface ImportPoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
}

interface NormalizedWorkout {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  duration_seconds: number;
  distance_m: number;
  calories: number | null;
  elevation_ascended_m: number | null;
  elevation_descended_m: number | null;
  trail_name: string | null;
  notes: string | null;
  route: string | null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function parseRoute(raw: unknown): ImportPoint[] | null {
  if (!raw) return null;

  if (Array.isArray(raw)) {
    const pts: ImportPoint[] = [];
    for (const p of raw) {
      const lat = num(p?.lat ?? p?.latitude);
      const lon = num(p?.lon ?? p?.lng ?? p?.longitude);
      if (lat === null || lon === null) continue;
      pts.push({
        lat,
        lon,
        ele: num(p?.ele ?? p?.elevation ?? p?.altitude) ?? undefined,
        time: typeof p?.time === 'string' ? p.time : undefined,
      });
    }
    return pts.length >= 2 ? pts : null;
  }

  if (typeof raw === 'string') {
    const pts: ImportPoint[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const parts = line.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length < 2) continue;
      const lat = num(parts[0]);
      const lon = num(parts[1]);
      if (lat === null || lon === null) continue;
      pts.push({ lat, lon, ele: num(parts[2]) ?? undefined });
    }
    return pts.length >= 2 ? pts : null;
  }

  return null;
}

function normalize(input: Record<string, unknown>): NormalizedWorkout | string {
  const rawType = String(input.type ?? input.activityType ?? '').trim().toLowerCase();
  const type = ACTIVITY_MAP[rawType] ?? (rawType ? 'other' : null);
  if (!type) return 'Missing or unknown "type"';

  const startDate = String(input.startDate ?? input.start ?? '').trim();
  if (!startDate) return 'Missing "startDate"';
  const endDate = String(input.endDate ?? input.end ?? startDate).trim();

  let duration = num(input.duration);
  if (duration === null) {
    const mins = num(input.durationMinutes);
    if (mins !== null) duration = mins * 60;
  }
  if (duration === null) {
    const a = Date.parse(startDate);
    const b = Date.parse(endDate);
    if (Number.isFinite(a) && Number.isFinite(b)) duration = Math.round((b - a) / 1000);
  }
  if (duration === null || duration < 0) duration = 0;

  let distance = num(input.distance) ?? num(input.distanceMeters);
  if (distance === null) {
    const mi = num(input.distanceMiles);
    if (mi !== null) distance = mi * 1609.34;
  }
  if (distance === null) distance = 0;

  const elevationAsc =
    num(input.elevationAscended) ?? num(input.elevation) ?? num(input.elevationGain);
  const elevationDesc = num(input.elevationDescended) ?? num(input.elevationLoss);

  const id =
    typeof input.id === 'string' && input.id
      ? input.id
      : `${startDate}-${type}`.replace(/[^a-zA-Z0-9-]/g, '-');

  const route = parseRoute(input.route ?? input.locations ?? input.gps);
  const wkt =
    route && route.length >= 2
      ? `SRID=4326;LINESTRING(${route.map((p) => `${p.lon} ${p.lat}`).join(',')})`
      : null;

  return {
    id,
    type,
    start_date: startDate,
    end_date: endDate,
    duration_seconds: Math.round(duration),
    distance_m: distance,
    calories: num(input.calories) ?? num(input.activeEnergy) ?? null,
    elevation_ascended_m: elevationAsc,
    elevation_descended_m: elevationDesc,
    trail_name: typeof input.trailName === 'string' ? input.trailName : null,
    notes: typeof input.notes === 'string' ? input.notes : null,
    route: wkt,
  };
}

export async function POST(req: NextRequest) {
  const expected = process.env.IMPORT_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: 'IMPORT_TOKEN not configured on server' },
      { status: 500 }
    );
  }

  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400 });
  }

  const items: unknown[] = Array.isArray(body)
    ? body
    : Array.isArray((body as { workouts?: unknown[] })?.workouts)
      ? (body as { workouts: unknown[] }).workouts
      : body && typeof body === 'object'
        ? [body]
        : [];

  if (items.length === 0) {
    return NextResponse.json({ error: 'No workouts in request' }, { status: 400 });
  }

  const rows: NormalizedWorkout[] = [];
  const errors: { index: number; error: string }[] = [];

  items.forEach((item, i) => {
    if (!item || typeof item !== 'object') {
      errors.push({ index: i, error: 'Not an object' });
      return;
    }
    const result = normalize(item as Record<string, unknown>);
    if (typeof result === 'string') errors.push({ index: i, error: result });
    else rows.push(result);
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid workouts', details: errors }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('workouts')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    saved: data?.length ?? 0,
    rejected: errors.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
