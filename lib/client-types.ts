import type { LoadDetail } from "./queries/loads";

/** JSON-serialized version of a server type (Dates become strings). */
export type Jsonify<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;

export type LoadDetailJson = Jsonify<LoadDetail>;
export type LaneBand = { low: number; avg: number; high: number; n: number } | null;

export interface TruckOption {
  id: string;
  number: string;
  equipment: string;
  trailerLength: number;
  maxWeight: number;
  city: string;
  state: string;
  lat: number;
  lng: number;
  status: string;
  availableDate: string;
  driverId: string | null;
  driver: { id: string; name: string; phone: string } | null;
}

export interface DriverOption {
  id: string;
  name: string;
  phone: string;
}
