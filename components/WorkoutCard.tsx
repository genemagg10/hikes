'use client';

import { Workout } from '@/lib/types';
import { formatDistance, formatDuration } from '@/lib/apple-health';
import { Mountain, PersonStanding, Zap, Bike, MapPin, TrendingUp } from 'lucide-react';

const TYPE_META = {
  hiking: { icon: Mountain, color: 'text-green-600', bg: 'bg-green-50', label: 'Hike' },
  walking: { icon: PersonStanding, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Walk' },
  running: { icon: Zap, color: 'text-red-600', bg: 'bg-red-50', label: 'Run' },
  cycling: { icon: Bike, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Ride' },
  other: { icon: MapPin, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Activity' },
};

interface WorkoutCardProps {
  workout: Workout;
  selected?: boolean;
  onClick?: () => void;
}

export default function WorkoutCard({ workout, selected, onClick }: WorkoutCardProps) {
  const meta = TYPE_META[workout.type] ?? TYPE_META.other;
  const Icon = meta.icon;
  const date = new Date(workout.startDate);
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border transition-all p-4 ${
        selected
          ? 'border-green-500 bg-green-50 shadow-md'
          : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`${meta.bg} ${meta.color} p-2 rounded-lg flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-gray-900 truncate">
              {workout.trailName ?? meta.label}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.color} flex-shrink-0`}>
              {meta.label}
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{dateStr}</div>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
            <span className="font-medium">{formatDistance(workout.distance)}</span>
            <span className="text-gray-300">·</span>
            <span>{formatDuration(workout.duration)}</span>
            {workout.elevationAscended && workout.elevationAscended > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="flex items-center gap-0.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {Math.round(workout.elevationAscended * 3.281)}ft
                </span>
              </>
            )}
          </div>
          {workout.notes && (
            <p className="text-xs text-gray-400 mt-1 truncate">{workout.notes}</p>
          )}
        </div>
      </div>
    </button>
  );
}
