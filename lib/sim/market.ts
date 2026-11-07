import { EQUIPMENT } from "./data/freight";
import { MARKET } from "./data/cities";
import type { EquipCode, PersonalityKey } from "./types";
import type { Rng } from "./rng";

export const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Minimum charge a carrier will move for, per equipment */
export const MIN_CHARGE: Record<EquipCode, number> = { F: 500, SD: 550, CN: 600, HS: 325, V: 450, R: 500, PO: 400, BT: 300 };

/**
 * Weekly market index per equipment — deterministic wave so the "market" moves
 * from week to week, the same way for every page that asks.
 */
export function marketIndex(equipment: EquipCode, date: Date): number {
  const week = Math.floor(date.getTime() / (7 * 86400000));
  const phase = { F: 0.3, SD: 1.1, CN: 2.0, HS: 2.7, V: 3.4, R: 4.2, PO: 5.0, BT: 5.6 }[equipment];
  return 1 + 0.06 * Math.sin(week * 0.9 + phase) + 0.025 * Math.sin(week * 2.3 + phase * 2);
}

/** Short hauls pay more per mile; long hauls slightly less. */
export function distanceCurve(miles: number): number {
  if (miles < 100) return 1.9;
  if (miles < 250) return 1 + ((250 - miles) / 150) * 0.75;
  if (miles < 500) return 1 + ((500 - miles) / 250) * 0.12;
  if (miles > 1800) return 0.92;
  if (miles > 1200) return 0.96;
  return 1;
}

export interface RateInput {
  equipment: EquipCode;
  originState: string;
  destState: string;
  miles: number;
  pickupDate: Date;
  now: Date;
  tarps: boolean;
  tarpSize?: string | null;
  oversize: boolean;
  permit: boolean;
  weight: number;
  partial: boolean;
  lengthFt: number;
}

/** Fair market rate (all-in, USD) — the reference used for training feedback. */
export function fairMarketRate(i: RateInput): number {
  const eq = EQUIPMENT[i.equipment];
  const baseRpm = (eq.rpm[0] + eq.rpm[1]) / 2;
  let rpm = baseRpm * distanceCurve(i.miles);
  rpm *= MARKET.origin[i.originState] ?? 1;
  rpm *= MARKET.dest[i.destState] ?? 1;
  rpm *= marketIndex(i.equipment, i.pickupDate);
  if (i.weight > 45000) rpm *= 1.03;

  const daysOut = Math.round((i.pickupDate.getTime() - Date.UTC(i.now.getUTCFullYear(), i.now.getUTCMonth(), i.now.getUTCDate())) / 86400000);
  if (daysOut <= 0) rpm *= 1.06;
  else if (daysOut === 1) rpm *= 1.02;

  let rate = rpm * i.miles;
  if (i.partial) {
    const share = Math.min(1, Math.max(0.4, i.lengthFt / eq.len));
    rate *= 0.35 + 0.6 * share;
  }
  if (i.tarps) rate += i.tarpSize?.startsWith("8") ? 150 : 100;
  if (i.oversize) rate += 250 + Math.min(900, i.miles * 0.35);
  if (i.permit) rate += 150;
  rate = Math.max(rate, MIN_CHARGE[i.equipment]);
  return roundTo(rate, 25);
}

/** How brokers of each personality post relative to market, and how far they will go. */
export const PERSONALITY: Record<
  PersonalityKey,
  { post: [number, number]; ceiling: [number, number]; patience: [number, number]; concession: number; label: string; blurb: string }
> = {
  corporate: { post: [0.92, 1.0], ceiling: [1.02, 1.07], patience: [3, 4], concession: 0.35, label: "Corporate", blurb: "By the book. Small moves, needs approval for big ones." },
  flexible: { post: [0.88, 0.98], ceiling: [1.06, 1.13], patience: [4, 5], concession: 0.5, label: "Flexible", blurb: "Wants the load covered and will meet you in the middle." },
  friendly: { post: [0.92, 1.02], ceiling: [1.04, 1.1], patience: [4, 6], concession: 0.45, label: "Friendly", blurb: "Relationship-driven. Reasonable if you are reasonable." },
  lowballer: { post: [0.8, 0.9], ceiling: [0.98, 1.08], patience: [3, 5], concession: 0.3, label: "Lowballer", blurb: "Posts low on purpose and expects you to push." },
  firm: { post: [0.95, 1.03], ceiling: [1.0, 1.04], patience: [2, 3], concession: 0.2, label: "Firm", blurb: "Posted rate is close to final. Little room." },
  hustler: { post: [0.85, 0.97], ceiling: [1.04, 1.12], patience: [2, 4], concession: 0.4, label: "Hustler", blurb: "Fast talker, plays carriers against each other." },
};

export function postedAndCeiling(rng: Rng, market: number, personality: PersonalityKey) {
  const p = PERSONALITY[personality];
  const posted = roundTo(market * rng.float(p.post[0], p.post[1]), 25);
  const ceiling = Math.max(posted + roundTo(rng.float(0, 75), 25), roundTo(market * rng.float(p.ceiling[0], p.ceiling[1]), 25));
  return { posted, ceiling };
}
