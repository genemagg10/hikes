'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ActivityType } from '@/lib/types';
import type { DbWorkout } from '@/lib/supabase';

const TrailMap = dynamic(() => import('@/components/TrailMap'), { ssr: false });

const TYPE_OPTS: { value: ActivityType | 'all'; label: string }[] = [
  { value: 'all',     label: 'All' },
  { value: 'hiking',  label: '🥾 Hikes' },
  { value: 'walking', label: '🚶 Walks' },
  { value: 'running', label: '🏃 Runs' },
  { value: 'cycling', label: '🚴 Rides' },
];

export default function MapPage() {
  const [workouts, setWorkouts] = useState<DbWorkout[]>([]);
  const [typeFilter, setTypeFilter] = useState<ActivityType | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [selectedTrailId, setSelectedTrailId] = useState<string | undefined>();
  const [showWorkouts, setShowWorkouts] = useState(true);

  useEffect(() => {
    // Fetch workouts with their GeoJSON routes from the workout_summary view
    fetch('/api/workouts')
      .then((r) => r.ok ? r.json() : [])
      .catch(() => [])
      .then((data: DbWorkout[]) => setWorkouts(data));
  }, []);

  const filtered = typeFilter === 'all'
    ? workouts
    : workouts.filter((w) => w.type === typeFilter);

  const visible = showWorkouts ? filtered : [];

  return (
    <div className="space-y-3 -mx-4 px-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Trail Map</h1>
        <div className="flex items-center gap-3 flex-wrap">
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

      <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <TrailMap
          workouts={visible}
          selectedWorkoutId={selectedId}
          highlightTrailId={selectedTrailId}
          onWorkoutClick={(id) => setSelectedId(id === selectedId ? undefined : id)}
          onTrailClick={(id) => setSelectedTrailId(id === selectedTrailId ? undefined : id)}
          height="calc(100vh - 160px)"
        />
      </div>

      <p className="text-xs text-gray-400 text-center pb-1">
        Trails colored by completion: <span className="text-emerald-600 font-medium">green = complete</span>,
        <span className="text-amber-600 font-medium"> amber = in progress</span>,
        <span className="text-gray-500 font-medium"> gray = not yet hiked</span>
      </p>
    </div>
  );
}
