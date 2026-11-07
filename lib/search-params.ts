// URL <-> search filter mapping for the load board (shared by server and client).
import type { EquipCode } from "./sim/types";

export const SORTS = {
  newest: "Age - Newest",
  rate_desc: "Rate - Highest",
  rate_asc: "Rate - Lowest",
  rpm_desc: "RPM - Highest",
  rpm_asc: "RPM - Lowest",
  miles_asc: "Trip - Shortest",
  miles_desc: "Trip - Longest",
  dho_asc: "DH-O - Closest",
  pickup_asc: "Pick Up - Earliest",
} as const;
export type SortKey = keyof typeof SORTS;

export const PAGE_SIZE = 50;

export interface LoadSearch {
  origin?: string; // "Dallas, TX"
  originState?: string; // "TX" (comma list allowed)
  dho: number;
  dest?: string;
  destState?: string;
  dhd: number;
  equipment: EquipCode[];
  pickupFrom?: string; // YYYY-MM-DD
  pickupTo?: string;
  deliveryFrom?: string;
  deliveryTo?: string;
  rateMin?: number;
  rateMax?: number;
  rpmMin?: number;
  weightMax?: number;
  lengthMax?: number;
  broker?: string;
  size?: "FULL" | "PARTIAL";
  noTarps?: boolean;
  noOversize?: boolean;
  rateOnly?: boolean;
  csMin?: number;
  searchBackHrs?: number;
  sort: SortKey;
  page: number;
}

type Raw = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const numOr = (v: string | undefined) => {
  if (v == null || v === "") return undefined;
  const n = Number(v.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

export const ALL_EQUIPMENT: EquipCode[] = ["F", "SD", "CN", "HS", "V", "R", "PO", "BT"];

export function parseLoadSearch(raw: Raw): LoadSearch {
  const eq = (one(raw.eq) ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is EquipCode => (ALL_EQUIPMENT as string[]).includes(s));
  const sort = one(raw.sort) as SortKey | undefined;
  return {
    origin: one(raw.o),
    originState: one(raw.os)?.toUpperCase(),
    dho: Math.min(500, Math.max(0, numOr(one(raw.dho)) ?? 150)),
    dest: one(raw.d),
    destState: one(raw.ds)?.toUpperCase(),
    dhd: Math.min(500, Math.max(0, numOr(one(raw.dhd)) ?? 150)),
    equipment: eq,
    pickupFrom: one(raw.pf),
    pickupTo: one(raw.pt),
    deliveryFrom: one(raw.df),
    deliveryTo: one(raw.dt),
    rateMin: numOr(one(raw.rmin)),
    rateMax: numOr(one(raw.rmax)),
    rpmMin: numOr(one(raw.rpm)),
    weightMax: numOr(one(raw.wmax)),
    lengthMax: numOr(one(raw.len)),
    broker: one(raw.broker),
    size: one(raw.size) === "PARTIAL" ? "PARTIAL" : one(raw.size) === "FULL" ? "FULL" : undefined,
    noTarps: one(raw.notarp) === "1",
    noOversize: one(raw.noos) === "1",
    rateOnly: one(raw.rated) === "1",
    csMin: numOr(one(raw.cs)),
    searchBackHrs: numOr(one(raw.age)),
    sort: sort && sort in SORTS ? sort : "newest",
    page: Math.max(1, Math.floor(numOr(one(raw.page)) ?? 1)),
  };
}

/** Serializes back to query params (omits defaults). */
export function toQuery(s: Partial<LoadSearch>): URLSearchParams {
  const q = new URLSearchParams();
  const set = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === "" || v === false) return;
    q.set(k, v === true ? "1" : String(v));
  };
  set("o", s.origin);
  set("os", s.originState);
  if (s.dho != null && s.dho !== 150) set("dho", s.dho);
  set("d", s.dest);
  set("ds", s.destState);
  if (s.dhd != null && s.dhd !== 150) set("dhd", s.dhd);
  if (s.equipment?.length) set("eq", s.equipment.join(","));
  set("pf", s.pickupFrom);
  set("pt", s.pickupTo);
  set("df", s.deliveryFrom);
  set("dt", s.deliveryTo);
  set("rmin", s.rateMin);
  set("rmax", s.rateMax);
  set("rpm", s.rpmMin);
  set("wmax", s.weightMax);
  set("len", s.lengthMax);
  set("broker", s.broker);
  set("size", s.size);
  set("notarp", s.noTarps);
  set("noos", s.noOversize);
  set("rated", s.rateOnly);
  set("cs", s.csMin);
  set("age", s.searchBackHrs);
  if (s.sort && s.sort !== "newest") set("sort", s.sort);
  if (s.page && s.page > 1) set("page", s.page);
  return q;
}
