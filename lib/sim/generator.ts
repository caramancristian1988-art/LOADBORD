import { CITIES } from "./data/cities";
import { BROKER_SEED, NAMES, AREA_CODES } from "./data/brokers";
import { EQUIPMENT, EQUIP_MIX, COMMODITIES, SHIPPER_WORDS, STREETS, GENERAL_INSTRUCTIONS } from "./data/freight";
import { haversine, roadMiles } from "./geo";
import { fairMarketRate, postedAndCeiling } from "./market";
import type { Rng } from "./rng";
import type { City, CommoditySpec, EquipCode, PersonalityKey } from "./types";

// ---------- brokers ----------

export interface GeneratedBroker {
  name: string;
  mc: string;
  dot: string;
  hqCity: string;
  hqState: string;
  address: string;
  zip: string;
  phone: string;
  email: string;
  creditScore: number;
  daysToPay: number;
  yearsInBiz: number;
  quickPayPct: number;
  personality: PersonalityKey;
  contacts: { name: string; phone: string; ext: string | null; email: string }[];
}

/** Fictional 555-01xx numbers (reserved for fiction) with a realistic area code. */
export function fakePhone(rng: Rng, state: string) {
  const codes = AREA_CODES[state] ?? ["800", "888", "877"];
  return `(${rng.pick(codes)}) 555-01${String(rng.int(0, 99)).padStart(2, "0")}`;
}

function domainFor(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/\b(llc|inc|co|group|services|partners)\b\.?/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 22) + ".com"
  );
}

export function generateBrokers(rng: Rng): GeneratedBroker[] {
  const usedMc = new Set<string>();
  return BROKER_SEED.map((b) => {
    let mc = "";
    do mc = String(rng.int(310000, 1490000));
    while (usedMc.has(mc));
    usedMc.add(mc);
    const hq = CITIES.find((c) => c.n === b.hq[0] && c.s === b.hq[1]);
    const domain = domainFor(b.name);
    const contacts = Array.from({ length: rng.int(2, 4) }, () => {
      const first = rng.pick(NAMES.first);
      const last = rng.pick(NAMES.last);
      return {
        name: `${first} ${last}`,
        phone: fakePhone(rng, b.hq[1]),
        ext: rng.chance(0.5) ? String(rng.int(101, 489)) : null,
        email: `${first[0].toLowerCase()}${last.toLowerCase()}@${domain}`,
      };
    });
    return {
      name: b.name,
      mc,
      dot: String(rng.int(1100000, 3999999)),
      hqCity: b.hq[0],
      hqState: b.hq[1],
      address: `${rng.int(100, 9800)} ${rng.pick(["Corporate Dr", "Executive Pkwy", "Main St", "Commerce Blvd", "Park Center Dr", "Lakeview Pkwy"])}${rng.chance(0.6) ? `, Suite ${rng.int(100, 950)}` : ""}`,
      zip: hq?.zip ?? "00000",
      phone: fakePhone(rng, b.hq[1]),
      email: `loads@${domain}`,
      creditScore: b.cs,
      daysToPay: b.dtp,
      yearsInBiz: b.yrs,
      quickPayPct: b.qp,
      personality: b.p,
      contacts,
    };
  });
}

// ---------- loads ----------

export interface BrokerRef {
  id: string;
  name: string;
  personality: PersonalityKey;
  hqState: string;
  contacts: { name: string; phone: string; ext: string | null; email: string }[];
}

const EQUIP_CODES = Object.keys(EQUIP_MIX) as EquipCode[];

function pickEquipment(rng: Rng): EquipCode {
  return rng.weighted(EQUIP_CODES, (c) => EQUIP_MIX[c]);
}

/** Lane-length preference: most loads 150–1,200 mi, a tail out to ~2,600 mi. */
function distanceWeight(straightMiles: number, eq: EquipCode) {
  const d = straightMiles;
  if (d < 40) return 0;
  if (eq === "BT" || eq === "HS") {
    // box trucks and hotshots run shorter regional freight
    if (d < 500) return 1.4;
    if (d < 900) return 0.5;
    return 0.08;
  }
  if (d < 120) return 0.35;
  if (d < 900) return 1.3;
  if (d < 1500) return 0.75;
  if (d < 2200) return 0.3;
  return 0.1;
}

function jitter(rng: Rng, v: number, amt = 0.04) {
  return Math.round((v + rng.float(-amt, amt)) * 10000) / 10000;
}

function toTime(mins: number) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function stopWindow(rng: Rng) {
  if (rng.chance(0.45)) {
    const start = rng.pick([6, 7, 8, 9, 10, 13, 14]) * 60 + rng.pick([0, 0, 30]);
    return { appointment: true, windowStart: toTime(start), windowEnd: toTime(start + 60) };
  }
  const start = rng.pick([5, 6, 7, 8]) * 60;
  return { appointment: false, windowStart: toTime(start), windowEnd: toTime(start + rng.pick([8, 9, 10]) * 60) };
}

function facilityName(rng: Rng, kind: "od" | "w") {
  return `${rng.pick(SHIPPER_WORDS.prefix)} ${rng.pick(SHIPPER_WORDS[kind])}`;
}

function resolveChance(v: boolean | number | undefined, rng: Rng) {
  if (typeof v === "number") return rng.chance(v);
  return !!v;
}

function utcDay(base: Date, addDays: number) {
  return new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate() + addDays));
}

export interface LoadContext {
  now: Date;
  seq: number;
  brokers: BrokerRef[];
  /** posted within the last N minutes (spread) */
  postedWithinMin: number;
}

/** Builds one load as a Prisma `LoadCreateInput`-compatible object (brokerId linked). */
export function generateLoad(rng: Rng, ctx: LoadContext) {
  const equipment = pickEquipment(rng);
  const eqSpec = EQUIPMENT[equipment];
  const commodities = COMMODITIES.filter((c) => c.eq.includes(equipment));
  const commodity: CommoditySpec = rng.pick(commodities);
  const kind = commodity.origin ?? (eqSpec.openDeck ? "od" : "w");

  // origin weighted by freight type, destination by general demand + distance preference
  const origin: City = rng.weighted(CITIES, (c) => (kind === "od" ? c.od * 1.4 + c.w * 0.3 : c.w));
  const dest: City = rng.weighted(CITIES, (c) => (c === origin ? 0 : (c.w + c.od * 0.5) * distanceWeight(haversine(origin.lat, origin.lon, c.lat, c.lon), equipment)));

  const oLat = jitter(rng, origin.lat);
  const oLng = jitter(rng, origin.lon);
  const dLat = jitter(rng, dest.lat);
  const dLng = jitter(rng, dest.lon);
  const miles = Math.max(25, roadMiles(oLat, oLng, dLat, dLng));

  // ---- cargo ----
  const pieces = rng.int(commodity.pcs[0], commodity.pcs[1]);
  let lengthFt = rng.int(commodity.dims.l[0], commodity.dims.l[1]);
  let widthIn = rng.int(commodity.dims.w[0], commodity.dims.w[1]);
  let heightIn = rng.int(commodity.dims.h[0], commodity.dims.h[1]);
  let oversize = false;
  if (commodity.osChance && rng.chance(commodity.osChance)) {
    oversize = true;
    if (commodity.osLen) lengthFt = rng.int(commodity.osLen[0], commodity.osLen[1]);
    if (commodity.osWidth) widthIn = rng.int(commodity.osWidth[0], commodity.osWidth[1]);
  }
  if (!eqSpec.openDeck) {
    // enclosed trailers: freight must fit inside the box
    oversize = false;
    widthIn = Math.min(widthIn, 96);
    lengthFt = Math.min(lengthFt, eqSpec.len);
    heightIn = Math.min(heightIn, eqSpec.legalH);
  } else if (widthIn > 102 || heightIn > eqSpec.legalH || lengthFt > 53) oversize = true;
  const permit = oversize && (widthIn > 102 || heightIn > eqSpec.legalH + 6 || lengthFt > 53);

  let weight = commodity.wt[1] === 0 ? 0 : Math.round(rng.int(commodity.wt[0], commodity.wt[1]) / 100) * 100;
  weight = Math.min(weight, eqSpec.maxWt);

  // Deck length used: long pieces lie end to end once; small pieces go two abreast when narrow.
  const perRow = widthIn <= 51 ? 2 : 1;
  const linear = lengthFt >= 20 ? lengthFt : Math.ceil(pieces / perRow) * lengthFt;
  const usedLength = lengthFt > eqSpec.len ? lengthFt : Math.min(eqSpec.len, Math.max(lengthFt, linear));
  const partial = (equipment === "HS" || equipment === "BT" || equipment === "F" || equipment === "SD") && weight < eqSpec.maxWt * 0.45 && usedLength < eqSpec.len * 0.6 && rng.chance(0.7);
  const loadLength = partial ? Math.max(8, usedLength) : eqSpec.len;

  const tarps = (commodity.tarp ?? 0) > 0 && rng.chance(commodity.tarp ?? 0) && !commodity.tarpSize?.[0]?.startsWith("shrink");
  const tarpSize = tarps ? rng.pick(commodity.tarpSize ?? ["6 ft tarps"]) : null;
  const chains = eqSpec.openDeck && resolveChance(commodity.chains, rng);
  const straps = eqSpec.openDeck ? resolveChance(commodity.straps, rng) || !chains : false;
  const temp = commodity.temp ? `${commodity.temp[0]}°F to ${commodity.temp[1]}°F` : null;

  // ---- dates ----
  const pickupOffset = rng.weighted([0, 1, 2, 3, 4, 5, 6], (d) => [30, 30, 18, 10, 6, 4, 2][d]);
  const pickupDate = utcDay(ctx.now, pickupOffset);
  const transitDays = miles < 250 ? (rng.chance(0.6) ? 0 : 1) : Math.ceil(miles / 520);
  const deliveryDate = utcDay(ctx.now, pickupOffset + transitDays + (rng.chance(0.15) ? 1 : 0));

  // ---- rate ----
  const broker = rng.pick(ctx.brokers);
  const marketRate = fairMarketRate({
    equipment,
    originState: origin.s,
    destState: dest.s,
    miles,
    pickupDate,
    now: ctx.now,
    tarps,
    tarpSize,
    oversize,
    permit,
    weight,
    partial,
    lengthFt: loadLength,
  });
  const { posted, ceiling } = postedAndCeiling(rng, marketRate, broker.personality);
  const callForRate = rng.chance(0.13);
  const rate = callForRate ? null : posted;

  // ---- people & places ----
  const contact = rng.pick(broker.contacts);
  const pickupWin = stopWindow(rng);
  const deliveryWin = stopWindow(rng);
  const pickup = {
    facility: facilityName(rng, kind),
    address: `${rng.int(100, 9900)} ${rng.pick(STREETS)}`,
    city: origin.n,
    state: origin.s,
    zip: origin.zip,
    lat: oLat,
    lng: oLng,
    date: pickupDate,
    ...pickupWin,
    contact: `${rng.pick(NAMES.first)} — Shipping`,
    phone: fakePhone(rng, origin.s),
  };
  const delivery = {
    facility: facilityName(rng, rng.chance(0.5) ? "od" : "w"),
    address: `${rng.int(100, 9900)} ${rng.pick(STREETS)}`,
    city: dest.n,
    state: dest.s,
    zip: dest.zip,
    lat: dLat,
    lng: dLng,
    date: deliveryDate,
    ...deliveryWin,
    contact: `${rng.pick(NAMES.first)} — Receiving`,
    phone: fakePhone(rng, dest.s),
  };

  const general = eqSpec.openDeck ? GENERAL_INSTRUCTIONS.od : GENERAL_INSTRUCTIONS.dry;
  const instructions = [
    ...commodity.notes,
    ...rng.shuffle(general).slice(0, rng.int(2, 4)),
    ...(tarps ? [`${tarpSize} required${commodity.tarp === 1 ? " — no exceptions" : ""}.`] : []),
    ...(permit ? ["Oversize permits arranged and paid by broker; carrier must follow permitted route."] : []),
    ...(temp ? [`Reefer set to ${temp}, continuous mode. Pulp temps at pickup.`] : []),
  ];

  const postedAgoMin = Math.floor(Math.pow(rng(), 1.7) * ctx.postedWithinMin);
  const deadhead = Math.round(Math.pow(rng(), 1.6) * 160);

  return {
    ref: `LD-${ctx.seq}`,
    status: "AVAILABLE" as const,
    postedAt: new Date(ctx.now.getTime() - postedAgoMin * 60000),
    originCity: origin.n,
    originState: origin.s,
    originLat: oLat,
    originLng: oLng,
    destCity: dest.n,
    destState: dest.s,
    destLat: dLat,
    destLng: dLng,
    pickupDate,
    deliveryDate,
    pickup,
    delivery,
    miles,
    deadhead,
    equipment,
    size: partial ? ("PARTIAL" as const) : ("FULL" as const),
    weight,
    lengthFt: loadLength,
    commodity: commodity.name,
    cargo: {
      lengthFt,
      widthIn,
      heightIn,
      pieces,
      tarps,
      tarpSize,
      chains,
      straps,
      oversize,
      permit,
      temp,
      hazmat: false,
    },
    rate,
    rpm: rate == null ? null : Math.round((rate / miles) * 100) / 100,
    marketRate,
    brokerCeiling: ceiling,
    brokerId: broker.id,
    brokerName: broker.name,
    contact,
    instructions,
    notes: rng.chance(0.35)
      ? rng.pick([
          "Must be able to load today.",
          "Need a team-player carrier, more loads on this lane weekly.",
          "Driver needs PPE and FR clothing.",
          "Please call, do not email for this one.",
          "Rate includes tarp pay.",
          "Check calls every 4 hrs.",
          "Possible reload at delivery.",
          "TWIC card required at delivery port.",
        ])
      : null,
    history: [{ status: "AVAILABLE" as const, at: new Date(ctx.now.getTime() - postedAgoMin * 60000), note: "Posted to board" }],
  };
}

export type GeneratedLoad = ReturnType<typeof generateLoad>;
