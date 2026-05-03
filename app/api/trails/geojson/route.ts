/**
 * GET /api/trails/geojson
 * Returns every trail as a GeoJSON FeatureCollection with
 * progress fields (completion_pct, is_complete, last_visit) in
 * each feature's properties. Used by the map for color-coding.
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase.rpc('get_trails_with_progress_geojson');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { type: 'FeatureCollection', features: [] });
}
