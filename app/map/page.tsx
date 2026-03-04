'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Workout, ActivityType } from '@/lib/types';
import { loadWorkouts } from '@/lib/store';

const HikeMap = dynamic(() => import('@/components/HikeMap'), { ssr: false });

const TYPE_FILTER_OPTIONS: { value: ActivityType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'hiking', label: '🥾 Hikes' },
  { value: 'walking', label: '🚶 Walks' },
  { value: 'running', label: '🏃 Runs' },
  { value: 'cycling', label: '🚴 Rides' },
];

export default function MapPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [typeFilter, setTypeFilter] = useState<ActivityType | 'all'>('all');
  const [showTrails, setShowTrails] = useState(true);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => {
    setWorkouts(loadWorkouts());
  }, []);

  const filtered =
    typeFilter === 'all' ? workouts : workouts.filter((w) => w.type === typeFilter);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Trail Map</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Type filter */}
          <div className="flex gap-1">
            {TYPE_FILTER_OPTIONS.map((t) => (
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
          {/* Trail toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showTrails}
              onChange={(e) => setShowTrails(e.target.checked)}
              className="accent-green-600"
            />
            Show trail network
          </label>
        </div>
      </div>

      {/* Full-screen map */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <HikeMap
          workouts={filtered}
          selectedWorkoutId={selectedId}
          onWorkoutClick={(id) => setSelectedId(id === selectedId ? undefined : id)}
          height="calc(100vh - 180px)"
          showAllTrails={showTrails}
        />
      </div>

      <p className="text-xs text-gray-400 text-center">
        Green/amber/red lines = trail network by difficulty. Colored tracks = your recorded activities.
        Click any activity to highlight it.
      </p>
    </div>
  );
}
