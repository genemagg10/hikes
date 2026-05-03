/**
 * GET /api/trails
 * Returns trails with progress (completion %, last visit, etc.)
 * Optional query params:
 *   ?difficulty=easy|moderate|hard
 *   ?area=Briones+Regional+Park
 *   ?status=complete|in-progress|untouched
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const difficulty = searchParams.get('difficulty');
  const area       = searchParams.get('area');
  const status     = searchParams.get('status');

  let query = supabase
    .from('trails_with_progress')
    .select(
      'id, name, area, difficulty, shape, distance_m, elevation_gain_m, description, ' +
      'completion_pct, is_complete, covered_m, workout_count, first_visit, last_visit'
    );

  if (difficulty) query = query.eq('difficulty', difficulty);
  if (area)       query = query.ilike('area', `%${area}%`);
  if (status === 'complete')    query = query.eq('is_complete', true);
  if (status === 'in-progress') query = query.eq('is_complete', false).gt('completion_pct', 0);
  if (status === 'untouched')   query = query.eq('completion_pct', 0);

  const { data, error } = await query
    .order('completion_pct', { ascending: false })
    .order('name')
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
