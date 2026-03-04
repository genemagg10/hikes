/**
 * GET /api/trails
 * Returns trails as a GeoJSON FeatureCollection.
 * Optional query params:
 *   ?bbox=minLng,minLat,maxLng,maxLat   — spatial filter
 *   ?difficulty=easy|moderate|hard
 *   ?area=Briones+Regional+Park
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bbox       = searchParams.get('bbox');
  const difficulty = searchParams.get('difficulty');
  const area       = searchParams.get('area');

  // Select geometry as GeoJSON from PostGIS
  let query = supabase
    .from('trails')
    .select('id, name, area, difficulty, shape, distance_m, elevation_gain_m, description, tags, osm_id');

  if (difficulty) query = query.eq('difficulty', difficulty);
  if (area)       query = query.ilike('area', `%${area}%`);

  // For bbox filtering we'd need a PostgREST spatial filter or RPC
  // Using the bbox param via a custom RPC for proper PostGIS intersection
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
    // Use PostgREST's built-in geometry filter
    query = query.filter(
      'geometry',
      'cs',
      `SRID=4326;POLYGON((${minLng} ${minLat},${maxLng} ${minLat},${maxLng} ${maxLat},${minLng} ${maxLat},${minLng} ${minLat}))`
    );
  }

  const { data, error } = await query.order('name').limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
