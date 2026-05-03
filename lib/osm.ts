/**
 * OpenStreetMap Overpass API — Lamorinda trail fetcher
 *
 * Fetches hiking/walking paths from OSM for the Lafayette-Moraga-Orinda area
 * and returns them as GeoJSON FeatureCollections ready to insert into Supabase.
 *
 * Bounding box covers: Lafayette, Moraga, Orinda + EBRPD lands immediately
 * surrounding the Lamorinda ZIP codes (94549, 94556, 94563).
 *   SW: 37.82°N, 122.22°W
 *   NE: 37.97°N, 122.02°W
 */

export interface OsmTrailFeature {
  id: string;          // "osm:way:12345" or "osm:rel:12345"
  name: string;
  area?: string;
  difficulty?: string;
  shape?: string;
  distance_m?: number;
  description?: string;
  tags: Record<string, string>;
  osm_id: number;
  osm_type: 'way' | 'relation';
  coordinates: [number, number][][]; // MultiLineString rings
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/** Bounding box for Lamorinda + surrounding EBRPD lands */
const BBOX = '37.82,-122.22,37.97,-122.02';

const OVERPASS_QUERY = `
[out:json][timeout:60];
(
  way["highway"="path"]["name"](${BBOX});
  way["highway"="footway"]["name"](${BBOX});
  way["highway"="track"]["name"](${BBOX});
  way["route"="hiking"](${BBOX});
  relation["route"="hiking"](${BBOX});
  relation["route"="foot"](${BBOX});
);
out body geom;
`.trim();

/** Infer difficulty from OSM sac_scale tag or trail name */
function inferDifficulty(tags: Record<string, string>): string {
  const sac = tags['sac_scale'];
  if (sac === 'hiking') return 'easy';
  if (sac === 'mountain_hiking') return 'moderate';
  if (sac === 'demanding_mountain_hiking' || sac === 'alpine_hiking') return 'hard';

  const name = (tags['name'] ?? '').toLowerCase();
  if (name.includes('peak') || name.includes('ridge') || name.includes('summit')) return 'moderate';
  return 'easy';
}

/** Infer loop/out-and-back from OSM route type */
function inferShape(tags: Record<string, string>): string {
  const name = (tags['name'] ?? '').toLowerCase();
  if (name.includes('loop')) return 'loop';
  if (name.includes('trail') && !name.includes('loop')) return 'out-and-back';
  return 'out-and-back';
}

/** Map EBRPD park names from OSM operator tag */
function inferArea(tags: Record<string, string>): string | undefined {
  return tags['operator'] ?? tags['network'] ?? tags['park:name'] ?? undefined;
}

/** Approximate length of a linestring in meters (Haversine) */
function lineLength(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseWay(el: any): OsmTrailFeature | null {
  if (!el.geometry || el.geometry.length < 2) return null;
  const name = el.tags?.name;
  if (!name) return null;

  const coords: [number, number][] = el.geometry.map(
    (pt: { lat: number; lon: number }) => [pt.lon, pt.lat]
  );
  const tags: Record<string, string> = el.tags ?? {};

  return {
    id: `osm:way:${el.id}`,
    name,
    area: inferArea(tags),
    difficulty: inferDifficulty(tags),
    shape: inferShape(tags),
    distance_m: lineLength(coords),
    tags,
    osm_id: el.id,
    osm_type: 'way',
    coordinates: [coords],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRelation(el: any): OsmTrailFeature | null {
  const name = el.tags?.name;
  if (!name) return null;

  const rings: [number, number][][] = [];
  let totalLength = 0;

  for (const member of el.members ?? []) {
    if (member.type === 'way' && member.geometry?.length >= 2) {
      const coords: [number, number][] = member.geometry.map(
        (pt: { lat: number; lon: number }) => [pt.lon, pt.lat]
      );
      rings.push(coords);
      totalLength += lineLength(coords);
    }
  }

  if (rings.length === 0) return null;

  const tags: Record<string, string> = el.tags ?? {};

  return {
    id: `osm:rel:${el.id}`,
    name,
    area: inferArea(tags),
    difficulty: inferDifficulty(tags),
    shape: inferShape(tags),
    distance_m: totalLength,
    tags,
    osm_id: el.id,
    osm_type: 'relation',
    coordinates: rings,
  };
}

/**
 * Fetch trail data from the Overpass API.
 * Returns parsed trail features ready for Supabase insertion.
 *
 * Call this from a Next.js API route (server-side only) because
 * the Overpass API may block browser requests.
 */
export async function fetchLamorindaTrails(): Promise<OsmTrailFeature[]> {
  const resp = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'HikeTrack/1.0 (+https://github.com/genemagg10/hikes)',
    },
    body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
    cache: 'no-store',
  });

  if (!resp.ok) {
    throw new Error(`Overpass API error: ${resp.status} ${resp.statusText}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: { elements: any[] } = await resp.json();

  const features: OsmTrailFeature[] = [];
  const seen = new Set<string>();

  for (const el of json.elements) {
    let feature: OsmTrailFeature | null = null;

    if (el.type === 'way') {
      feature = parseWay(el);
    } else if (el.type === 'relation') {
      feature = parseRelation(el);
    }

    if (feature && !seen.has(feature.id)) {
      seen.add(feature.id);
      features.push(feature);
    }
  }

  return features;
}

/** Build a Supabase-ready WKT MultiLineString from OSM coordinates */
export function coordsToWkt(rings: [number, number][][]): string {
  const ringStrs = rings.map(
    (ring) => `(${ring.map(([lng, lat]) => `${lng} ${lat}`).join(',')})`
  );
  return `MULTILINESTRING(${ringStrs.join(',')})`;
}
