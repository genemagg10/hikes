export type ActivityType = 'hiking' | 'walking' | 'running' | 'cycling' | 'other';

export interface GpxPoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
}

export interface Workout {
  id: string;
  type: ActivityType;
  startDate: string; // ISO string
  endDate: string;
  duration: number; // seconds
  distance: number; // meters
  calories?: number;
  elevationAscended?: number; // meters
  elevationDescended?: number;
  trailName?: string;
  notes?: string;
  route?: GpxPoint[];
  matchedTrailIds?: string[];
}

export type TrailDifficulty = 'easy' | 'moderate' | 'hard';
export type TrailShape = 'loop' | 'out-and-back' | 'point-to-point';

export interface Trail {
  id: string;
  name: string;
  area: string;
  shape: TrailShape;
  difficulty: TrailDifficulty;
  distance: number; // meters approximate
  elevationGain?: number;
  description?: string;
  coordinates: [number, number][]; // [lng, lat] pairs
  tags?: string[];
}

export interface Stats {
  totalHikes: number;
  totalDistance: number; // meters
  totalDuration: number; // seconds
  totalElevation: number; // meters
  uniqueTrails: number;
  byType: Record<ActivityType, number>;
}
