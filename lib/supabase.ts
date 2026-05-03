import { createClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !anon) {
  throw new Error(
    'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

/** Client-safe Supabase client (uses anon key) */
export const supabase = createClient(url, anon);

// ── Types mirroring Supabase table columns ─────────────────────────────────

export interface DbWorkout {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  duration_seconds: number;
  distance_m: number;
  calories?: number;
  elevation_ascended_m?: number;
  elevation_descended_m?: number;
  trail_name?: string;
  notes?: string;
  route_geojson?: GeoJSON.LineString | null;  // from workout_summary view
  matched_trail_ids?: string[];
  has_gps?: boolean;
}

export interface DbTrail {
  id: string;
  name: string;
  area?: string;
  difficulty?: string;
  shape?: string;
  distance_m?: number;
  elevation_gain_m?: number;
  description?: string;
  tags?: Record<string, string>;
  // geometry returned as GeoJSON from Supabase
  geometry?: GeoJSON.MultiLineString;
  osm_id?: number;
  osm_type?: string;
  // progress fields (when fetched via trails_with_progress view)
  completion_pct?: number;
  is_complete?: boolean;
  covered_m?: number;
  workout_count?: number;
  first_visit?: string;
  last_visit?: string;
}

export interface DbTrailStats {
  total_trails: number;
  completed: number;
  in_progress: number;
  untouched: number;
  total_trail_m: number;
  covered_m: number;
  workouts_with_gps: number;
  last_visit: string | null;
}
