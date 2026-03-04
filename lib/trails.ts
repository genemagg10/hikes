/**
 * Lafayette / East Bay Regional Park Trail Data
 *
 * Trails are stored as arrays of [lng, lat] coordinate pairs.
 * Coordinates are approximate and suitable for display; import your actual
 * GPX tracks from Apple Health for precise route overlays.
 *
 * Sources:
 *  - East Bay Regional Park District (ebparks.org)
 *  - OpenStreetMap contributors
 *  - Lafayette city trail maps
 */

import { Trail } from './types';

export const TRAILS: Trail[] = [
  // ─── Lafayette Reservoir ───────────────────────────────────────────────────
  {
    id: 'lafayette-reservoir-loop',
    name: 'Lafayette Reservoir Loop',
    area: 'Lafayette Reservoir Recreation Area',
    shape: 'loop',
    difficulty: 'easy',
    distance: 4345, // ~2.7 miles
    elevationGain: 110,
    description:
      'Paved loop around the reservoir with panoramic East Bay views. Dogs allowed on leash. Stroller-friendly.',
    tags: ['reservoir', 'paved', 'dogs-ok', 'family'],
    coordinates: [
      [-122.1105, 37.882],
      [-122.1085, 37.8832],
      [-122.1068, 37.8851],
      [-122.1062, 37.8875],
      [-122.1071, 37.8896],
      [-122.1095, 37.8912],
      [-122.1122, 37.8918],
      [-122.1145, 37.8908],
      [-122.1158, 37.8888],
      [-122.1152, 37.8862],
      [-122.1135, 37.8840],
      [-122.1118, 37.8825],
      [-122.1105, 37.882],
    ],
  },
  {
    id: 'reservoir-upper-trail',
    name: 'Upper Trail (Reservoir)',
    area: 'Lafayette Reservoir Recreation Area',
    shape: 'loop',
    difficulty: 'moderate',
    distance: 3218, // ~2 miles
    elevationGain: 210,
    description:
      'Dirt trail above the reservoir with shade and ridge views. Connects to the main loop at multiple points.',
    tags: ['dirt', 'shade', 'views'],
    coordinates: [
      [-122.1105, 37.882],
      [-122.109, 37.884],
      [-122.108, 37.8865],
      [-122.107, 37.889],
      [-122.109, 37.8915],
      [-122.112, 37.8925],
      [-122.115, 37.8918],
      [-122.117, 37.89],
      [-122.1165, 37.887],
      [-122.114, 37.8845],
      [-122.1118, 37.8825],
      [-122.1105, 37.882],
    ],
  },

  // ─── Lafayette-Moraga Regional Trail ──────────────────────────────────────
  {
    id: 'lafayette-moraga-trail',
    name: 'Lafayette-Moraga Regional Trail',
    area: 'East Bay Regional Parks',
    shape: 'point-to-point',
    difficulty: 'easy',
    distance: 11265, // ~7 miles
    elevationGain: 120,
    description:
      'Mostly paved multi-use trail following a former railroad corridor through Lafayette and Moraga. Popular with cyclists, runners, and walkers. Key access points at Olympic Blvd, St. Mary\'s Rd, and Moraga Commons.',
    tags: ['paved', 'multi-use', 'bikes-ok', 'dogs-ok', 'railroad'],
    coordinates: [
      [-122.1292, 37.8931], // near Olympic/Mt Diablo Blvd
      [-122.1265, 37.891],
      [-122.124, 37.888],
      [-122.1212, 37.885],
      [-122.1185, 37.882],
      [-122.1162, 37.879],
      [-122.1138, 37.876],
      [-122.1112, 37.873],
      [-122.1088, 37.870],
      [-122.1062, 37.867],
      [-122.1035, 37.864],
      [-122.1008, 37.860],
      [-122.098, 37.856],
      [-122.0952, 37.852],
      [-122.0925, 37.848], // Moraga Commons
    ],
  },

  // ─── Briones Regional Park ────────────────────────────────────────────────
  {
    id: 'briones-peak-trail',
    name: 'Briones Peak Trail',
    area: 'Briones Regional Park',
    shape: 'out-and-back',
    difficulty: 'moderate',
    distance: 6437, // ~4 miles
    elevationGain: 385,
    description:
      'Climbs to Briones Peak (1,483 ft) with 360° views of the Bay Area. Access via Bear Creek Rd trailhead.',
    tags: ['summit', 'views', 'dogs-ok', 'dirt'],
    coordinates: [
      [-122.1272, 37.9168], // Bear Creek Rd trailhead
      [-122.1245, 37.9150],
      [-122.1218, 37.9130],
      [-122.1195, 37.9108],
      [-122.1175, 37.9082],
      [-122.1158, 37.9055],
      [-122.1145, 37.9025],
      [-122.1135, 37.8992],
      [-122.1128, 37.8965], // Briones Peak
    ],
  },
  {
    id: 'briones-crest-loop',
    name: 'Briones Crest Loop',
    area: 'Briones Regional Park',
    shape: 'loop',
    difficulty: 'moderate',
    distance: 9656, // ~6 miles
    elevationGain: 455,
    description:
      'Long ridge loop taking in Briones Peak, Bear Creek, and rolling oak savanna. Best in spring for wildflowers.',
    tags: ['loop', 'ridge', 'wildflowers', 'dogs-ok'],
    coordinates: [
      [-122.1272, 37.9168],
      [-122.1245, 37.9150],
      [-122.1218, 37.9130],
      [-122.1195, 37.9108],
      [-122.1128, 37.8965],
      [-122.115, 37.8942],
      [-122.1175, 37.8920],
      [-122.1205, 37.8938],
      [-122.1232, 37.8962],
      [-122.1255, 37.8985],
      [-122.1268, 37.9012],
      [-122.1275, 37.9045],
      [-122.1278, 37.908],
      [-122.1272, 37.9168],
    ],
  },
  {
    id: 'briones-homestead-loop',
    name: 'Homestead Valley Loop',
    area: 'Briones Regional Park',
    shape: 'loop',
    difficulty: 'easy',
    distance: 5632, // ~3.5 miles
    elevationGain: 195,
    description:
      'Gentle valley loop through oak woodlands and grasslands. Great introductory Briones hike.',
    tags: ['loop', 'oaks', 'easy', 'dogs-ok'],
    coordinates: [
      [-122.1325, 37.9215],
      [-122.13, 37.9198],
      [-122.1278, 37.9182],
      [-122.125, 37.9165],
      [-122.1228, 37.9148],
      [-122.1215, 37.917],
      [-122.1225, 37.9195],
      [-122.1248, 37.9212],
      [-122.1272, 37.9225],
      [-122.1298, 37.9232],
      [-122.1325, 37.9215],
    ],
  },

  // ─── Diablo Foothills / Shell Ridge ───────────────────────────────────────
  {
    id: 'shell-ridge-loop',
    name: 'Shell Ridge Loop',
    area: 'Shell Ridge Open Space',
    shape: 'loop',
    difficulty: 'moderate',
    distance: 8047, // ~5 miles
    elevationGain: 330,
    description:
      'Walnut Creek open space with grassland ridges and views toward Mt. Diablo. Access from Borgs Ranch on Castle Rock Rd.',
    tags: ['loop', 'views', 'grassland', 'dogs-ok'],
    coordinates: [
      [-122.0668, 37.903],
      [-122.0645, 37.9015],
      [-122.0622, 37.8998],
      [-122.0608, 37.8975],
      [-122.0618, 37.895],
      [-122.064, 37.893],
      [-122.0668, 37.8918],
      [-122.0692, 37.8932],
      [-122.0712, 37.895],
      [-122.0718, 37.898],
      [-122.0705, 37.9008],
      [-122.0685, 37.9025],
      [-122.0668, 37.903],
    ],
  },

  // ─── Las Trampas Wilderness ────────────────────────────────────────────────
  {
    id: 'las-trampas-ridge',
    name: 'Las Trampas Ridge Trail',
    area: 'Las Trampas Regional Wilderness',
    shape: 'out-and-back',
    difficulty: 'hard',
    distance: 10058, // ~6.25 miles
    elevationGain: 580,
    description:
      'Strenuous ridge hike through Las Trampas Regional Wilderness with sweeping Bay views. Rocky limestone outcroppings and dramatic ridgeline.',
    tags: ['ridge', 'views', 'strenuous', 'limestone', 'dogs-ok'],
    coordinates: [
      [-121.9998, 37.8412],
      [-121.9978, 37.843],
      [-121.9958, 37.845],
      [-121.9935, 37.847],
      [-121.9912, 37.849],
      [-121.9888, 37.851],
      [-121.9862, 37.8528],
      [-121.984, 37.8548],
      [-121.982, 37.857], // Ridge high point
    ],
  },

  // ─── Tilden Regional Park ──────────────────────────────────────────────────
  {
    id: 'tilden-jewel-lake',
    name: 'Jewel Lake Loop',
    area: 'Tilden Regional Park',
    shape: 'loop',
    difficulty: 'easy',
    distance: 2414, // ~1.5 miles
    elevationGain: 55,
    description:
      'Easy stroll around serene Jewel Lake in Tilden\'s Botanic Garden area. Great for birding.',
    tags: ['lake', 'nature', 'easy', 'birding'],
    coordinates: [
      [-122.2478, 37.9045],
      [-122.246, 37.9058],
      [-122.2445, 37.9068],
      [-122.2438, 37.9082],
      [-122.2445, 37.9095],
      [-122.2462, 37.9102],
      [-122.248, 37.9098],
      [-122.2492, 37.9085],
      [-122.249, 37.9068],
      [-122.2478, 37.9045],
    ],
  },
  {
    id: 'tilden-meadows-loop',
    name: 'Tilden Meadows & Inspiration Point',
    area: 'Tilden Regional Park',
    shape: 'loop',
    difficulty: 'moderate',
    distance: 7242, // ~4.5 miles
    elevationGain: 280,
    description:
      'Popular Tilden loop from Inspiration Point through open meadows and eucalyptus groves, with views of the Bay.',
    tags: ['views', 'meadows', 'dogs-ok', 'horses-ok'],
    coordinates: [
      [-122.2385, 37.9068], // Inspiration Point
      [-122.2362, 37.9052],
      [-122.234, 37.9038],
      [-122.2318, 37.9025],
      [-122.2302, 37.9045],
      [-122.2312, 37.9068],
      [-122.2332, 37.9088],
      [-122.2355, 37.9102],
      [-122.238, 37.9095],
      [-122.2385, 37.9068],
    ],
  },

  // ─── Local Lafayette Neighborhood Trails ──────────────────────────────────
  {
    id: 'happy-valley-loop',
    name: 'Happy Valley Loop',
    area: 'Lafayette',
    shape: 'loop',
    difficulty: 'easy',
    distance: 3700,
    elevationGain: 90,
    description:
      'Quiet neighborhood loop through Happy Valley. Good warm-up or cool-down run/walk.',
    tags: ['neighborhood', 'paved', 'easy'],
    coordinates: [
      [-122.1235, 37.898],
      [-122.121, 37.8968],
      [-122.1188, 37.895],
      [-122.1178, 37.897],
      [-122.1192, 37.899],
      [-122.1215, 37.9005],
      [-122.1235, 37.898],
    ],
  },
  {
    id: 'deer-hill-trail',
    name: 'Deer Hill Road Trail',
    area: 'Lafayette',
    shape: 'out-and-back',
    difficulty: 'moderate',
    distance: 5632,
    elevationGain: 245,
    description:
      'Dirt fire road climbing above Lafayette with city and ridge views. Connects to Briones at the top.',
    tags: ['fire-road', 'views', 'connection-to-briones'],
    coordinates: [
      [-122.1138, 37.8908],
      [-122.1152, 37.8928],
      [-122.1165, 37.8952],
      [-122.1175, 37.898],
      [-122.118, 37.9012],
      [-122.1188, 37.9042],
      [-122.1195, 37.9072],
      [-122.1202, 37.91],
    ],
  },
];

/** Look up a trail by ID */
export function getTrailById(id: string): Trail | undefined {
  return TRAILS.find((t) => t.id === id);
}

/** Filter trails by area */
export function getTrailsByArea(area: string): Trail[] {
  return TRAILS.filter((t) => t.area.toLowerCase().includes(area.toLowerCase()));
}

/** Get all unique areas */
export function getAreas(): string[] {
  return [...new Set(TRAILS.map((t) => t.area))].sort();
}

/**
 * Simple route-to-trail matching: find trails whose coordinates are near
 * the given GPS track. Returns trail IDs sorted by proximity score.
 */
export function matchTrailsToRoute(
  route: { lat: number; lon: number }[],
  thresholdMeters = 80
): string[] {
  if (route.length === 0) return [];

  const threshDeg = thresholdMeters / 111320; // rough degrees per meter

  const scored = TRAILS.map((trail) => {
    let matches = 0;
    for (const pt of route) {
      for (const [lng, lat] of trail.coordinates) {
        const dlat = Math.abs(pt.lat - lat);
        const dlng = Math.abs(pt.lon - lng);
        if (dlat < threshDeg && dlng < threshDeg) {
          matches++;
          break; // count each route point at most once
        }
      }
    }
    const score = matches / route.length;
    return { id: trail.id, score };
  });

  return scored
    .filter((s) => s.score > 0.1) // at least 10% of route points match
    .sort((a, b) => b.score - a.score)
    .map((s) => s.id);
}
