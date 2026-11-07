/** Converts MongoDB Extended JSON (as returned by Prisma `aggregateRaw`) to plain values. */
export function fromEjson<T = unknown>(v: unknown): T {
  if (Array.isArray(v)) return v.map(fromEjson) as T;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("$oid" in o) return o.$oid as T;
    if ("$date" in o) {
      const d = o.$date as unknown;
      if (typeof d === "string") return new Date(d) as T;
      if (d && typeof d === "object" && "$numberLong" in (d as object)) return new Date(Number((d as { $numberLong: string }).$numberLong)) as T;
      return new Date(d as number) as T;
    }
    if ("$numberLong" in o) return Number(o.$numberLong) as T;
    if ("$numberInt" in o) return Number(o.$numberInt) as T;
    if ("$numberDouble" in o) return Number(o.$numberDouble) as T;
    if ("$numberDecimal" in o) return Number(o.$numberDecimal) as T;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(o)) out[k === "_id" ? "id" : k] = fromEjson(val);
    return out as T;
  }
  return v as T;
}

export const ejDate = (d: Date) => ({ $date: d.toISOString() });
export const ejOid = (id: string) => ({ $oid: id });
