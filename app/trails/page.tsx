'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { DbTrail } from '@/lib/supabase';

const TrailMap = dynamic(() => import('@/components/TrailMap'), { ssr: false });

const DIFFICULTY_BADGE: Record<string, string> = {
  easy:     'bg-green-100 text-green-700',
  moderate: 'bg-amber-100 text-amber-700',
  hard:     'bg-red-100 text-red-700',
};

const SHAPE_ICONS: Record<string, string> = {
  loop:             '🔄',
  'out-and-back':   '↔️',
  'point-to-point': '→',
};

type StatusFilter = 'all' | 'complete' | 'in-progress' | 'untouched';
type SortMode     = 'progress' | 'name' | 'distance' | 'last-visit';

export default function TrailsPage() {
  const [trails, setTrails]     = useState<DbTrail[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selectedTrail, setSelectedTrail] = useState<DbTrail | undefined>();
  const [areaFilter, setAreaFilter] = useState('all');
  const [diffFilter, setDiffFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort]         = useState<SortMode>('progress');

  useEffect(() => {
    fetch('/api/trails')
      .then((r) => r.ok ? r.json() : [])
      .catch(() => [])
      .then((data: DbTrail[]) => {
        setTrails(data);
        setLoading(false);
      });
  }, []);

  const areas = [...new Set(trails.map((t) => t.area).filter(Boolean))].sort() as string[];

  const filtered = trails
    .filter((t) => {
      if (areaFilter !== 'all' && t.area !== areaFilter) return false;
      if (diffFilter !== 'all' && t.difficulty !== diffFilter) return false;
      if (statusFilter === 'complete'    && !t.is_complete) return false;
      if (statusFilter === 'in-progress' && (t.is_complete || (t.completion_pct ?? 0) === 0)) return false;
      if (statusFilter === 'untouched'   && (t.completion_pct ?? 0) > 0) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'progress') return (b.completion_pct ?? 0) - (a.completion_pct ?? 0);
      if (sort === 'name')     return a.name.localeCompare(b.name);
      if (sort === 'distance') return (b.distance_m ?? 0) - (a.distance_m ?? 0);
      if (sort === 'last-visit') {
        return (b.last_visit ?? '').localeCompare(a.last_visit ?? '');
      }
      return 0;
    });

  const completedCount = trails.filter((t) => t.is_complete).length;
  const inProgressCount = trails.filter((t) => !t.is_complete && (t.completion_pct ?? 0) > 0).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trail Progress</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {loading
            ? 'Loading…'
            : `${completedCount} of ${trails.length} trails complete · ${inProgressCount} in progress`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All trails</option>
          <option value="complete">✅ Complete</option>
          <option value="in-progress">⏳ In progress</option>
          <option value="untouched">⚪ Untouched</option>
        </select>
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All areas</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={diffFilter}
          onChange={(e) => setDiffFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="moderate">Moderate</option>
          <option value="hard">Hard</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="progress">Sort: progress</option>
          <option value="name">Sort: name</option>
          <option value="distance">Sort: distance</option>
          <option value="last-visit">Sort: last visit</option>
        </select>
        <span className="ml-auto text-sm text-gray-400">
          {filtered.length} shown
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Trail list */}
        <div className="lg:col-span-2 space-y-2 max-h-[72vh] overflow-y-auto pr-1">
          {loading && (
            <div className="text-center py-12 text-gray-400 text-sm">Loading trails…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              No trails match these filters.
            </div>
          )}
          {filtered.map((trail) => {
            const miles = trail.distance_m ? (trail.distance_m / 1609.34).toFixed(1) : '?';
            const isSelected = trail.id === selectedTrail?.id;
            const pct = (trail.completion_pct ?? 0) * 100;
            const status = trail.is_complete
              ? { icon: '✅', label: 'Complete', color: 'text-emerald-600', bar: 'from-emerald-500 to-emerald-700' }
              : pct > 0
                ? { icon: '⏳', label: 'In progress', color: 'text-amber-600', bar: 'from-amber-400 to-amber-600' }
                : { icon: '⚪', label: 'Untouched', color: 'text-gray-400', bar: 'from-gray-300 to-gray-400' };

            return (
              <button
                key={trail.id}
                onClick={() => setSelectedTrail(isSelected ? undefined : trail)}
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  isSelected
                    ? 'border-orange-400 bg-orange-50 shadow-md'
                    : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{status.icon}</span>
                      <span className="font-semibold text-gray-900 truncate">{trail.name}</span>
                    </div>
                    {trail.area && (
                      <div className="text-xs text-gray-400 mt-0.5 ml-7">{trail.area}</div>
                    )}
                  </div>
                  {trail.difficulty && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${DIFFICULTY_BADGE[trail.difficulty] ?? 'bg-gray-100 text-gray-500'}`}>
                      {trail.difficulty}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-3 ml-7">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 tabular-nums">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${status.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-2 ml-7 text-sm text-gray-600">
                  {trail.shape && <span>{SHAPE_ICONS[trail.shape] ?? '→'}</span>}
                  <span>{miles} mi</span>
                  {trail.elevation_gain_m && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>+{Math.round(trail.elevation_gain_m * 3.281)}ft</span>
                    </>
                  )}
                  {trail.last_visit && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="text-gray-400">
                        last: {new Date(trail.last_visit).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Map */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-600">
              {selectedTrail
                ? <><span className="font-semibold">{selectedTrail.name}</span> — {((selectedTrail.completion_pct ?? 0) * 100).toFixed(0)}% complete</>
                : 'Click any trail to highlight it on the map'}
            </div>
            <TrailMap
              highlightTrailId={selectedTrail?.id}
              colorMode="completion"
              onTrailClick={(id) => {
                const t = trails.find((x) => x.id === id);
                setSelectedTrail(t?.id === selectedTrail?.id ? undefined : t);
              }}
              height="480px"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
