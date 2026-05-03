/**
 * POST /api/seed
 * Seeds the Supabase trails table with real OSM data for the Lamorinda area.
 * Protected by SUPABASE_SERVICE_ROLE_KEY — do not expose this route publicly.
 *
 * Call once after setting up your Supabase project:
 *   curl -X POST https://your-site.vercel.app/api/seed \
 *     -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';
import { fetchLamorindaTrails, coordsToWkt } from '@/lib/osm';

export async function POST(req: NextRequest) {
  // Simple auth check
  const auth = req.headers.get('authorization') ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  );

  try {
    console.log('Fetching trails from Overpass API…');
    const trails = await fetchLamorindaTrails();
    console.log(`Fetched ${trails.length} trails`);

    let inserted = 0;
    let skipped  = 0;

    for (const trail of trails) {
      const wkt = coordsToWkt(trail.coordinates);

      const { error } = await supabase.rpc('upsert_trail_wkt', {
        p_id:         trail.id,
        p_name:       trail.name,
        p_area:       trail.area ?? null,
        p_difficulty: trail.difficulty ?? 'easy',
        p_shape:      trail.shape ?? 'out-and-back',
        p_distance_m: trail.distance_m ?? null,
        p_tags:       trail.tags,
        p_osm_id:     trail.osm_id,
        p_osm_type:   trail.osm_type,
        p_wkt:        wkt,
      });

      if (error) {
        console.warn(`Skip ${trail.id}: ${error.message}`);
        skipped++;
      } else {
        inserted++;
      }
    }

    return NextResponse.json({ ok: true, inserted, skipped, total: trails.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
