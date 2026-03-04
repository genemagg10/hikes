'use client';

/**
 * HikeMap — Leaflet map with zoom-aware trail display
 *
 * Zoom strategy:
 *  < 12  → Named trail corridors (thick lines) + hike heat markers
 *  12-14 → Trail polylines with labels + hike start markers
 *  > 14  → Full detail: individual GPS tracks + trail names + elevation
 *
 * This component is client-only (Leaflet requires browser APIs).
 */

import { useEffect, useRef, useState } from 'react';
import { Workout, Trail } from '@/lib/types';
import { TRAILS } from '@/lib/trails';

interface HikeMapProps {
  workouts?: Workout[];
  selectedWorkoutId?: string;
  highlightTrailId?: string;
  onWorkoutClick?: (id: string) => void;
  height?: string;
  showAllTrails?: boolean;
}

const ACTIVITY_COLORS: Record<string, string> = {
  hiking: '#16a34a',
  walking: '#2563eb',
  running: '#dc2626',
  cycling: '#d97706',
  other: '#6b7280',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  moderate: '#f59e0b',
  hard: '#ef4444',
};

export default function HikeMap({
  workouts = [],
  selectedWorkoutId,
  highlightTrailId,
  onWorkoutClick,
  height = '500px',
  showAllTrails = true,
}: HikeMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null); // L instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layersRef = useRef<{ trails: any[]; routes: any[]; markers: any[] }>({
    trails: [],
    routes: [],
    markers: [],
  });
  const [zoom, setZoom] = useState(13);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamically import Leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      leafletRef.current = L;

      // Fix default marker icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [37.893, -122.1235], // Lafayette, CA
        zoom: 13,
        zoomControl: true,
      });
      mapInstanceRef.current = map;

      // Base tile layer (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // USGS topo overlay at high zoom for trail detail
      const topoLayer = L.tileLayer(
        'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
        { opacity: 0.25, maxZoom: 16, minZoom: 14, attribution: 'USGS' }
      );

      map.on('zoomend', () => {
        const z = map.getZoom();
        setZoom(z);
        if (z >= 14) {
          topoLayer.addTo(map);
        } else {
          topoLayer.remove();
        }
        redrawLayers(map, L, z);
      });

      redrawLayers(map, L, map.getZoom());
    });

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-draw when workouts or selection changes
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current) return;
    redrawLayers(mapInstanceRef.current, leafletRef.current, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, selectedWorkoutId, highlightTrailId, showAllTrails]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function redrawLayers(map: any, L: any, currentZoom: number) {
    // Clear old layers
    for (const layer of [
      ...layersRef.current.trails,
      ...layersRef.current.routes,
      ...layersRef.current.markers,
    ]) {
      map.removeLayer(layer);
    }
    layersRef.current = { trails: [], routes: [], markers: [] };

    // ── Known trail overlays ────────────────────────────────────────────
    if (showAllTrails) {
      for (const trail of TRAILS) {
        const isHighlighted = trail.id === highlightTrailId;
        const weight = currentZoom < 13 ? 3 : currentZoom < 15 ? 4 : 5;
        const opacity = isHighlighted ? 1 : currentZoom < 12 ? 0.5 : 0.75;
        const color = isHighlighted
          ? '#f97316'
          : DIFFICULTY_COLORS[trail.difficulty] ?? '#6b7280';

        const latLngs = trail.coordinates.map(([lng, lat]) => [lat, lng]);
        const line = L.polyline(latLngs, {
          color,
          weight: isHighlighted ? weight + 2 : weight,
          opacity,
          dashArray: trail.shape === 'out-and-back' ? '8 4' : undefined,
        }).addTo(map);

        line.bindTooltip(buildTrailTooltip(trail, currentZoom), {
          permanent: currentZoom >= 14 && isHighlighted,
          direction: 'top',
          sticky: true,
          className: 'trail-tooltip',
        });

        layersRef.current.trails.push(line);

        // Trail name labels at higher zoom
        if (currentZoom >= 13) {
          const midIdx = Math.floor(latLngs.length / 2);
          const mid = latLngs[midIdx] as [number, number];
          const label = L.marker(mid, {
            icon: L.divIcon({
              className: '',
              html: `<div class="trail-label">${trail.name}</div>`,
              iconAnchor: [0, 0],
            }),
            interactive: false,
          }).addTo(map);
          layersRef.current.trails.push(label);
        }
      }
    }

    // ── Workout GPS routes ─────────────────────────────────────────────
    for (const workout of workouts) {
      if (!workout.route || workout.route.length === 0) continue;
      const isSelected = workout.id === selectedWorkoutId;
      const color = ACTIVITY_COLORS[workout.type] ?? '#6b7280';
      const latLngs = workout.route.map((p) => [p.lat, p.lon]);

      const weight = isSelected ? 5 : 3;
      const opacity = isSelected ? 1 : 0.65;
      const route = L.polyline(latLngs, { color, weight, opacity }).addTo(map);
      route.on('click', () => onWorkoutClick?.(workout.id));
      layersRef.current.routes.push(route);

      // Start marker
      if (latLngs.length > 0 && (currentZoom >= 12 || isSelected)) {
        const start = latLngs[0] as [number, number];
        const marker = L.circleMarker(start, {
          radius: isSelected ? 8 : 5,
          fillColor: color,
          color: '#fff',
          weight: 2,
          fillOpacity: 0.9,
        }).addTo(map);
        marker.bindPopup(buildWorkoutPopup(workout));
        marker.on('click', () => onWorkoutClick?.(workout.id));
        layersRef.current.markers.push(marker);
      }
    }

    // If no workout has a route, show start-point markers for all
    const routedWorkouts = workouts.filter((w) => w.route && w.route.length > 0);
    const unroutedWorkouts = workouts.filter((w) => !w.route || w.route.length === 0);
    if (routedWorkouts.length === 0) {
      // Nothing to add for unrouted workouts without coordinates
      void unroutedWorkouts;
    }
  }

  return (
    <div className="relative" style={{ height }}>
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      {/* Legend */}
      <div className="absolute bottom-8 right-2 z-[1000] bg-white/90 rounded-lg shadow p-2 text-xs space-y-1">
        <div className="font-semibold text-gray-700 mb-1">Trail difficulty</div>
        {Object.entries(DIFFICULTY_COLORS).map(([d, c]) => (
          <div key={d} className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-1.5 rounded" style={{ background: c }} />
            <span className="capitalize text-gray-600">{d}</span>
          </div>
        ))}
        <div className="font-semibold text-gray-700 mt-2 mb-1">Your activity</div>
        {Object.entries(ACTIVITY_COLORS).map(([t, c]) => (
          <div key={t} className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-1.5 rounded" style={{ background: c }} />
            <span className="capitalize text-gray-600">{t}</span>
          </div>
        ))}
        <div className="text-gray-400 mt-1">Zoom {zoom}</div>
      </div>
    </div>
  );
}

function buildTrailTooltip(trail: Trail, zoom: number): string {
  if (zoom < 13) return `<b>${trail.name}</b>`;
  const miles = (trail.distance / 1609.34).toFixed(1);
  const elev = trail.elevationGain ? `+${trail.elevationGain}m` : '';
  return `<b>${trail.name}</b><br/>${miles} mi · ${trail.difficulty} ${elev}`;
}

function buildWorkoutPopup(w: Workout): string {
  const date = new Date(w.startDate).toLocaleDateString();
  const miles = (w.distance / 1609.34).toFixed(2);
  const mins = Math.round(w.duration / 60);
  return `
    <div>
      <b>${w.trailName ?? capitalize(w.type)}</b><br/>
      ${date}<br/>
      ${miles} mi · ${mins} min
    </div>`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
