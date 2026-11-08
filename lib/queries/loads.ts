import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ejDate, ejOid, fromEjson } from "../ejson";
import { boundingBox, findCity } from "../sim/geo";
import { dayFromIso } from "../format";
import { PAGE_SIZE, type LoadSearch } from "../search-params";
import type { EquipCode } from "../sim/types";

export interface LoadRow {
  id: string;
  ref: string;
  status: string;
  postedAt: Date;
  originCity: string;
  originState: string;
  destCity: string;
  destState: string;
  pickupDate: Date;
  deliveryDate: Date;
  miles: number;
  dho: number;
  dhd: number | null;
  equipment: EquipCode;
  size: "FULL" | "PARTIAL";
  weight: number;
  lengthFt: number;
  commodity: string;
  rate: number | null;
  rpm: number | null;
  brokerName: string;
  creditScore: number;
  daysToPay: number;
  contactPhone: string;
  tarps: boolean;
  oversize: boolean;
  marketRate: number;
}

export interface SearchResult {
  rows: LoadRow[];
  total: number;
  page: number;
  pages: number;
  laneAvgRate: number | null;
  laneAvgRpm: number | null;
  originLabel?: string;
  destLabel?: string;
  warnings: string[];
  similar: { rows: LoadRow[]; total: number };
}

const RAD = Math.PI / 180;

/** Aggregation expression: practical road miles between a fixed point and document coordinates. */
function roadMilesExpr(lat: number, lng: number, latField: string, lngField: string) {
  const dLat = { $multiply: [{ $subtract: [`$${latField}`, lat] }, RAD] };
  const dLng = { $multiply: [{ $subtract: [`$${lngField}`, lng] }, RAD] };
  const a = {
    $add: [
      { $pow: [{ $sin: { $divide: [dLat, 2] } }, 2] },
      {
        $multiply: [Math.cos(lat * RAD), { $cos: { $multiply: [`$${latField}`, RAD] } }, { $pow: [{ $sin: { $divide: [dLng, 2] } }, 2] }],
      },
    ],
  };
  const straight = { $multiply: [2 * 3958.8, { $asin: { $sqrt: { $min: [1, a] } } }] };
  return {
    $let: {
      vars: { s: straight },
      in: {
        $round: [
          {
            $multiply: [
              "$$s",
              { $switch: { branches: [{ case: { $lt: ["$$s", 1] }, then: 0 }, { case: { $lt: ["$$s", 150] }, then: 1.24 }, { case: { $lt: ["$$s", 600] }, then: 1.19 }], default: 1.15 } },
            ],
          },
          0,
        ],
      },
    },
  };
}

function parsePlace(text: string | undefined, stateText: string | undefined) {
  const city = findCity(text);
  const states = new Set<string>();
  if (stateText) stateText.split(/[ ,]+/).filter(Boolean).forEach((s) => states.add(s.toUpperCase()));
  // "TX" typed in the city box means the whole state
  if (!city && text && /^[A-Za-z]{2}$/.test(text.trim())) states.add(text.trim().toUpperCase());
  return { city, states: [...states] };
}

export async function searchLoads(s: LoadSearch): Promise<SearchResult> {
  const warnings: string[] = [];
  const match: Record<string, unknown> = { status: { $in: ["AVAILABLE", "NEGOTIATING"] } };

  const o = parsePlace(s.origin, s.originState);
  const d = parsePlace(s.dest, s.destState);
  if (s.origin && !o.city && !o.states.length) warnings.push(`Origin "${s.origin}" is not a known market — pick a city from the list.`);
  if (s.dest && !d.city && !d.states.length) warnings.push(`Destination "${s.dest}" is not a known market — pick a city from the list.`);

  // radius part of the filter (indexed bounding box); reused with a wider radius for "similar results"
  const geoMatch = (dhoR: number, dhdR: number) => {
    const m: Record<string, unknown> = {};
    if (o.city) {
      const b = boundingBox(o.city.lat, o.city.lon, dhoR);
      m.originLat = { $gte: b.minLat, $lte: b.maxLat };
      m.originLng = { $gte: b.minLng, $lte: b.maxLng };
    }
    if (d.city) {
      const b = boundingBox(d.city.lat, d.city.lon, dhdR);
      m.destLat = { $gte: b.minLat, $lte: b.maxLat };
      m.destLng = { $gte: b.minLng, $lte: b.maxLng };
    }
    return m;
  };
  if (o.states.length) match.originState = { $in: o.states };
  if (d.states.length) match.destState = { $in: d.states };
  if (s.equipment.length) match.equipment = { $in: s.equipment };

  const range = (from?: string, to?: string) => {
    const r: Record<string, unknown> = {};
    if (from) r.$gte = ejDate(dayFromIso(from));
    if (to) r.$lte = ejDate(dayFromIso(to));
    return Object.keys(r).length ? r : undefined;
  };
  const pr = range(s.pickupFrom, s.pickupTo);
  if (pr) match.pickupDate = pr;
  const dr = range(s.deliveryFrom, s.deliveryTo);
  if (dr) match.deliveryDate = dr;

  const rate: Record<string, unknown> = {};
  if (s.rateMin != null) rate.$gte = s.rateMin;
  if (s.rateMax != null) rate.$lte = s.rateMax;
  if (s.rateOnly) rate.$ne = null;
  if (Object.keys(rate).length) match.rate = rate;
  if (s.rpmMin != null) match.rpm = { $gte: s.rpmMin };
  if (s.weightMax != null) match.weight = { $lte: s.weightMax };
  if (s.lengthMax != null) match.lengthFt = { $lte: s.lengthMax };
  if (s.size) match.size = s.size;
  if (s.noTarps) match["cargo.tarps"] = false;
  if (s.noOversize) match["cargo.oversize"] = false;
  if (s.broker) match.brokerName = { $regex: s.broker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  if (s.csMin != null) {
    const ok = await prisma.broker.findMany({ where: { creditScore: { gte: s.csMin } }, select: { id: true } });
    match.brokerId = { $in: ok.map((b) => ejOid(b.id)) };
  }
  if (s.searchBackHrs) match.postedAt = { $gte: ejDate(new Date(Date.now() - s.searchBackHrs * 3600000)) };

  const distanceFields = {
    $addFields: {
      dho: o.city ? roadMilesExpr(o.city.lat, o.city.lon, "originLat", "originLng") : "$deadhead",
      dhd: d.city ? roadMilesExpr(d.city.lat, d.city.lon, "destLat", "destLng") : null,
      hasRate: { $cond: [{ $eq: [{ $ifNull: ["$rate", null] }, null] }, 0, 1] },
    },
  };
  const pipeline: Record<string, unknown>[] = [{ $match: { ...match, ...geoMatch(s.dho, s.dhd) } }, distanceFields];
  const radius: Record<string, unknown> = {};
  if (o.city) radius.dho = { $lte: s.dho };
  if (d.city) radius.dhd = { $lte: s.dhd };
  if (Object.keys(radius).length) pipeline.push({ $match: radius });

  const rowProjection = [
    { $lookup: { from: "Broker", localField: "brokerId", foreignField: "_id", as: "b", pipeline: [{ $project: { creditScore: 1, daysToPay: 1 } }] } },
    {
      $project: {
        ref: 1, status: 1, postedAt: 1, originCity: 1, originState: 1, destCity: 1, destState: 1, pickupDate: 1, deliveryDate: 1,
        miles: 1, dho: 1, dhd: 1, equipment: 1, size: 1, weight: 1, lengthFt: 1, commodity: 1, rate: 1, rpm: 1, brokerName: 1, marketRate: 1,
        creditScore: { $first: "$b.creditScore" }, daysToPay: { $first: "$b.daysToPay" }, contactPhone: "$contact.phone",
        tarps: "$cargo.tarps", oversize: "$cargo.oversize",
      },
    },
  ];

  // "Similar results": same filters with twice the deadhead radius, outside the exact radius
  let similar: { rows: LoadRow[]; total: number } = { rows: [], total: 0 };
  if ((o.city || d.city) && s.page === 1) {
    const wide = { dho: Math.min(500, s.dho * 2 || 50), dhd: Math.min(500, s.dhd * 2 || 50) };
    const within: Record<string, unknown> = {};
    if (o.city) within.dho = { $lte: wide.dho };
    if (d.city) within.dhd = { $lte: wide.dhd };
    const outside = [...(o.city ? [{ dho: { $gt: s.dho } }] : []), ...(d.city ? [{ dhd: { $gt: s.dhd } }] : [])];
    const simRaw = await prisma.load.aggregateRaw({
      pipeline: [
        { $match: { ...match, ...geoMatch(wide.dho, wide.dhd) } },
        distanceFields,
        { $match: { ...within, $or: outside } },
        { $facet: { rows: [{ $sort: { dho: 1, postedAt: -1, _id: 1 } }, { $limit: 20 }, ...rowProjection], total: [{ $count: "n" }] } },
      ] as Prisma.InputJsonValue[],
    });
    const [sim] = fromEjson<{ rows: LoadRow[]; total: { n: number }[] }[]>(simRaw);
    similar = { rows: sim?.rows ?? [], total: sim?.total[0]?.n ?? 0 };
  }

  const sorts: Record<string, Record<string, 1 | -1>> = {
    newest: { postedAt: -1 },
    rate_desc: { hasRate: -1, rate: -1 },
    rate_asc: { hasRate: -1, rate: 1 },
    rpm_desc: { hasRate: -1, rpm: -1 },
    rpm_asc: { hasRate: -1, rpm: 1 },
    miles_asc: { miles: 1 },
    miles_desc: { miles: -1 },
    dho_asc: { dho: 1, postedAt: -1 },
    pickup_asc: { pickupDate: 1, postedAt: -1 },
  };

  pipeline.push({
    $facet: {
      rows: [
        { $sort: { ...sorts[s.sort], _id: 1 } },
        { $skip: (s.page - 1) * PAGE_SIZE },
        { $limit: PAGE_SIZE },
        ...rowProjection,
      ],
      total: [{ $count: "n" }],
      lane: [{ $match: { rate: { $ne: null } } }, { $group: { _id: null, rate: { $avg: "$rate" }, rpm: { $avg: "$rpm" } } }],
    },
  });

  const raw = await prisma.load.aggregateRaw({ pipeline: pipeline as Prisma.InputJsonValue[] });
  const [res] = fromEjson<{ rows: LoadRow[]; total: { n: number }[]; lane: { rate: number; rpm: number }[] }[]>(raw);
  const total = res?.total[0]?.n ?? 0;
  return {
    rows: res?.rows ?? [],
    total,
    page: s.page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    laneAvgRate: res?.lane[0]?.rate ?? null,
    laneAvgRpm: res?.lane[0]?.rpm ?? null,
    originLabel: o.city ? `${o.city.n}, ${o.city.s}` : o.states.join(", ") || undefined,
    destLabel: d.city ? `${d.city.n}, ${d.city.s}` : d.states.join(", ") || undefined,
    warnings,
    similar,
  };
}

/** Full detail for the drawer / detail page. Hidden negotiation fields are stripped. */
export async function getLoadDetail(id: string) {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  const load = await prisma.load.findUnique({
    where: { id },
    include: {
      broker: true,
      truck: { include: { driver: true } },
      driver: true,
      negotiations: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!load) return null;
  const { brokerCeiling: _ceiling, negotiations, ...rest } = load;
  void _ceiling;
  const neg = negotiations[0];
  return {
    ...rest,
    negotiation: neg ? { id: neg.id, status: neg.status, channel: neg.channel, brokerOffer: neg.brokerOffer, agreedRate: neg.agreedRate, rounds: neg.rounds } : null,
  };
}
export type LoadDetail = NonNullable<Awaited<ReturnType<typeof getLoadDetail>>>;

/** Market band for the lane (same equipment, origin state → dest state), from posted loads. */
export async function laneBand(equipment: EquipCode, originState: string, destState: string) {
  const loads = await prisma.load.findMany({
    where: { equipment, originState, destState, rpm: { not: null } },
    select: { rpm: true },
    take: 200,
  });
  if (loads.length < 3) return null;
  const r = loads.map((l) => l.rpm!).sort((a, b) => a - b);
  return { low: r[Math.floor(r.length * 0.15)], avg: r.reduce((a, b) => a + b, 0) / r.length, high: r[Math.floor(r.length * 0.85)], n: r.length };
}
