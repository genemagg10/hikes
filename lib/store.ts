/**
 * Client-side storage using localStorage.
 * All workout data lives in the browser — no server required.
 * Export/import JSON to backup or migrate.
 */

import { Workout, Stats, ActivityType } from './types';
import { matchTrailsToRoute, getTrailById } from './trails';

const STORAGE_KEY = 'hike-tracker-workouts';

// ─── CRUD ──────────────────────────────────────────────────────────────────

export function loadWorkouts(): Workout[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Workout[]) : [];
  } catch {
    return [];
  }
}

export function saveWorkouts(workouts: Workout[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
}

export function addWorkouts(incoming: Workout[]): { added: number; skipped: number } {
  const existing = loadWorkouts();
  const existingIds = new Set(existing.map((w) => w.id));

  let added = 0;
  let skipped = 0;

  for (const w of incoming) {
    if (existingIds.has(w.id)) {
      skipped++;
    } else {
      // Auto-match to trails if route available
      if (w.route && w.route.length > 0) {
        w.matchedTrailIds = matchTrailsToRoute(w.route);
        if (!w.trailName && w.matchedTrailIds.length > 0) {
          const trail = getTrailById(w.matchedTrailIds[0]);
          if (trail) w.trailName = trail.name;
        }
      }
      existing.push(w);
      added++;
    }
  }

  if (added > 0) saveWorkouts(existing);
  return { added, skipped };
}

export function updateWorkout(id: string, patch: Partial<Workout>): void {
  const workouts = loadWorkouts();
  const idx = workouts.findIndex((w) => w.id === id);
  if (idx === -1) return;
  workouts[idx] = { ...workouts[idx], ...patch };
  saveWorkouts(workouts);
}

export function deleteWorkout(id: string): void {
  const workouts = loadWorkouts().filter((w) => w.id !== id);
  saveWorkouts(workouts);
}

// ─── Stats ─────────────────────────────────────────────────────────────────

export function computeStats(workouts: Workout[]): Stats {
  const byType: Record<ActivityType, number> = {
    hiking: 0,
    walking: 0,
    running: 0,
    cycling: 0,
    other: 0,
  };

  let totalDistance = 0;
  let totalDuration = 0;
  let totalElevation = 0;
  const trailNames = new Set<string>();

  for (const w of workouts) {
    byType[w.type] = (byType[w.type] ?? 0) + 1;
    totalDistance += w.distance;
    totalDuration += w.duration;
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

// ─── Filters ───────────────────────────────────────────────────────────────

export function filterWorkouts(
  workouts: Workout[],
  opts: {
    type?: ActivityType;
    trailName?: string;
    year?: number;
  }
): Workout[] {
  return workouts.filter((w) => {
    if (opts.type && w.type !== opts.type) return false;
    if (opts.trailName && w.trailName !== opts.trailName) return false;
    if (opts.year) {
      const year = new Date(w.startDate).getFullYear();
      if (year !== opts.year) return false;
    }
    return true;
  });
}

// ─── Export / Import JSON ──────────────────────────────────────────────────

export function exportJson(): string {
  return JSON.stringify(loadWorkouts(), null, 2);
}

export function importJson(json: string): { added: number; skipped: number } {
  const data = JSON.parse(json) as Workout[];
  return addWorkouts(data);
}
