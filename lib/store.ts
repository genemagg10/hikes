/**
 * Data store — Supabase-backed with localStorage fallback.
 *
 * All write operations go to:
 *   1. Supabase (via /api/workouts route)
 *   2. localStorage (always, as offline cache)
 *
 * This means the app works offline and syncs when online.
 */

import { Workout, Stats, ActivityType } from './types';
import { matchTrailsToRoute, getTrailById } from './trails';

const LS_KEY = 'hike-tracker-workouts';

// ─── localStorage (offline cache) ──────────────────────────────────────────

export function loadWorkoutsLocal(): Workout[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Workout[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(workouts: Workout[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY, JSON.stringify(workouts));
}

// ─── Supabase helpers (client-side fetch to API routes) ────────────────────

async function fetchWorkoutsRemote(): Promise<Workout[]> {
  try {
    const res = await fetch('/api/workouts');
    if (!res.ok) return [];
    const rows = await res.json();
    // Map DB columns back to Workout type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any): Workout => ({
      id:                 r.id,
      type:               r.type as ActivityType,
      startDate:          r.start_date,
      endDate:            r.end_date ?? r.start_date,
      duration:           r.duration_seconds,
      distance:           r.distance_m,
      calories:           r.calories,
      elevationAscended:  r.elevation_ascended_m,
      elevationDescended: r.elevation_descended_m,
      trailName:          r.trail_name,
      notes:              r.notes,
      route:              undefined, // don't deserialize route on list fetch
      matchedTrailIds:    r.matched_trail_ids,
    }));
  } catch {
    return [];
  }
}

async function saveWorkoutsRemote(workouts: Workout[]): Promise<void> {
  try {
    await fetch('/api/workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workouts),
    });
  } catch {
    // Silently fail — local storage is the fallback
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Load workouts — from Supabase if available, else localStorage */
export async function loadWorkouts(): Promise<Workout[]> {
  const remote = await fetchWorkoutsRemote();
  if (remote.length > 0) {
    saveLocal(remote);
    return remote;
  }
  return loadWorkoutsLocal();
}

/** Add new workouts (deduplicate, auto-match trails, persist) */
export async function addWorkouts(
  incoming: Workout[]
): Promise<{ added: number; skipped: number }> {
  const existing = loadWorkoutsLocal();
  const existingIds = new Set(existing.map((w) => w.id));

  let added = 0;
  let skipped = 0;
  const newWorkouts: Workout[] = [];

  for (const w of incoming) {
    if (existingIds.has(w.id)) {
      skipped++;
      continue;
    }
    // Auto-match trails from GPS route
    if (w.route && w.route.length > 0) {
      w.matchedTrailIds = matchTrailsToRoute(w.route);
      if (!w.trailName && w.matchedTrailIds.length > 0) {
        const trail = getTrailById(w.matchedTrailIds[0]);
        if (trail) w.trailName = trail.name;
      }
    }
    newWorkouts.push(w);
    added++;
  }

  if (added > 0) {
    const all = [...existing, ...newWorkouts];
    saveLocal(all);
    await saveWorkoutsRemote(newWorkouts);
  }

  return { added, skipped };
}

/** Update a single workout field */
export async function updateWorkout(id: string, patch: Partial<Workout>): Promise<void> {
  const workouts = loadWorkoutsLocal();
  const idx = workouts.findIndex((w) => w.id === id);
  if (idx === -1) return;
  workouts[idx] = { ...workouts[idx], ...patch };
  saveLocal(workouts);
  await saveWorkoutsRemote([workouts[idx]]);
}

export function deleteWorkout(id: string): void {
  const workouts = loadWorkoutsLocal().filter((w) => w.id !== id);
  saveLocal(workouts);
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export function computeStats(workouts: Workout[]): Stats {
  const byType: Record<ActivityType, number> = {
    hiking: 0, walking: 0, running: 0, cycling: 0, other: 0,
  };
  let totalDistance = 0;
  let totalDuration = 0;
  let totalElevation = 0;
  const trailNames = new Set<string>();

  for (const w of workouts) {
    byType[w.type] = (byType[w.type] ?? 0) + 1;
    totalDistance  += w.distance;
    totalDuration  += w.duration;
    totalElevation += w.elevationAscended ?? 0;
    if (w.trailName) trailNames.add(w.trailName);
  }

  return {
    totalHikes: workouts.length,
    totalDistance,
    totalDuration,
    totalElevation,
    uniqueTrails: trailNames.size,
    byType,
  };
}

// ─── JSON export / import ───────────────────────────────────────────────────

export function exportJson(): string {
  return JSON.stringify(loadWorkoutsLocal(), null, 2);
}

export async function importJson(
  json: string
): Promise<{ added: number; skipped: number }> {
  const data = JSON.parse(json) as Workout[];
  return addWorkouts(data);
}
