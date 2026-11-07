import { CITIES } from "./data/cities";
import type { City } from "./types";

const R_MILES = 3958.8;
const toRad = Math.PI / 180;

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.sqrt(a));
}

/** Road-mile factor applied to straight-line distance (roads are never straight). */
export function roadFactor(straight: number): number {
  return straight < 150 ? 1.24 : straight < 600 ? 1.19 : 1.15;
}

/** Approximate practical truck miles between two points. */
export function roadMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const d = haversine(lat1, lon1, lat2, lon2);
  if (d < 1) return 0;
  return Math.round(d * roadFactor(d));
}

/** Bounding box that contains every point within `roadMilesRadius` road miles. */
export function boundingBox(lat: number, lng: number, roadMilesRadius: number) {
  // road miles >= straight miles, so straight radius = road / smallest factor
  const straight = roadMilesRadius / 1.15;
  const dLat = straight / 69.0;
  const dLng = straight / (69.172 * Math.max(0.2, Math.cos(lat * toRad)));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

export function cityLabel(c: { n: string; s: string } | { city: string; state: string }) {
  return "n" in c ? `${c.n}, ${c.s}` : `${c.city}, ${c.state}`;
}

const byKey = new Map<string, City>(CITIES.map((c) => [`${c.n.toLowerCase()}|${c.s}`, c]));

/** Finds a known market by "City, ST" text (case-insensitive). */
export function findCity(text: string | null | undefined): City | undefined {
  if (!text) return undefined;
  const m = text.split(",").map((p) => p.trim());
  if (m.length < 2) return undefined;
  return byKey.get(`${m[0].toLowerCase()}|${m[1].toUpperCase()}`);
}

export function nearestCity(lat: number, lng: number): City {
  let best = CITIES[0];
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = haversine(lat, lng, c.lat, c.lon);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
