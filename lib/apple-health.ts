/**
 * Apple Health Export Parser
 *
 * Apple Health exports a zip file containing:
 *   - export.xml: All health records and workout metadata
 *   - workout-routes/*.gpx: GPS tracks for each workout
 *
 * To export from iPhone:
 *   Health app → Profile icon (top right) → Export All Health Data
 */

import type JSZip from 'jszip';
import { Workout, ActivityType, GpxPoint } from './types';

/**
 * JSZip's `internalStream` is part of the runtime API but not in the
 * shipped type definitions. Narrow the bits we use.
 */
interface StreamingZipObject extends JSZip.JSZipObject {
  internalStream(type: 'string'): {
    on(event: 'data', cb: (chunk: string) => void): StreamHelper;
    on(event: 'error', cb: (err: Error) => void): StreamHelper;
    on(event: 'end', cb: () => void): StreamHelper;
    resume(): StreamHelper;
  };
}
interface StreamHelper {
  on(event: 'data', cb: (chunk: string) => void): StreamHelper;
  on(event: 'error', cb: (err: Error) => void): StreamHelper;
  on(event: 'end', cb: () => void): StreamHelper;
  resume(): StreamHelper;
}

const ACTIVITY_TYPE_MAP: Record<string, ActivityType> = {
  HKWorkoutActivityTypeHiking: 'hiking',
  HKWorkoutActivityTypeWalking: 'walking',
  HKWorkoutActivityTypeRunning: 'running',
  HKWorkoutActivityTypeCycling: 'cycling',
};

const SUPPORTED_TYPES = new Set(Object.keys(ACTIVITY_TYPE_MAP));

/** Parse a single <Workout>…</Workout> XML block into a Workout object. */
function parseWorkoutBlock(xmlBlock: string): Workout | null {
  const parser = new DOMParser();
  // Wrap in a root element so parseFromString accepts the fragment
  const doc = parser.parseFromString(`<r>${xmlBlock}</r>`, 'application/xml');
  const el = doc.querySelector('Workout');
  if (!el) return null;

  const rawType = el.getAttribute('workoutActivityType') ?? '';
  if (!SUPPORTED_TYPES.has(rawType)) return null;

  const type: ActivityType = ACTIVITY_TYPE_MAP[rawType] ?? 'other';
  const startDate = el.getAttribute('startDate') ?? '';
  const endDate = el.getAttribute('endDate') ?? '';
  const durationMin = parseFloat(el.getAttribute('duration') ?? '0');
  const duration = Math.round(durationMin * 60);

  let distance = 0;
  const distAttr = el.getAttribute('totalDistance');
  if (distAttr) {
    const unit = el.getAttribute('totalDistanceUnit') ?? 'km';
    distance = parseFloat(distAttr) * (unit === 'mi' ? 1609.34 : 1000);
  }

  const stats = el.querySelectorAll('WorkoutStatistics');
  stats.forEach((stat) => {
    const qty = stat.getAttribute('type');
    if (
      qty === 'HKQuantityTypeIdentifierDistanceWalkingRunning' ||
      qty === 'HKQuantityTypeIdentifierDistanceCycling'
    ) {
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

  let elevationAscended: number | undefined;
  let elevationDescended: number | undefined;
  el.querySelectorAll('MetadataEntry').forEach((meta) => {
    const key = meta.getAttribute('key');
    const val = parseFloat(meta.getAttribute('value') ?? '0');
    if (key === 'HKElevationAscended') elevationAscended = val;
    if (key === 'HKElevationDescended') elevationDescended = val;
  });

  const id = `${startDate}-${rawType}`.replace(/[^a-zA-Z0-9-]/g, '-');

  return {
    id,
    type,
    startDate,
    endDate,
    duration,
    distance,
    calories,
    elevationAscended,
    elevationDescended,
  };
}

/**
 * Stream export.xml from the zip, extracting complete <Workout> blocks
 * as they arrive. Avoids loading the full (often multi-GB) XML into
 * memory or building a full DOM tree.
 */
async function streamWorkouts(
  xmlFile: JSZip.JSZipObject,
  onProgress?: (msg: string) => void
): Promise<Workout[]> {
  const workouts: Workout[] = [];
  let buffer = '';
  let bytesRead = 0;
  let lastReport = 0;

  await new Promise<void>((resolve, reject) => {
    (xmlFile as StreamingZipObject)
      .internalStream('string')
      .on('data', (chunk: string) => {
        buffer += chunk;
        bytesRead += chunk.length;

        if (bytesRead - lastReport > 25_000_000) {
          onProgress?.(
            `Reading export.xml… ${(bytesRead / 1_000_000).toFixed(0)} MB scanned, ${workouts.length} workouts found`
          );
          lastReport = bytesRead;
        }

        let cursor = 0;
        while (true) {
          const open = buffer.indexOf('<Workout ', cursor);
          if (open === -1) break;

          const tagClose = buffer.indexOf('>', open);
          if (tagClose === -1) break; // wait for more data

          let block: string;
          let next: number;

          if (buffer[tagClose - 1] === '/') {
            // Self-closing <Workout … />
            block = buffer.slice(open, tagClose + 1);
            next = tagClose + 1;
          } else {
            // <Workout …>…</Workout>
            const close = buffer.indexOf('</Workout>', tagClose);
            if (close === -1) break; // wait for more data
            const endTag = '</Workout>'.length;
            block = buffer.slice(open, close + endTag);
            next = close + endTag;
          }

          const w = parseWorkoutBlock(block);
          if (w) workouts.push(w);
          cursor = next;
        }

        // Drop processed prefix; keep tail for the next chunk
        buffer = cursor > 0 ? buffer.slice(cursor) : buffer;
      })
      .on('error', reject)
      .on('end', resolve)
      .resume();
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
 */
export async function processAppleHealthZip(
  file: File,
  onProgress?: (msg: string) => void
): Promise<Workout[]> {
  const JSZipMod = (await import('jszip')).default;
  onProgress?.('Unzipping archive…');

  const zip = await JSZipMod.loadAsync(file);

  const xmlFile = zip.file(/export\.xml/i)[0];
  if (!xmlFile) throw new Error('export.xml not found in zip. Is this an Apple Health export?');

  onProgress?.('Scanning workouts…');
  const workouts = await streamWorkouts(xmlFile, onProgress);
  onProgress?.(`Found ${workouts.length} workouts. Loading GPS routes…`);

  // Match GPX route files to workouts by start date.
  // Process in small batches to keep memory usage bounded.
  const gpxFiles = zip.file(/workout-routes\/.*\.gpx$/i);
  const routeMap = new Map<string, GpxPoint[]>();
  const BATCH = 16;

  for (let i = 0; i < gpxFiles.length; i += BATCH) {
    const batch = gpxFiles.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (gpxFile) => {
        try {
          const gpxText = await gpxFile.async('string');
          const points = parseGpx(gpxText);
          if (points.length > 0 && points[0].time) {
            const dateKey = points[0].time.slice(0, 10);
            routeMap.set(dateKey, points);
          }
        } catch {
          // Skip malformed GPX files
        }
      })
    );
    onProgress?.(`Loading GPS routes… ${Math.min(i + BATCH, gpxFiles.length)}/${gpxFiles.length}`);
  }

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
