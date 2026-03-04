'use client';

/**
 * TrailMap — Mapbox GL JS map with:
 *
 *  ZOOM-LEVEL STRATEGY
 *  ───────────────────
 *  z < 10  : faint trail corridors (1px), no labels             ← city-wide
 *  z 10-12 : medium weight lines + trail name labels at midpoint ← neighborhood
 *  z 12-14 : full-weight lines + popup on hover + topo base      ← trail level
 *  z > 14  : individual GPS tracks + elevation tints             ← on-trail
 *
 *  LAYERS (bottom → top)
 *  ─────────────────────
 *  1. Mapbox Outdoors base style (has trails, topo, terrain)
 *  2. trails-fill       — wide transparent click target
 *  3. trails-line       — colored by difficulty, weight by zoom
 *  4. trails-labels     — trail name symbols, appear at z ≥ 12
 *  5. workouts-line     — your GPS tracks, colored by activity type
 *  6. workouts-selected — highlighted selected workout (thicker)
 *  7. workout-dots      — start-point markers at z ≥ 12
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { DbTrail, DbWorkout } from '@/lib/supabase';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// ── Color constants ────────────────────────────────────────────────────────

const DIFFICULTY_COLOR: Record<string, string> = {
  easy:     '#22c55e',
  moderate: '#f59e0b',
  hard:     '#ef4444',
};

const ACTIVITY_COLOR: Record<string, string> = {
  hiking:  '#16a34a',
  walking: '#2563eb',
  running: '#dc2626',
  cycling: '#d97706',
  other:   '#6b7280',
};

// Default center: Lafayette, CA
const DEFAULT_CENTER: [number, number] = [-122.1235, 37.893];
const DEFAULT_ZOOM = 12;

// ── Props ──────────────────────────────────────────────────────────────────

interface TrailMapProps {
  trails?: DbTrail[];
  workouts?: DbWorkout[];
  selectedWorkoutId?: string;
  highlightTrailId?: string;
  onWorkoutClick?: (id: string) => void;
  onTrailClick?: (id: string) => void;
  height?: string;
  style?: 'outdoors' | 'satellite-streets' | 'streets';
}

// ── GeoJSON builders ───────────────────────────────────────────────────────

function trailsToGeoJSON(trails: DbTrail[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: trails
      .filter((t) => t.geometry)
      .map((t) => ({
        type: 'Feature',
        id: t.id,
        geometry: t.geometry!,
        properties: {
          id:         t.id,
          name:       t.name,
          area:       t.area ?? '',
          difficulty: t.difficulty ?? 'easy',
          shape:      t.shape ?? 'out-and-back',
          distance_m: t.distance_m ?? 0,
          elevation_m: t.elevation_gain_m ?? 0,
        },
      })),
  };
}

function workoutsToGeoJSON(workouts: DbWorkout[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: workouts
      .filter((w) => w.route_geojson)
      .map((w) => ({
        type: 'Feature',
        id: w.id,
        geometry: w.route_geojson!,
        properties: {
          id:         w.id,
          type:       w.type,
          trail_name: w.trail_name ?? '',
          distance_m: w.distance_m,
          duration_s: w.duration_seconds,
          start_date: w.start_date,
          elevation_m: w.elevation_ascended_m ?? 0,
        },
      })),
  };
}

function workoutDotsGeoJSON(workouts: DbWorkout[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: workouts
      .filter((w) => w.route_geojson?.coordinates?.length)
      .map((w) => {
        const coords = w.route_geojson!.coordinates as [number, number][];
        return {
          type: 'Feature' as const,
          id: w.id,
          geometry: { type: 'Point' as const, coordinates: coords[0] },
          properties: {
            id:   w.id,
            type: w.type,
            name: w.trail_name ?? w.type,
            date: new Date(w.start_date).toLocaleDateString(),
            dist: (w.distance_m / 1609.34).toFixed(2) + ' mi',
            dur:  Math.round(w.duration_seconds / 60) + ' min',
          },
        };
      }),
  };
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TrailMap({
  trails = [],
  workouts = [],
  selectedWorkoutId,
  highlightTrailId,
  onWorkoutClick,
  onTrailClick,
  height = '500px',
  style = 'outdoors',
}: TrailMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const popupRef     = useRef<mapboxgl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapStyle, setMapStyle] = useState(style);

  // ── Initialize map ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: `mapbox://styles/mapbox/${mapStyle}-v12`,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitchWithRotate: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-left');
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      'top-right'
    );

    map.on('load', () => {
      addSources(map);
      addLayers(map);
      attachInteractions(map);
      setMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update map style ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.setStyle(`mapbox://styles/mapbox/${mapStyle}-v12`);
    map.once('style.load', () => {
      addSources(map);
      addLayers(map);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle]);

  // ── Update trail data ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource('trails') as mapboxgl.GeoJSONSource | undefined;
    src?.setData(trailsToGeoJSON(trails));
  }, [trails, mapLoaded]);

  // ── Update workout data ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    (map.getSource('workouts') as mapboxgl.GeoJSONSource | undefined)
      ?.setData(workoutsToGeoJSON(workouts));
    (map.getSource('workout-dots') as mapboxgl.GeoJSONSource | undefined)
      ?.setData(workoutDotsGeoJSON(workouts));
  }, [workouts, mapLoaded]);

  // ── Highlight selected workout ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.setFilter('workouts-selected',
      selectedWorkoutId
        ? ['==', ['get', 'id'], selectedWorkoutId]
        : ['==', 'true', 'false']
    );
  }, [selectedWorkoutId, mapLoaded]);

  // ── Highlight selected trail ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.setPaintProperty('trails-line', 'line-color', [
      'case',
      ['==', ['get', 'id'], highlightTrailId ?? ''],
      '#f97316',
      ['match', ['get', 'difficulty'],
        'easy',     DIFFICULTY_COLOR.easy,
        'moderate', DIFFICULTY_COLOR.moderate,
        'hard',     DIFFICULTY_COLOR.hard,
        '#6b7280'
      ],
    ]);
    map.setPaintProperty('trails-line', 'line-width', [
      'interpolate', ['linear'], ['zoom'],
      10, ['case', ['==', ['get', 'id'], highlightTrailId ?? ''], 3, 1],
      13, ['case', ['==', ['get', 'id'], highlightTrailId ?? ''], 6, 3],
      16, ['case', ['==', ['get', 'id'], highlightTrailId ?? ''], 8, 4],
    ]);
  }, [highlightTrailId, mapLoaded]);

  // ── Source / Layer setup ────────────────────────────────────────────────

  const addSources = useCallback((map: mapboxgl.Map) => {
    if (!map.getSource('trails')) {
      map.addSource('trails', {
        type: 'geojson',
        data: trailsToGeoJSON(trails),
        generateId: false,
      });
    }
    if (!map.getSource('workouts')) {
      map.addSource('workouts', {
        type: 'geojson',
        data: workoutsToGeoJSON(workouts),
      });
    }
    if (!map.getSource('workout-dots')) {
      map.addSource('workout-dots', {
        type: 'geojson',
        data: workoutDotsGeoJSON(workouts),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLayers = useCallback((map: mapboxgl.Map) => {
    // ── Trail hit target (wide transparent line for easy clicking) ──────
    if (!map.getLayer('trails-fill')) {
      map.addLayer({
        id: 'trails-fill',
        type: 'line',
        source: 'trails',
        paint: {
          'line-width': 16,
          'line-color': 'transparent',
        },
      });
    }

    // ── Trail lines ──────────────────────────────────────────────────────
    if (!map.getLayer('trails-line')) {
      map.addLayer({
        id: 'trails-line',
        type: 'line',
        source: 'trails',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': [
            'match', ['get', 'difficulty'],
            'easy',     DIFFICULTY_COLOR.easy,
            'moderate', DIFFICULTY_COLOR.moderate,
            'hard',     DIFFICULTY_COLOR.hard,
            '#6b7280',
          ],
          // Weight increases with zoom
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            9, 0.8,
            12, 2.5,
            14, 4,
            17, 6,
          ],
          'line-opacity': [
            'interpolate', ['linear'], ['zoom'],
            9, 0.5,
            12, 0.85,
            16, 1,
          ],
          // Out-and-back trails get a dash
          'line-dasharray': [
            'match', ['get', 'shape'],
            'out-and-back', ['literal', [4, 2]],
            ['literal', [1]],
          ],
        },
      });
    }

    // ── Trail name labels (appear at zoom ≥ 12) ─────────────────────────
    if (!map.getLayer('trails-labels')) {
      map.addLayer({
        id: 'trails-labels',
        type: 'symbol',
        source: 'trails',
        minzoom: 12,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 15, 13],
          'text-max-angle': 30,
          'text-offset': [0, -0.5],
          'symbol-spacing': 300,
        },
        paint: {
          'text-color': '#1a1a1a',
          'text-halo-color': 'rgba(255,255,255,0.9)',
          'text-halo-width': 2,
        },
      });
    }

    // ── Workout GPS tracks ───────────────────────────────────────────────
    if (!map.getLayer('workouts-line')) {
      map.addLayer({
        id: 'workouts-line',
        type: 'line',
        source: 'workouts',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': [
            'match', ['get', 'type'],
            'hiking',  ACTIVITY_COLOR.hiking,
            'walking', ACTIVITY_COLOR.walking,
            'running', ACTIVITY_COLOR.running,
            'cycling', ACTIVITY_COLOR.cycling,
            ACTIVITY_COLOR.other,
          ],
          'line-width': 2.5,
          'line-opacity': 0.75,
        },
      });
    }

    // ── Selected workout (drawn on top, thicker) ─────────────────────────
    if (!map.getLayer('workouts-selected')) {
      map.addLayer({
        id: 'workouts-selected',
        type: 'line',
        source: 'workouts',
        filter: ['==', 'true', 'false'],  // hidden by default
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': [
            'match', ['get', 'type'],
            'hiking',  ACTIVITY_COLOR.hiking,
            'walking', ACTIVITY_COLOR.walking,
            'running', ACTIVITY_COLOR.running,
            'cycling', ACTIVITY_COLOR.cycling,
            ACTIVITY_COLOR.other,
          ],
          'line-width': 5,
          'line-opacity': 1,
          'line-gap-width': 0,
        },
      });
    }

    // ── Start-point dots (appear at zoom ≥ 12) ───────────────────────────
    if (!map.getLayer('workout-dots')) {
      map.addLayer({
        id: 'workout-dots',
        type: 'circle',
        source: 'workout-dots',
        minzoom: 11,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 15, 8],
          'circle-color': [
            'match', ['get', 'type'],
            'hiking',  ACTIVITY_COLOR.hiking,
            'walking', ACTIVITY_COLOR.walking,
            'running', ACTIVITY_COLOR.running,
            'cycling', ACTIVITY_COLOR.cycling,
            ACTIVITY_COLOR.other,
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.9,
        },
      });
    }
  }, []);

  // ── Interactions ────────────────────────────────────────────────────────

  const attachInteractions = useCallback((map: mapboxgl.Map) => {
    // Cursor change on hover
    for (const layer of ['trails-fill', 'workout-dots', 'workouts-line']) {
      map.on('mouseenter', layer, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // Trail popup on hover
    map.on('mousemove', 'trails-fill', (e) => {
      if (!e.features?.length) return;
      const props = e.features[0].properties ?? {};
      const mi = props.distance_m ? (props.distance_m / 1609.34).toFixed(1) : '?';
      const elev = props.elevation_m ? `+${Math.round(props.elevation_m * 3.281)}ft` : '';
      const html = `
        <div class="trail-popup">
          <strong>${props.name}</strong>
          <div class="trail-popup-sub">${props.area ?? ''}</div>
          <div class="trail-popup-stats">
            ${mi} mi &nbsp;·&nbsp; ${props.difficulty ?? ''}${elev ? ` &nbsp;·&nbsp; ${elev}` : ''}
            ${props.shape === 'loop' ? '&nbsp;·&nbsp; 🔄 loop' : props.shape === 'out-and-back' ? '&nbsp;·&nbsp; ↔ out-and-back' : ''}
          </div>
        </div>`;

      if (!popupRef.current) {
        popupRef.current = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          maxWidth: '220px',
          className: 'trail-popup-wrapper',
          offset: 6,
        });
      }
      popupRef.current.setLngLat(e.lngLat).setHTML(html).addTo(map);
    });

    map.on('mouseleave', 'trails-fill', () => {
      popupRef.current?.remove();
    });

    // Trail click
    map.on('click', 'trails-fill', (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (id) onTrailClick?.(id);
    });

    // Workout dot popup + click
    map.on('click', 'workout-dots', (e) => {
      const props = e.features?.[0]?.properties ?? {};
      if (!props.id) return;
      onWorkoutClick?.(props.id);

      new mapboxgl.Popup({ maxWidth: '200px' })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="workout-popup">
            <strong>${props.name}</strong>
            <div>${props.date}</div>
            <div>${props.dist} &nbsp;·&nbsp; ${props.dur}</div>
          </div>`)
        .addTo(map);
    });

    // Workout line click
    map.on('click', 'workouts-line', (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (id) onWorkoutClick?.(id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTrailClick, onWorkoutClick]);

  return (
    <div className="relative" style={{ height }}>
      <div ref={containerRef} className="w-full h-full rounded-xl" />

      {/* Style switcher */}
      <div className="absolute top-2 left-2 z-10 flex gap-1">
        {([
          ['outdoors', 'Topo'],
          ['satellite-streets', 'Satellite'],
          ['streets', 'Street'],
        ] as const).map(([s, label]) => (
          <button
            key={s}
            onClick={() => setMapStyle(s)}
            className={`px-2.5 py-1 text-xs font-medium rounded shadow transition-colors ${
              mapStyle === s
                ? 'bg-green-600 text-white'
                : 'bg-white/90 text-gray-700 hover:bg-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-8 right-2 z-10 bg-white/92 rounded-xl shadow-lg p-3 text-xs space-y-1 max-w-[140px]">
        <div className="font-semibold text-gray-600 mb-1.5">Trail difficulty</div>
        {Object.entries(DIFFICULTY_COLOR).map(([d, c]) => (
          <div key={d} className="flex items-center gap-1.5">
            <span className="block w-5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
            <span className="capitalize text-gray-500">{d}</span>
          </div>
        ))}
        <div className="font-semibold text-gray-600 mt-2 mb-1">Activities</div>
        {Object.entries(ACTIVITY_COLOR).filter(([k]) => k !== 'other').map(([t, c]) => (
          <div key={t} className="flex items-center gap-1.5">
            <span className="block w-5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
            <span className="capitalize text-gray-500">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
