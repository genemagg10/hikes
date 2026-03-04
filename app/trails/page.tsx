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

export default function TrailsPage() {
  const [trails, setTrails]             = useState<DbTrail[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedTrail, setSelectedTrail] = useState<DbTrail | undefined>();
  const [areaFilter, setAreaFilter]     = useState('all');
  const [diffFilter, setDiffFilter]     = useState('all');

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

  const filtered = trails.filter((t) => {
    if (areaFilter !== 'all' && t.area !== areaFilter) return false;
    if (diffFilter !== 'all' && t.difficulty !== diffFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lamorinda Trail Network</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {loading ? 'Loading trail data from OpenStreetMap…' : `${trails.length} trails · Lafayette, Moraga, Orinda and surrounding EBRPD lands`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
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
        <span className="ml-auto text-sm text-gray-400 self-center">
          {filtered.length} trail{filtered.length !== 1 ? 's' : ''}
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
              No trails found.{' '}
              {trails.length === 0 && (
                <span>
                  Run the seed command to load OSM trail data — see{' '}
                  <code className="text-xs">supabase/schema.sql</code>.
                </span>
              )}
            </div>
          )}
          {filtered.map((trail) => {
            const miles = trail.distance_m ? (trail.distance_m / 1609.34).toFixed(1) : '?';
            const isSelected = trail.id === selectedTrail?.id;
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
                    <div className="font-semibold text-gray-900 truncate">{trail.name}</div>
                    {trail.area && (
                      <div className="text-xs text-gray-400 mt-0.5">{trail.area}</div>
                    )}
                  </div>
                  {trail.difficulty && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${DIFFICULTY_BADGE[trail.difficulty] ?? 'bg-gray-100 text-gray-500'}`}>
                      {trail.difficulty}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                  {trail.shape && <span>{SHAPE_ICONS[trail.shape] ?? '→'}</span>}
                  <span>{miles} mi</span>
                  {trail.elevation_gain_m && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>+{Math.round(trail.elevation_gain_m * 3.281)}ft</span>
                    </>
                  )}
                </div>
                {trail.description && (
                  <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{trail.description}</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Map */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-600">
              {selectedTrail
                ? <><span className="font-semibold">{selectedTrail.name}</span> — highlighted in orange</>
                : 'Hover any trail for details · click to select'}
            </div>
            <TrailMap
              trails={trails}
              highlightTrailId={selectedTrail?.id}
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
