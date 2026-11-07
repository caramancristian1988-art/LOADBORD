"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

type Pt = { lat: number; lng: number; label: string };

/** Pickup → delivery map with driving route (OSRM) and optional deadhead leg from the truck/search origin. */
export function RouteMap({ pickup, delivery, start, height = 230 }: { pickup: Pt; delivery: Pt; start?: Pt | null; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const [routeNote, setRouteNote] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | null = null;
    (async () => {
      const L = await import("leaflet");
      if (disposed || !el.current) return;
      map = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const pts: [number, number][] = [
        [pickup.lat, pickup.lng],
        [delivery.lat, delivery.lng],
      ];
      if (start) pts.push([start.lat, start.lng]);
      map.fitBounds(L.latLngBounds(pts), { padding: [28, 28] });

      const dot = (p: Pt, color: string, letter: string) =>
        L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};color:#fff;font:700 11px/24px Roboto,sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${letter}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        })
          .bindTooltip(p.label)
          .addTo(map!);
      dot(pickup, "#0b5ed7", "P");
      dot(delivery, "#15803d", "D");
      if (start) {
        dot(start, "#64748b", "T");
        L.polyline(
          [
            [start.lat, start.lng],
            [pickup.lat, pickup.lng],
          ],
          { color: "#94a3b8", weight: 3, dashArray: "6 6" },
        ).addTo(map);
      }

      const straight = () =>
        L.polyline(
          [
            [pickup.lat, pickup.lng],
            [delivery.lat, delivery.lng],
          ],
          { color: "#0b5ed7", weight: 4, opacity: 0.8 },
        ).addTo(map!);

      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${delivery.lng},${delivery.lat}?overview=simplified&geometries=geojson`,
          { signal: ctrl.signal },
        );
        clearTimeout(t);
        const data = await res.json();
        const coords: [number, number][] | undefined = data?.routes?.[0]?.geometry?.coordinates;
        if (disposed || !map) return;
        if (coords?.length) {
          L.polyline(
            coords.map(([lng, lat]) => [lat, lng] as [number, number]),
            { color: "#0b5ed7", weight: 4, opacity: 0.85 },
          ).addTo(map);
        } else {
          straight();
          setRouteNote("Route preview unavailable — showing direct line.");
        }
      } catch {
        if (!disposed && map) {
          straight();
          setRouteNote("Route preview unavailable — showing direct line.");
        }
      }
    })();
    return () => {
      disposed = true;
      map?.remove();
    };
    // re-draw only when coordinates change, not on every parent render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup.lat, pickup.lng, delivery.lat, delivery.lng, start?.lat, start?.lng]);

  return (
    <div className="relative overflow-hidden rounded border border-line">
      <div ref={el} style={{ height }} className="bg-[#e8edf2]" />
      <div className="pointer-events-none absolute bottom-1 left-1 z-[400] flex gap-2 rounded bg-white/90 px-2 py-0.5 text-[10.5px] text-muted">
        <span>
          <b className="text-primary">P</b> pickup
        </span>
        <span>
          <b className="text-good">D</b> delivery
        </span>
        {start && (
          <span>
            <b>T</b> truck / origin (deadhead dashed)
          </span>
        )}
      </div>
      {routeNote && <div className="absolute top-1 right-1 z-[400] rounded bg-white/90 px-2 py-0.5 text-[10.5px] text-muted">{routeNote}</div>}
    </div>
  );
}
