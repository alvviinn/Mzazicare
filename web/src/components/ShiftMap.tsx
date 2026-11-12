'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { GeoPoint } from '@/lib/types';

// Colours come from the tokens (read at runtime so the map matches the rest of the page).
function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

type Props = {
  centre: GeoPoint | null; // the elder's phone: centre of the geofence
  radius?: number; // geofence radius in metres
  trail?: (GeoPoint & { at?: string })[]; // the caretaker's positions, oldest first
  point?: GeoPoint | null; // a single position (alert evidence)
  label: string; // what the map shows, for screen readers
  className?: string;
};

// A small OpenStreetMap map. Leaflet is loaded in the browser only (the dashboard is exported as static files).
export function ShiftMap({ centre, radius, trail = [], point, label, className = 'map' }: Props) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import('leaflet').Map | null = null;
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      if (cancelled || !box.current) return;
      map = L.map(box.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const primary = token('--color-primary');
      const warning = token('--color-warning');
      const danger = token('--color-danger');
      const bounds: [number, number][] = [];

      if (centre) {
        const c: [number, number] = [centre.latitude, centre.longitude];
        bounds.push(c);
        if (radius) {
          L.circle(c, { radius, color: primary, weight: 2, fillColor: primary, fillOpacity: 0.12 })
            .bindTooltip(`Geofence: ${radius} m around the elderly person's phone`)
            .addTo(map);
        }
        L.circleMarker(c, { radius: 6, color: primary, weight: 2, fillColor: primary, fillOpacity: 1 })
          .bindTooltip("Elderly person's phone")
          .addTo(map);
      }

      if (trail.length) {
        const line = trail.map((p) => [p.latitude, p.longitude] as [number, number]);
        bounds.push(...line);
        L.polyline(line, { color: warning, weight: 3, opacity: 0.9 }).addTo(map);
        const last = trail[trail.length - 1];
        L.circleMarker([last.latitude, last.longitude], { radius: 6, color: warning, weight: 2, fillColor: warning, fillOpacity: 1 })
          .bindTooltip(`Caretaker's last position${last.accuracy ? ` (±${Math.round(last.accuracy)} m)` : ''}`)
          .addTo(map);
      }

      if (point) {
        const p: [number, number] = [point.latitude, point.longitude];
        bounds.push(p);
        if (point.accuracy) {
          L.circle(p, { radius: point.accuracy, color: danger, weight: 1, fillColor: danger, fillOpacity: 0.1 }).addTo(map);
        }
        L.circleMarker(p, { radius: 6, color: danger, weight: 2, fillColor: danger, fillOpacity: 1 }).addTo(map);
      }

      if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds), { padding: [24, 24], maxZoom: 18 });
      else if (bounds.length === 1) map.setView(bounds[0], 17);
      else map.setView([-1.2921, 36.8219], 12); // Nairobi
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [centre, radius, trail, point]);

  return <div ref={box} className={className} role="img" aria-label={label} />;
}
