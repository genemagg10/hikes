'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Workout, ActivityType } from '@/lib/types';
import { loadWorkouts, deleteWorkout, updateWorkout, loadWorkoutsLocal } from '@/lib/store';
import WorkoutCard from '@/components/WorkoutCard';
import type { DbTrail, DbWorkout } from '@/lib/supabase';

const TrailMap = dynamic(() => import('@/components/TrailMap'), { ssr: false });

const TYPES: { value: ActivityType | 'all'; label: string }[] = [
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
    notes: w.notes,
    has_gps: !!(w.route && w.route.length > 0),
    route_geojson: w.route && w.route.length >= 2
      ? { type: 'LineString', coordinates: w.route.map((p) => [p.lon, p.lat]) }
      : null,
  };
}

function HikesPageInner() {
  const searchParams = useSearchParams();
  const initialType = (searchParams.get('type') as ActivityType) ?? 'all';

  const [workouts, setWorkouts]     = useState<Workout[]>([]);
  const [trails, setTrails]         = useState<DbTrail[]>([]);
  const [typeFilter, setTypeFilter] = useState<ActivityType | 'all'>(initialType);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [editingId, setEditingId]   = useState<string | undefined>();
  const [editName, setEditName]     = useState('');
  const [editNotes, setEditNotes]   = useState('');

  useEffect(() => {
    // Load local cache immediately for snappy UI, then refresh from remote
    const local = loadWorkoutsLocal().sort((a, b) => (a.startDate > b.startDate ? -1 : 1));
    setWorkouts(local);

    Promise.all([
      loadWorkouts(),
      fetch('/api/trails').then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([remote, tr]) => {
      setWorkouts((remote as Workout[]).sort((a, b) => (a.startDate > b.startDate ? -1 : 1)));
      setTrails(tr as DbTrail[]);
    });
  }, []);

  async function reload() {
    const data = await loadWorkouts();
    setWorkouts(data.sort((a, b) => (a.startDate > b.startDate ? -1 : 1)));
  }

  const filtered =
    typeFilter === 'all' ? workouts : workouts.filter((w) => w.type === typeFilter);

  const selected = workouts.find((w) => w.id === selectedId);

  function startEdit(w: Workout) {
    setEditingId(w.id);
    setEditName(w.trailName ?? '');
    setEditNotes(w.notes ?? '');
  }

  async function saveEdit() {
    if (!editingId) return;
    await updateWorkout(editingId, {
      trailName: editName || undefined,
      notes: editNotes || undefined,
    });
    setEditingId(undefined);
    reload();
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this activity?')) return;
    deleteWorkout(id);
    if (selectedId === id) setSelectedId(undefined);
    reload();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">All Activities</h1>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        {TYPES.map((t) => (
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
        <span className="ml-auto text-sm text-gray-400 self-center">
          {filtered.length} activit{filtered.length === 1 ? 'y' : 'ies'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Activity list */}
        <div className="lg:col-span-2 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">No activities found.</div>
          )}
          {filtered.map((w) => (
            <div key={w.id} className="relative group">
              <WorkoutCard
                workout={w}
                selected={w.id === selectedId}
                onClick={() => setSelectedId(w.id === selectedId ? undefined : w.id)}
              />
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(w)}
                  className="text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 hover:text-gray-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(w.id)}
                  className="text-xs bg-white border border-red-200 rounded px-1.5 py-0.5 text-red-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Map + detail */}
        <div className="lg:col-span-3 space-y-4">
          <TrailMap
            trails={trails}
            workouts={filtered.map(toDbWorkout)}
            selectedWorkoutId={selectedId}
            onWorkoutClick={(id) => setSelectedId(id === selectedId ? undefined : id)}
            height="420px"
          />
          {/* Selected detail */}
          {selected && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">
                  {selected.trailName ?? 'Activity detail'}
                </h3>
                <button
                  onClick={() => startEdit(selected)}
                  className="text-sm text-green-600 hover:underline"
                >
                  Edit name
                </button>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {[
                  ['Date',     new Date(selected.startDate).toLocaleDateString()],
                  ['Type',     selected.type],
                  ['Distance', `${(selected.distance / 1609.34).toFixed(2)} mi`],
                  ['Duration', `${Math.round(selected.duration / 60)} min`],
                  selected.calories          ? ['Calories',  `${selected.calories} kcal`] : null,
                  selected.elevationAscended ? ['Elevation', `+${Math.round(selected.elevationAscended * 3.281)}ft`] : null,
                ]
                  .filter((x): x is string[] => x !== null)
                  .map(([label, val]) => (
                    <div key={label}>
                      <dt className="text-gray-400">{label}</dt>
                      <dd className="font-medium text-gray-800 capitalize">{val}</dd>
                    </div>
                  ))}
              </dl>
              {selected.notes && (
                <p className="text-sm text-gray-500 italic">{selected.notes}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-bold text-gray-800">Edit Activity</h2>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Trail name</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Lafayette Reservoir Loop"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional notes…"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditingId(undefined)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HikesPage() {
  return (
    <Suspense>
      <HikesPageInner />
    </Suspense>
  );
}
