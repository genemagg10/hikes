'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Workout } from '@/lib/types';
import { loadWorkouts, computeStats } from '@/lib/store';
import { formatDistance, formatDuration } from '@/lib/apple-health';
import StatCard from '@/components/StatCard';
import WorkoutCard from '@/components/WorkoutCard';

const HikeMap = dynamic(() => import('@/components/HikeMap'), { ssr: false });

export default function Dashboard() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => {
    const data = loadWorkouts();
    setWorkouts(data.sort((a, b) => (a.startDate > b.startDate ? -1 : 1)));
  }, []);

  const stats = computeStats(workouts);
  const recent = workouts.slice(0, 5);

  const totalMiles = (stats.totalDistance / 1609.34).toFixed(1);
  const totalHours = (stats.totalDuration / 3600).toFixed(1);
  const totalFeet = Math.round(stats.totalElevation * 3.281).toLocaleString();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Lafayette &amp; East Bay trails — 94549
          </p>
        </div>
        <Link
          href="/import"
          className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          Import Apple Health
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="🥾" label="Total activities" value={stats.totalHikes.toString()} />
        <StatCard icon="📍" label="Total miles" value={`${totalMiles} mi`} />
        <StatCard icon="⏱" label="Total time" value={`${totalHours}h`} />
        <StatCard icon="⛰" label="Elevation gained" value={`${totalFeet}ft`} />
      </div>

      {/* Activity breakdown */}
      {stats.totalHikes > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">Activity breakdown</h2>
          <div className="flex flex-wrap gap-3">
            {(
              [
                ['hiking', '🥾', 'green'],
                ['walking', '🚶', 'blue'],
                ['running', '🏃', 'red'],
                ['cycling', '🚴', 'amber'],
              ] as const
            ).map(([type, emoji]) => {
              const count = stats.byType[type] ?? 0;
              if (count === 0) return null;
              return (
                <Link
                  key={type}
                  href={`/hikes?type=${type}`}
                  className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors"
                >
                  <span>{emoji}</span>
                  <span className="font-semibold text-gray-800">{count}</span>
                  <span className="text-gray-500 capitalize text-sm">{type}s</span>
                </Link>
              );
            })}
            {stats.uniqueTrails > 0 && (
              <Link
                href="/trails"
                className="flex items-center gap-2 bg-green-50 hover:bg-green-100 rounded-lg px-3 py-2 transition-colors"
              >
                <span>🗺️</span>
                <span className="font-semibold text-gray-800">{stats.uniqueTrails}</span>
                <span className="text-gray-500 text-sm">unique trails</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Map + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Lafayette &amp; East Bay Trails</h2>
              <Link href="/map" className="text-sm text-green-600 hover:underline">
                Full map →
              </Link>
            </div>
            <HikeMap
              workouts={workouts}
              selectedWorkoutId={selectedId}
              onWorkoutClick={setSelectedId}
              height="380px"
              showAllTrails
            />
          </div>
        </div>

        {/* Recent activity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Recent activity</h2>
            <Link href="/hikes" className="text-sm text-green-600 hover:underline">
              View all →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
              <p className="text-gray-400 text-sm mb-3">No activities yet.</p>
              <Link
                href="/import"
                className="text-green-600 text-sm font-medium hover:underline"
              >
                Import from Apple Health →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((w) => (
                <WorkoutCard
                  key={w.id}
                  workout={w}
                  selected={w.id === selectedId}
                  onClick={() => setSelectedId(w.id === selectedId ? undefined : w.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
