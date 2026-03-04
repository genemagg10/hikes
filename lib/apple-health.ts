/**
 * Apple Health Export Parser
 *
 * Apple Health exports a zip file containing:
 *   - export.xml: All health records and workout metadata
 *   - workout-routes/*.gpx: GPS tracks for each workout
 *
 * To export from iPhone:
 *   Health app → Profile icon (top right) → Export All Health Data
 *
 * To automate via iOS Shortcuts (no manual export needed):
 *   Use the "Log Health" Shortcut action to POST workouts to /api/import
 */

import { Workout, ActivityType, GpxPoint } from './types';

const ACTIVITY_TYPE_MAP: Record<string, ActivityType> = {
  HKWorkoutActivityTypeHiking: 'hiking',
  HKWorkoutActivityTypeWalking: 'walking',
  HKWorkoutActivityTypeRunning: 'running',
  HKWorkoutActivityTypeCycling: 'cycling',
};

const SUPPORTED_TYPES = new Set(Object.keys(ACTIVITY_TYPE_MAP));

/** Parse Apple Health export.xml and return workouts */
export async function parseAppleHealthXml(xmlText: string): Promise<Workout[]> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const workoutEls = doc.querySelectorAll('Workout');
  const workouts: Workout[] = [];

  workoutEls.forEach((el) => {
    const rawType = el.getAttribute('workoutActivityType') ?? '';
    if (!SUPPORTED_TYPES.has(rawType)) return;

    const type: ActivityType = ACTIVITY_TYPE_MAP[rawType] ?? 'other';
    const startDate = el.getAttribute('startDate') ?? '';
    const endDate = el.getAttribute('endDate') ?? '';
    const durationMin = parseFloat(el.getAttribute('duration') ?? '0');
    const duration = Math.round(durationMin * 60);

    // Distance from WorkoutStatistics or top-level attribute
    let distance = 0;
    const distAttr = el.getAttribute('totalDistance');
    if (distAttr) {
      const unit = el.getAttribute('totalDistanceUnit') ?? 'km';
      distance = parseFloat(distAttr) * (unit === 'mi' ? 1609.34 : 1000);
    }
    // Check WorkoutStatistics for more precise distance
    const stats = el.querySelectorAll('WorkoutStatistics');
    stats.forEach((stat) => {
      const qty = stat.getAttribute('type');
      if (qty === 'HKQuantityTypeIdentifierDistanceWalkingRunning' ||
          qty === 'HKQuantityTypeIdentifierDistanceCycling') {
        const sum = stat.getAttribute('sum');
        const unit = stat.getAttribute('unit') ?? 'km';
        if (sum) {
          distance = parseFloat(sum) * (unit === 'mi' ? 1609.34 : 1000);
        }
      }
    });

    let calories: number | undefined;
    stats.forEach((stat) => {
      if (stat.getAttribute('type') === 'HKQuantityTypeIdentifierActiveEnergyBurned') {
        const sum = stat.getAttribute('sum');
        if (sum) calories = Math.round(parseFloat(sum));
      }
    });

    // Elevation from metadata
    let elevationAscended: number | undefined;
    let elevationDescended: number | undefined;
    const metaEntries = el.querySelectorAll('MetadataEntry');
    metaEntries.forEach((meta) => {
      const key = meta.getAttribute('key');
      const val = parseFloat(meta.getAttribute('value') ?? '0');
      if (key === 'HKElevationAscended') elevationAscended = val;
      if (key === 'HKElevationDescended') elevationDescended = val;
    });

    const id = `${startDate}-${rawType}`.replace(/[^a-zA-Z0-9-]/g, '-');

    workouts.push({
      id,
      type,
      startDate,
      endDate,
      duration,
      distance,
      calories,
      elevationAscended,
      elevationDescended,
    });
  });

  return workouts;
}

/** Parse a GPX file string and return an array of track points */
export function parseGpx(gpxText: string): GpxPoint[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxText, 'application/xml');
  const trkpts = doc.querySelectorAll('trkpt');
  const points: GpxPoint[] = [];

  trkpts.forEach((pt) => {
    const lat = parseFloat(pt.getAttribute('lat') ?? '0');
    const lon = parseFloat(pt.getAttribute('lon') ?? '0');
    const ele = pt.querySelector('ele')?.textContent;
    const time = pt.querySelector('time')?.textContent;
    points.push({
      lat,
      lon,
      ele: ele ? parseFloat(ele) : undefined,
      time: time ?? undefined,
    });
  });

  return points;
}

/**
 * Process an Apple Health export ZIP.
 * Returns workouts enriched with GPS routes where available.
 *
 * Usage: const workouts = await processAppleHealthZip(file);
 */
export async function processAppleHealthZip(
  file: File,
  onProgress?: (msg: string) => void
): Promise<Workout[]> {
  // Dynamically import JSZip to keep bundle lean
  const JSZip = (await import('jszip')).default;
  onProgress?.('Unzipping archive…');

  const zip = await JSZip.loadAsync(file);

  // Find export.xml
  const xmlFile = zip.file(/export\.xml/i)[0];
  if (!xmlFile) throw new Error('export.xml not found in zip. Is this an Apple Health export?');

  onProgress?.('Parsing workout records…');
  const xmlText = await xmlFile.async('string');
  const workouts = await parseAppleHealthXml(xmlText);
  onProgress?.(`Found ${workouts.length} workouts. Loading GPS routes…`);

  // Match GPX route files to workouts by start date
  const gpxFiles = zip.file(/workout-routes\/.*\.gpx$/i);
  const routeMap = new Map<string, GpxPoint[]>();

  await Promise.all(
    gpxFiles.map(async (gpxFile) => {
      try {
        const gpxText = await gpxFile.async('string');
        const points = parseGpx(gpxText);
        if (points.length > 0 && points[0].time) {
          // Key by date prefix of first track point
          const dateKey = points[0].time.slice(0, 10);
          routeMap.set(dateKey, points);
        }
      } catch {
        // Skip malformed GPX files
      }
    })
  );

  // Attach routes to workouts
  workouts.forEach((w) => {
    const dateKey = w.startDate.slice(0, 10);
    const route = routeMap.get(dateKey);
    if (route) w.route = route;
  });

  onProgress?.('Done!');
  return workouts;
}

/** Format meters into a readable distance string */
export function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  return `${miles.toFixed(2)} mi`;
}

/** Format seconds into h:mm:ss or m:ss */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}
