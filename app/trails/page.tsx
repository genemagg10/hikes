'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { TRAILS, getAreas } from '@/lib/trails';
import { Trail } from '@/lib/types';

const HikeMap = dynamic(() => import('@/components/HikeMap'), { ssr: false });

const SHAPE_ICONS: Record<string, string> = {
  loop: '🔄',
  'out-and-back': '↔️',
  'point-to-point': '→',
};

const DIFFICULTY_BADGE: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  moderate: 'bg-amber-100 text-amber-700',
  hard: 'bg-red-100 text-red-700',
};

export default function TrailsPage() {
  const [selectedTrail, setSelectedTrail] = useState<Trail | undefined>();
  const [areaFilter, setAreaFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  const areas = getAreas();

  const filtered = TRAILS.filter((t) => {
    if (areaFilter !== 'all' && t.area !== areaFilter) return false;
    if (difficultyFilter !== 'all' && t.difficulty !== difficultyFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lafayette &amp; East Bay Trails</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {TRAILS.length} trails in the 94549 area and surrounding East Bay Regional Parks
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
          {areas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value)}
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
          {filtered.map((trail) => {
            const miles = (trail.distance / 1609.34).toFixed(1);
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
                    <div className="text-xs text-gray-400 mt-0.5">{trail.area}</div>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${DIFFICULTY_BADGE[trail.difficulty]}`}
                  >
                    {trail.difficulty}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                  <span>{SHAPE_ICONS[trail.shape]} {miles} mi</span>
                  {trail.elevationGain && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>+{Math.round(trail.elevationGain * 3.281)}ft</span>
                    </>
                  )}
                </div>
                {trail.description && (
                  <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{trail.description}</p>
                )}
                {trail.tags && trail.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {trail.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Map */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-gray-700 text-sm">
                {selectedTrail ? selectedTrail.name : 'All trails'} — click a trail to highlight
              </span>
            </div>
            <HikeMap
              highlightTrailId={selectedTrail?.id}
              height="480px"
              showAllTrails
            />
          </div>
        </div>
      </div>
    </div>
  );
}
