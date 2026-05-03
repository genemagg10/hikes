'use client';

/**
 * TrailMap — Mapbox GL JS map showing the trail network colored by
 * personal completion (green = done, amber gradient = in progress,
 * gray = untouched). Trails are fetched from /api/trails/geojson.
 *
 * Workouts can be overlaid via the `workouts` prop.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { DbWorkout } from '@/lib/supabase';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

const ACTIVITY_COLOR: Record<string, string> = {
  hiking:  '#16a34a',
  walking: '#2563eb',
  running: '#dc2626',
  cycling: '#d97706',
  other:   '#6b7280',
};

const COMPLETE_COLOR   = '#10b981'; // emerald-500
const PROGRESS_COLOR   = '#f59e0b'; // amber-500
const UNTOUCHED_COLOR  = '#9ca3af'; // gray-400

const DEFAULT_CENTER: [number, number] = [-122.1235, 37.893];
const DEFAULT_ZOOM = 12;

interface TrailMapProps {
  workouts?: DbWorkout[];
  selectedWorkoutId?: string;
  highlightTrailId?: string;
  onWorkoutClick?: (id: string) => void;
  onTrailClick?: (id: string) => void;
  height?: string;
  style?: 'outdoors' | 'satellite-streets' | 'streets';
  /** Reserved for future modes; currently always "completion". */
  colorMode?: 'completion';
}

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

/** Tight bounding box of any GeoJSON geometry, [[w,s],[e,n]]. */
function geometryBounds(
  geom: GeoJSON.Geometry
): [[number, number], [number, number]] | null {
  let minLng = Infinity, minLat = Infinity;
  let maxLng = -Infinity, maxLat = -Infinity;

  const visit = (c: unknown): void => {
    if (
      Array.isArray(c) &&
      c.length >= 2 &&
      typeof c[0] === 'number' &&
      typeof c[1] === 'number'
    ) {
      const lng = c[0] as number;
      const lat = c[1] as number;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else if (Array.isArray(c)) {
      c.forEach(visit);
    }
  };

  if ('coordinates' in geom) visit(geom.coordinates);
  if (!isFinite(minLng)) return null;
  return [[minLng, minLat], [maxLng, maxLat]];
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

export default function TrailMap({
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
  const trailsFcRef  = useRef<GeoJSON.FeatureCollection>(EMPTY_FC);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapStyle, setMapStyle]   = useState(style);
  const [trailsFc, setTrailsFc]   = useState<GeoJSON.FeatureCollection>(EMPTY_FC);

  // Fetch trail geometry + progress once
  useEffect(() => {
    let cancelled = false;
    fetch('/api/trails/geojson')
      .then((r) => r.ok ? r.json() : EMPTY_FC)
      .catch(() => EMPTY_FC)
      .then((fc: GeoJSON.FeatureCollection) => {
        if (!cancelled) {
          trailsFcRef.current = fc;
          setTrailsFc(fc);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Initialize map
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

  // Re-add sources/layers on style change
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

  // Push trail data into the map source when it loads
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    (map.getSource('trails') as mapboxgl.GeoJSONSource | undefined)?.setData(trailsFc);
  }, [trailsFc, mapLoaded]);

  // Push workout data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    (map.getSource('workouts') as mapboxgl.GeoJSONSource | undefined)
      ?.setData(workoutsToGeoJSON(workouts));
    (map.getSource('workout-dots') as mapboxgl.GeoJSONSource | undefined)
      ?.setData(workoutDotsGeoJSON(workouts));
  }, [workouts, mapLoaded]);

  // Highlight selected workout
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.setFilter('workouts-selected',
      selectedWorkoutId
        ? ['==', ['get', 'id'], selectedWorkoutId]
        : ['==', 'true', 'false']
    );
  }, [selectedWorkoutId, mapLoaded]);

  // Highlight selected trail (color/width override + fly to bounds)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getLayer('trails-line')) return;
    const id = highlightTrailId ?? '';
    map.setPaintProperty('trails-line', 'line-color', [
      'case',
      ['==', ['get', 'id'], id], '#f97316',
      ['==', ['get', 'is_complete'], true], COMPLETE_COLOR,
      ['>', ['get', 'completion_pct'], 0], PROGRESS_COLOR,
      UNTOUCHED_COLOR,
    ]);
    map.setPaintProperty('trails-line', 'line-width', [
      'interpolate', ['linear'], ['zoom'],
      10, ['case', ['==', ['get', 'id'], id], 3, 1.2],
      13, ['case', ['==', ['get', 'id'], id], 6, 2.8],
      16, ['case', ['==', ['get', 'id'], id], 8, 4.5],
    ]);

    // Fly to the selected trail's extent
    if (highlightTrailId) {
      const feature = trailsFc.features.find(
        (f) => f.properties?.id === highlightTrailId
      );
      if (feature?.geometry) {
        const bounds = geometryBounds(feature.geometry);
        if (bounds) {
          map.fitBounds(bounds, { padding: 60, maxZoom: 15.5, duration: 700 });
        }
      }
    }
  }, [highlightTrailId, mapLoaded, trailsFc]);

  const addSources = useCallback((map: mapboxgl.Map) => {
    if (!map.getSource('trails')) {
      map.addSource('trails', {
        type: 'geojson',
        data: trailsFcRef.current,
        generateId: false,
      });
    }
    if (!map.getSource('workouts')) {
      map.addSource('workouts', { type: 'geojson', data: workoutsToGeoJSON(workouts) });
    }
    if (!map.getSource('workout-dots')) {
      map.addSource('workout-dots', { type: 'geojson', data: workoutDotsGeoJSON(workouts) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLayers = useCallback((map: mapboxgl.Map) => {
    if (!map.getLayer('trails-fill')) {
      map.addLayer({
        id: 'trails-fill',
        type: 'line',
        source: 'trails',
        paint: { 'line-width': 16, 'line-color': 'transparent' },
      });
    }

    if (!map.getLayer('trails-line')) {
      map.addLayer({
        id: 'trails-line',
        type: 'line',
        source: 'trails',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'is_complete'], true], COMPLETE_COLOR,
            ['>', ['get', 'completion_pct'], 0], PROGRESS_COLOR,
            UNTOUCHED_COLOR,
          ],
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            9,  ['case', ['==', ['get', 'is_complete'], true], 1.5, ['>', ['get', 'completion_pct'], 0], 1.2, 0.7],
            12, ['case', ['==', ['get', 'is_complete'], true], 3.2, ['>', ['get', 'completion_pct'], 0], 2.6, 1.6],
            14, ['case', ['==', ['get', 'is_complete'], true], 4.5, ['>', ['get', 'completion_pct'], 0], 3.6, 2.2],
            17, ['case', ['==', ['get', 'is_complete'], true], 7,   ['>', ['get', 'completion_pct'], 0], 5.5, 3.2],
          ],
          'line-opacity': [
            'interpolate', ['linear'], ['zoom'],
            9,  ['case', ['>', ['get', 'completion_pct'], 0], 0.85, 0.45],
            14, ['case', ['>', ['get', 'completion_pct'], 0], 1.0,  0.7],
          ],
        },
      });
    }

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
          'line-opacity': 0.7,
        },
      });
    }

    if (!map.getLayer('workouts-selected')) {
      map.addLayer({
        id: 'workouts-selected',
        type: 'line',
        source: 'workouts',
        filter: ['==', 'true', 'false'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#1d4ed8',
          'line-width': 5,
          'line-opacity': 1,
        },
      });
    }

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

  const attachInteractions = useCallback((map: mapboxgl.Map) => {
    for (const layer of ['trails-fill', 'workout-dots', 'workouts-line']) {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    }

    map.on('mousemove', 'trails-fill', (e) => {
      if (!e.features?.length) return;
      const props = e.features[0].properties ?? {};
      const mi = props.distance_m ? (props.distance_m / 1609.34).toFixed(1) : '?';
      const pct = Math.round((props.completion_pct ?? 0) * 100);
      const isDone = props.is_complete === true || props.is_complete === 'true';
      const status = isDone
        ? `<span style="color:${COMPLETE_COLOR};font-weight:600">✓ Complete</span>`
        : pct > 0
          ? `<span style="color:${PROGRESS_COLOR};font-weight:600">${pct}% complete</span>`
          : `<span style="color:${UNTOUCHED_COLOR}">Not yet hiked</span>`;
      const lastVisit = props.last_visit
        ? `<div class="trail-popup-sub">Last visited ${new Date(props.last_visit).toLocaleDateString()}</div>`
        : '';
      const html = `
        <div class="trail-popup">
          <strong>${props.name}</strong>
          <div class="trail-popup-sub">${props.area ?? ''}</div>
          <div class="trail-popup-stats">${mi} mi &nbsp;·&nbsp; ${status}</div>
          ${lastVisit}
        </div>`;

      if (!popupRef.current) {
        popupRef.current = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          maxWidth: '240px',
          className: 'trail-popup-wrapper',
          offset: 6,
        });
      }
      popupRef.current.setLngLat(e.lngLat).setHTML(html).addTo(map);
    });

    map.on('mouseleave', 'trails-fill', () => { popupRef.current?.remove(); });

    map.on('click', 'trails-fill', (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (id) onTrailClick?.(id);
    });

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
      <div className="absolute bottom-8 right-2 z-10 bg-white/92 rounded-xl shadow-lg p-3 text-xs space-y-1 max-w-[160px]">
        <div className="font-semibold text-gray-600 mb-1.5">Trail status</div>
        <LegendRow color={COMPLETE_COLOR}  label="Complete (≥85%)" />
        <LegendRow color={PROGRESS_COLOR}  label="In progress" />
        <LegendRow color={UNTOUCHED_COLOR} label="Not yet hiked" />
        {workouts.length > 0 && (
          <>
            <div className="font-semibold text-gray-600 mt-2 mb-1">My routes</div>
            {(['hiking', 'walking', 'running', 'cycling'] as const).map((t) => (
              <LegendRow key={t} color={ACTIVITY_COLOR[t]} label={t} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="block w-5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="capitalize text-gray-500">{label}</span>
    </div>
  );
}
