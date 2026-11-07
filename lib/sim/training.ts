// Training scenarios and their evaluation (pure logic, no DB).
import { CITIES } from "./data/cities";
import { EQUIPMENT } from "./data/freight";
import { canHaul, equipName } from "./equipment";
import { roadMiles } from "./geo";
import type { Rng } from "./rng";
import type { City, EquipCode } from "./types";
import { money, rpmFmt, shortDay } from "../format";

export type DifficultyKey = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface Criteria {
  equipment: EquipCode[];
  startCity?: string;
  startState?: string;
  startLat?: number;
  startLng?: number;
  maxDeadhead?: number;
  destCity?: string;
  destState?: string;
  destLat?: number;
  destLng?: number;
  destRadius?: number;
  minRpm?: number;
  minNegotiationGain?: number;
  maxWeight?: number;
  pickupBy?: Date;
}

export interface AnchorLoad {
  id: string;
  originCity: string;
  originState: string;
  originLat: number;
  originLng: number;
  destCity: string;
  destState: string;
  destLat: number;
  destLng: number;
  equipment: EquipCode;
  miles: number;
  weight: number;
  rate: number | null;
  rpm: number | null;
  marketRate: number;
  pickupDate: Date;
  cargo: { oversize: boolean; permit: boolean };
}

export interface ScenarioDraft {
  key: string;
  title: string;
  brief: string;
  difficulty: DifficultyKey;
  criteria: Criteria;
  hints: string[];
  needsVerdict?: boolean;
}

interface Template {
  key: string;
  difficulty: DifficultyKey;
  title: string;
  /** Which loads may anchor this scenario */
  anchor: (l: AnchorLoad) => boolean;
  build: (l: AnchorLoad, rng: Rng) => ScenarioDraft;
}

const cityOf = (name: string, state: string) => CITIES.find((c) => c.n === name && c.s === state);

/** A market city between `min` and `max` road miles from a point (for deadhead scenarios). */
function cityNear(rng: Rng, lat: number, lng: number, min: number, max: number): City | undefined {
  const opts = CITIES.filter((c) => {
    const d = roadMiles(lat, lng, c.lat, c.lon);
    return d >= min && d <= max;
  });
  return opts.length ? rng.pick(opts) : undefined;
}

const start = (c: City) => ({ startCity: c.n, startState: c.s, startLat: c.lat, startLng: c.lon });
const dest = (c: City, radius: number) => ({ destCity: c.n, destState: c.s, destLat: c.lat, destLng: c.lon, destRadius: radius });

export const TEMPLATES: Template[] = [
  {
    key: "lane-direction",
    difficulty: "BEGINNER",
    title: "Head toward home",
    anchor: (l) => ["F", "SD", "CN"].includes(l.equipment) && l.miles > 250,
    build: (l, rng) => {
      const s = cityNear(rng, l.originLat, l.originLng, 0, 70) ?? cityOf(l.originCity, l.originState)!;
      const d = cityOf(l.destCity, l.destState)!;
      return {
        key: "lane-direction",
        difficulty: "BEGINNER",
        title: "Head toward home",
        brief: `You have a ${equipName(l.equipment)} truck available in ${s.n}, ${s.s}. Your driver wants to get home to ${d.n}, ${d.s}. Find a load going toward ${d.n}, ${d.s}.`,
        criteria: { equipment: [l.equipment], ...start(s), maxDeadhead: 150, ...dest(d, 200) },
        hints: [
          `Origin: ${s.n}, ${s.s} with DH-O 150. Destination: ${d.n}, ${d.s} with DH-D 200.`,
          `Equipment: ${equipName(l.equipment)}. Sort by RPM to find the best paying one.`,
        ],
      };
    },
  },
  {
    key: "nearby-book",
    difficulty: "BEGINNER",
    title: "Keep the truck moving",
    anchor: (l) => ["F", "SD", "CN", "HS"].includes(l.equipment) && l.rate != null,
    build: (l, rng) => {
      const s = cityNear(rng, l.originLat, l.originLng, 0, 60) ?? cityOf(l.originCity, l.originState)!;
      return {
        key: "nearby-book",
        difficulty: "BEGINNER",
        title: "Keep the truck moving",
        brief: `Your ${equipName(l.equipment)} driver just unloaded in ${s.n}, ${s.s}. Book any ${equipName(l.equipment)} load within 100 deadhead miles that pays at or above market.`,
        criteria: { equipment: [l.equipment], ...start(s), maxDeadhead: 100 },
        hints: ["Search with DH-O 100 and no destination.", "Compare the posted rate with the Market Rate shown in the load details."],
      };
    },
  },
  {
    key: "min-rpm",
    difficulty: "INTERMEDIATE",
    title: "Minimum RPM",
    anchor: (l) => ["SD", "F", "CN"].includes(l.equipment) && (l.rpm ?? 0) >= 2.4 && l.miles > 200,
    build: (l, rng) => {
      const s = cityNear(rng, l.originLat, l.originLng, 0, 90) ?? cityOf(l.originCity, l.originState)!;
      const minRpm = Math.max(2.3, Math.floor((l.rpm! * 0.97) / 0.05) * 0.05);
      return {
        key: "min-rpm",
        difficulty: "INTERMEDIATE",
        title: "Minimum RPM",
        brief: `Your driver is empty in ${s.n}, ${s.s}. Find a ${equipName(l.equipment)} load paying at least ${rpmFmt(minRpm)}/mile, with no more than 150 deadhead miles.`,
        criteria: { equipment: [l.equipment], ...start(s), maxDeadhead: 150, minRpm: Math.round(minRpm * 100) / 100 },
        hints: ["Use the Min RPM filter.", "Short runs show high RPM — check the total rate, too."],
      };
    },
  },
  {
    key: "negotiate-gain",
    difficulty: "INTERMEDIATE",
    title: "Negotiate up",
    anchor: (l) => ["CN", "F", "SD"].includes(l.equipment) && l.rate != null && l.miles > 300,
    build: (l, rng) => {
      const s = cityNear(rng, l.originLat, l.originLng, 0, 80) ?? cityOf(l.originCity, l.originState)!;
      const gain = l.rate! >= 2000 ? 200 : 150;
      return {
        key: "negotiate-gain",
        difficulty: "INTERMEDIATE",
        title: "Negotiate up",
        brief: `Truck in ${s.n}, ${s.s}. Find a ${equipName(l.equipment)} load and negotiate at least ${money(gain)} above the broker's initial offer, then book it.`,
        criteria: { equipment: [l.equipment], ...start(s), maxDeadhead: 150, minNegotiationGain: gain },
        hints: ["Open with a number 10–15% above the posted rate.", "Brokers with low credit scores and 'lowballer' habits post low on purpose.", "Accept when the broker says it's their final number."],
      };
    },
  },
  {
    key: "deadhead-profit",
    difficulty: "INTERMEDIATE",
    title: "Is the deadhead worth it?",
    anchor: (l) => l.rate != null && ["F", "SD", "CN", "V"].includes(l.equipment) && l.miles > 250,
    build: (l, rng) => {
      const s = cityNear(rng, l.originLat, l.originLng, 70, 230) ?? cityOf(l.originCity, l.originState)!;
      const d = cityOf(l.destCity, l.destState)!;
      return {
        key: "deadhead-profit",
        difficulty: "INTERMEDIATE",
        title: "Is the deadhead worth it?",
        brief: `Your ${equipName(l.equipment)} is empty in ${s.n}, ${s.s}. Find a load delivering in ${d.n}, ${d.s} and decide whether the deadhead miles still make it profitable.`,
        criteria: { equipment: [l.equipment], ...start(s), maxDeadhead: 300, ...dest(d, 60) },
        hints: ["All-in RPM = rate ÷ (loaded miles + deadhead miles).", "Profit = rate − (loaded + deadhead) × your cost per mile (Settings)."],
        needsVerdict: true,
      };
    },
  },
  {
    key: "hotshot-weight",
    difficulty: "ADVANCED",
    title: "Hotshot weight limits",
    anchor: (l) => l.equipment === "HS" && l.weight <= 16500 && (l.rpm ?? 0) > 1.5,
    build: (l, rng) => {
      const s = cityNear(rng, l.originLat, l.originLng, 0, 60) ?? cityOf(l.originCity, l.originState)!;
      const minRpm = Math.floor((l.rpm! * 0.95) / 0.05) * 0.05;
      return {
        key: "hotshot-weight",
        difficulty: "ADVANCED",
        title: "Hotshot weight limits",
        brief: `Your hotshot (40 ft, max 16,500 lbs) is in ${s.n}, ${s.s}. Find a load under the weight limit paying at least ${rpmFmt(minRpm)}/mile with deadhead under 75 miles, and negotiate at least $100 over the posted rate.`,
        criteria: { equipment: ["HS"], ...start(s), maxDeadhead: 75, minRpm: Math.round(minRpm * 100) / 100, maxWeight: 16500, minNegotiationGain: 100 },
        hints: ["Set Max Weight to 16,500.", "Hotshot rates are lower per mile than Class 8 flatbeds."],
      };
    },
  },
  {
    key: "oversize",
    difficulty: "ADVANCED",
    title: "Oversize step deck",
    anchor: (l) => l.equipment === "SD" && l.cargo.oversize && l.rate != null,
    build: (l, rng) => {
      const s = cityNear(rng, l.originLat, l.originLng, 0, 120) ?? cityOf(l.originCity, l.originState)!;
      const minRpm = Math.floor((l.rpm! * 0.95) / 0.05) * 0.05;
      return {
        key: "oversize",
        difficulty: "ADVANCED",
        title: "Oversize step deck",
        brief: `Step deck in ${s.n}, ${s.s} with permits experience. Find an oversize load paying at least ${rpmFmt(minRpm)}/mile within 200 deadhead miles and negotiate at least $150 more than posted.`,
        criteria: { equipment: ["SD"], ...start(s), maxDeadhead: 200, minRpm: Math.round(minRpm * 100) / 100, minNegotiationGain: 150 },
        hints: ["Use Load Requirements to see oversize loads.", "Oversize loads usually carry permit costs in the rate — check who pays."],
      };
    },
  },
  {
    key: "reload",
    difficulty: "ADVANCED",
    title: "Find the reload",
    anchor: (l) => ["F", "SD", "CN"].includes(l.equipment) && l.rate != null && l.miles > 300,
    build: (l, rng) => {
      const s = cityNear(rng, l.originLat, l.originLng, 20, 110) ?? cityOf(l.originCity, l.originState)!;
      const allIn = (l.rate! / (l.miles + roadMiles(s.lat, s.lon, l.originLat, l.originLng))) * 0.97;
      const minRpm = Math.floor(allIn / 0.05) * 0.05;
      return {
        key: "reload",
        difficulty: "ADVANCED",
        title: "Find the reload",
        brief: `Your ${equipName(l.equipment)} delivers in ${s.n}, ${s.s} and is empty by ${shortDay(l.pickupDate)}. Find a reload picking up by ${shortDay(l.pickupDate)} within 120 miles that still pays ${rpmFmt(minRpm)}/mile ALL-IN (deadhead included), and gain at least $100 in negotiation.`,
        criteria: { equipment: [l.equipment], ...start(s), maxDeadhead: 120, minRpm: Math.round(minRpm * 100) / 100, minNegotiationGain: 100, pickupBy: l.pickupDate },
        hints: ["Filter pickup date up to the target day.", "All-in RPM counts the empty miles too — closer pickups win."],
      };
    },
  },
];

export const TEMPLATE_BY_KEY = Object.fromEntries(TEMPLATES.map((t) => [t.key, t]));

export function buildScenario(rng: Rng, difficulty: DifficultyKey, anchors: AnchorLoad[], key?: string): ScenarioDraft | null {
  const templates = rng.shuffle(TEMPLATES.filter((t) => t.difficulty === difficulty && (!key || t.key === key)));
  for (const t of templates) {
    const candidates = anchors.filter(t.anchor);
    if (candidates.length) return t.build(rng.pick(candidates), rng);
  }
  return null;
}

// ---------- evaluation ----------

export interface EvalInput {
  criteria: Criteria;
  scenarioKey: string;
  load: AnchorLoad;
  finalRate: number;
  postedRate: number | null;
  negotiationStart: number | null;
  booked: boolean;
  costPerMile: number;
  verdict?: boolean | null;
}

export interface Check {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
  points: number;
  max: number;
}

export function evaluate(i: EvalInput): { score: number; checks: Check[]; summary: string } {
  const c = i.criteria;
  const L = i.load;
  const checks: Check[] = [];

  const dh = c.startLat != null && c.startLng != null ? roadMiles(c.startLat, c.startLng, L.originLat, L.originLng) : 0;
  const totalMiles = L.miles + dh;
  const rpm = i.finalRate / L.miles;
  const allIn = i.finalRate / Math.max(1, totalMiles);

  // 1. suitable load
  const problems: string[] = [];
  if (c.equipment.length && !c.equipment.some((e) => canHaul(e, L.equipment))) problems.push(`needs ${equipName(L.equipment)}, you run ${c.equipment.map(equipName).join("/")}`);
  if (c.maxDeadhead != null && dh > c.maxDeadhead) problems.push(`pickup is ${dh} mi from ${c.startCity} (limit ${c.maxDeadhead})`);
  if (c.destLat != null && c.destLng != null && c.destRadius != null) {
    const off = roadMiles(c.destLat, c.destLng, L.destLat, L.destLng);
    if (off > c.destRadius) problems.push(`delivers ${off} mi from ${c.destCity} (limit ${c.destRadius})`);
  }
  if (c.maxWeight != null && L.weight > c.maxWeight) problems.push(`weighs ${L.weight.toLocaleString("en-US")} lbs (max ${c.maxWeight.toLocaleString("en-US")})`);
  if (c.pickupBy && L.pickupDate.getTime() > c.pickupBy.getTime()) problems.push(`picks up ${shortDay(L.pickupDate)}, after ${shortDay(c.pickupBy)}`);
  checks.push({
    key: "suitable",
    label: "Suitable load",
    passed: problems.length === 0,
    detail: problems.length ? `Doesn't fit the brief: ${problems.join("; ")}.` : `${L.originCity}, ${L.originState} → ${L.destCity}, ${L.destState} fits the equipment, location and lane.`,
    points: problems.length === 0 ? 30 : Math.max(0, 30 - problems.length * 12),
    max: 30,
  });

  // 2. rate vs market
  const ratio = i.finalRate / L.marketRate;
  const ratePts = ratio >= 1 ? 20 : ratio >= 0.95 ? 14 : ratio >= 0.9 ? 8 : 0;
  checks.push({
    key: "rate",
    label: "Good rate",
    passed: ratio >= 0.95,
    detail: `${money(i.finalRate)} vs market ${money(L.marketRate)} (${(ratio * 100).toFixed(0)}% of market).${ratio < 0.95 ? " You're hauling below market — push back harder or pass." : ratio >= 1.05 ? " Excellent — above market." : ""}`,
    points: ratePts,
    max: 20,
  });

  // 3. RPM
  const eq = EQUIPMENT[L.equipment];
  const rpmTarget = c.minRpm ?? Math.max(i.costPerMile + 0.5, eq.rpm[0]);
  const rpmMeasured = i.scenarioKey === "reload" ? allIn : rpm;
  const rpmOk = rpmMeasured >= rpmTarget - 0.005;
  checks.push({
    key: "rpm",
    label: "Profitable RPM",
    passed: rpmOk,
    detail: `${i.scenarioKey === "reload" ? "All-in" : "Loaded"} RPM ${rpmFmt(rpmMeasured)} (target ${rpmFmt(rpmTarget)}). All-in with deadhead: ${rpmFmt(allIn)}.`,
    points: rpmOk ? 20 : rpmMeasured >= rpmTarget * 0.9 ? 10 : 0,
    max: 20,
  });

  // 4. deadhead
  const dhLimit = c.maxDeadhead ?? 150;
  const dhShare = dh / Math.max(1, L.miles);
  const dhOk = dh <= dhLimit && dhShare <= 0.25;
  checks.push({
    key: "deadhead",
    label: "Reasonable deadhead",
    passed: dhOk,
    detail: `${dh} empty miles for ${L.miles} loaded (${(dhShare * 100).toFixed(0)}%).${dhShare > 0.25 ? " More than a quarter of the trip is empty." : ""}`,
    points: dhOk ? 15 : dh <= dhLimit * 1.3 ? 7 : 0,
    max: 15,
  });

  // 5. negotiation
  const startRate = i.negotiationStart ?? i.postedRate;
  const gain = startRate != null ? i.finalRate - startRate : 0;
  if (c.minNegotiationGain) {
    const ok = gain >= c.minNegotiationGain;
    checks.push({
      key: "negotiation",
      label: "Negotiated successfully",
      passed: ok,
      detail: startRate == null ? "No initial offer to compare with." : `Gained ${money(gain)} over the initial ${money(startRate)} (goal ${money(c.minNegotiationGain)}).`,
      points: ok ? 15 : Math.max(0, Math.round((15 * Math.max(0, gain)) / c.minNegotiationGain)),
      max: 15,
    });
  } else {
    checks.push({
      key: "negotiation",
      label: "Negotiated successfully",
      passed: gain > 0,
      detail: startRate == null ? "No initial offer." : gain > 0 ? `Gained ${money(gain)} over the initial offer.` : "Took the first offer — always ask for more.",
      points: gain > 0 ? 15 : 6,
      max: 15,
    });
  }

  // 6. profitability verdict
  const cost = totalMiles * i.costPerMile;
  const profit = i.finalRate - cost;
  const profitable = profit >= 300 && allIn >= i.costPerMile + 0.4;
  if (i.verdict != null || i.scenarioKey === "deadhead-profit") {
    const right = i.verdict === profitable;
    checks.push({
      key: "verdict",
      label: "Profitability call",
      passed: right,
      detail: `${money(i.finalRate)} − ${totalMiles} mi × ${rpmFmt(i.costPerMile)} = ${money(Math.round(profit))} profit, all-in ${rpmFmt(allIn)}/mi → ${profitable ? "profitable" : "not worth it"}. You said ${i.verdict == null ? "nothing" : i.verdict ? "profitable" : "not profitable"}.`,
      points: right ? 10 : 0,
      max: 10,
    });
  }

  const max = checks.reduce((a, b) => a + b.max, 0);
  const got = checks.reduce((a, b) => a + b.points, 0);
  let score = Math.round((got / max) * 100);
  const passed = checks.filter((x) => x.passed).length;
  // missing the scenario's main objective caps the grade
  const primaryKey = PRIMARY[i.scenarioKey];
  const primary = checks.find((x) => x.key === primaryKey);
  const missedPrimary = primary && !primary.passed;
  if (missedPrimary) score = Math.min(score, 70);
  const summary = missedPrimary
    ? `Main objective missed (${primary.label.toLowerCase()}) — grade capped at 70. ${passed}/${checks.length} checks passed.`
    : score >= 85
      ? `Excellent dispatching — ${passed}/${checks.length} checks passed.`
      : score >= 65
        ? `Solid, with room to improve — ${passed}/${checks.length} checks passed.`
        : `Needs work — ${passed}/${checks.length} checks passed. Review the feedback below.`;
  return { score, checks, summary };
}

/** The check that represents each scenario's main objective. */
const PRIMARY: Record<string, string> = {
  "lane-direction": "suitable",
  "nearby-book": "rate",
  "min-rpm": "rpm",
  "negotiate-gain": "negotiation",
  "deadhead-profit": "verdict",
  "hotshot-weight": "suitable",
  oversize: "negotiation",
  reload: "rpm",
};

export const DIFFICULTY_LABEL: Record<DifficultyKey, string> = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };
