'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Workout, ActivityType } from '@/lib/types';
import { loadWorkouts } from '@/lib/store';
import type { DbTrail, DbWorkout } from '@/lib/supabase';

const TrailMap = dynamic(() => import('@/components/TrailMap'), { ssr: false });

type MapStyle = 'outdoors' | 'satellite-streets' | 'streets';

const TYPE_OPTS: { value: ActivityType | 'all'; label: string }[] = [
  { value: 'all',     label: 'All' },
  { value: 'hiking',  label: '🥾 Hikes' },
  { value: 'walking', label: '🚶 Walks' },
  { value: 'running', label: '🏃 Runs' },
  { value: 'cycling', label: '🚴 Rides' },
];

function toDbWorkout(w: Workout): DbWorkout {
  return {
    id: w.id,
    type: w.type,
    start_date: w.startDate,
    end_date: w.endDate,
    duration_seconds: w.duration,
    distance_m: w.distance,
    calories: w.calories,
    elevation_ascended_m: w.elevationAscended,
    trail_name: w.trailName,
    has_gps: !!(w.route && w.route.length > 0),
    route_geojson: w.route && w.route.length >= 2
      ? { type: 'LineString', coordinates: w.route.map((p) => [p.lon, p.lat]) }
      : null,
  };
}

export default function MapPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [trails, setTrails]     = useState<DbTrail[]>([]);
  const [typeFilter, setTypeFilter] = useState<ActivityType | 'all'>('all');
  const [mapStyle, setMapStyle] = useState<MapStyle>('outdoors');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [selectedTrailId, setSelectedTrailId] = useState<string | undefined>();
  const [showWorkouts, setShowWorkouts] = useState(true);

  useEffect(() => {
    Promise.all([
      loadWorkouts(),
      fetch('/api/trails').then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([wk, tr]) => {
      setWorkouts(wk as Workout[]);
      setTrails(tr as DbTrail[]);
    });
  }, []);

  const filteredWorkouts = typeFilter === 'all'
    ? workouts
    : workouts.filter((w) => w.type === typeFilter);

  const dbWorkouts: DbWorkout[] = showWorkouts ? filteredWorkouts.map(toDbWorkout) : [];

  return (
    <div className="space-y-3 -mx-4 px-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Trail Map</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Activity type filter */}
          <div className="flex gap-1">
            {TYPE_OPTS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTypeFilter(t.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  typeFilter === t.value
                    ? 'bg-green-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* Show my routes toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showWorkouts}
              onChange={(e) => setShowWorkouts(e.target.checked)}
              className="accent-green-600"
            />
            My routes
          </label>
        </div>
      </div>

      {/* Map — nearly full viewport height */}
      <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <TrailMap
          trails={trails}
          workouts={dbWorkouts}
          selectedWorkoutId={selectedId}
          highlightTrailId={selectedTrailId}
          onWorkoutClick={(id) => setSelectedId(id === selectedId ? undefined : id)}
          onTrailClick={(id) => setSelectedTrailId(id === selectedTrailId ? undefined : id)}
          height="calc(100vh - 160px)"
          style={mapStyle}
        />
      </div>

      <p className="text-xs text-gray-400 text-center pb-1">
        Trail network from OpenStreetMap · green = easy, amber = moderate, red = hard ·
        dashed = out-and-back · hover any trail for details
      </p>
    </div>
  );
}
