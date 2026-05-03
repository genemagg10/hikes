'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { DbTrail, DbTrailStats } from '@/lib/supabase';

const TrailMap = dynamic(() => import('@/components/TrailMap'), { ssr: false });

export default function Dashboard() {
  const [stats, setStats]   = useState<DbTrailStats | null>(null);
  const [trails, setTrails] = useState<DbTrail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/trails').then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([s, t]) => {
      setStats(s as DbTrailStats);
      setTrails(t as DbTrail[]);
      setLoading(false);
    });
  }, []);

  const completed = stats?.completed ?? 0;
  const total     = stats?.total_trails ?? 0;
  const pct       = total > 0 ? (completed / total) * 100 : 0;
  const coveredMi = ((stats?.covered_m ?? 0) / 1609.34).toFixed(1);
  const totalMi   = ((stats?.total_trail_m ?? 0) / 1609.34).toFixed(0);

  const closeToFinish = trails
    .filter((t) => !t.is_complete && (t.completion_pct ?? 0) >= 0.5)
    .slice(0, 5);

  const recentlyCompleted = trails
    .filter((t) => t.is_complete && t.last_visit)
    .sort((a, b) => (a.last_visit! < b.last_visit! ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* About strip */}
      <div className="text-sm text-gray-500">
        One person&apos;s ongoing attempt to walk every trail in the
        Lamorinda area — Lafayette, Moraga, Orinda, and surrounding EBRPD lands.
      </div>

      {/* Hero */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Trail completion
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-bold text-gray-900">{completed}</span>
              <span className="text-2xl text-gray-400">/ {total}</span>
              <span className="text-lg text-gray-500 ml-2">trails complete</span>
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {pct.toFixed(1)}% of the network · {coveredMi} mi covered of {totalMi} mi total
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400 uppercase">Last hike</div>
            <div className="text-sm font-medium text-gray-700">
              {stats?.last_visit
                ? new Date(stats.last_visit).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })
                : '—'}
            </div>
          </div>
        </div>

        {/* Big progress bar */}
        <div className="mt-5 h-3 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Sub-stats */}
        <div className="mt-5 grid grid-cols-3 gap-4 text-center">
          <SubStat label="Complete"    value={completed}            color="text-emerald-600" />
          <SubStat label="In progress" value={stats?.in_progress ?? 0} color="text-amber-600" />
          <SubStat label="Untouched"   value={stats?.untouched ?? 0}   color="text-gray-400" />
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            Lamorinda Trail Network
            <span className="ml-2 text-xs text-gray-400 font-normal">
              colored by completion
            </span>
          </h2>
          <Link href="/map" className="text-sm text-green-600 hover:underline">
            Full map →
          </Link>
        </div>
        <TrailMap height="420px" colorMode="completion" />
      </div>

      {/* Two-column leaderboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Leaderboard
          title="Closest to finishing"
          empty="No trails in progress yet."
          loading={loading}
          trails={closeToFinish}
          accent="amber"
        />
        <Leaderboard
          title="Recently completed"
          empty="No completed trails yet — get out there!"
          loading={loading}
          trails={recentlyCompleted}
          accent="emerald"
          showDate
        />
      </div>
    </div>
  );
}

function SubStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

function Leaderboard({
  title,
  empty,
  loading,
  trails,
  accent,
  showDate,
}: {
  title: string;
  empty: string;
  loading: boolean;
  trails: DbTrail[];
  accent: 'amber' | 'emerald';
  showDate?: boolean;
}) {
  const barColor = accent === 'amber'
    ? 'from-amber-400 to-amber-600'
    : 'from-emerald-500 to-emerald-700';

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="divide-y divide-gray-50">
        {loading && (
          <div className="px-4 py-6 text-sm text-gray-400 text-center">Loading…</div>
        )}
        {!loading && trails.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-400 text-center">{empty}</div>
        )}
        {trails.map((t) => {
          const pct = (t.completion_pct ?? 0) * 100;
          return (
            <Link
              key={t.id}
              href={`/trails`}
              className="block px-4 py-3 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="text-sm font-medium text-gray-800 truncate flex-1">
                  {t.name}
                </div>
                <div className="text-xs font-semibold text-gray-500 tabular-nums">
                  {pct.toFixed(0)}%
                </div>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {showDate && t.last_visit && (
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(t.last_visit).toLocaleDateString()}
                </div>
              )}
              {t.area && !showDate && (
                <div className="text-xs text-gray-400 mt-1 truncate">{t.area}</div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
