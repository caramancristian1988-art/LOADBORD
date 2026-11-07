import type { PrismaClient } from "@prisma/client";
import { generateBrokers, generateLoad, type BrokerRef } from "./sim/generator";
import { liveRng, makeRng } from "./sim/rng";
import { CITIES } from "./sim/data/cities";
import { prisma as defaultPrisma } from "./db";

export const INITIAL_LOADS = 650;
/** New postings per minute of wall-clock time while the app is used */
const POSTINGS_PER_MIN = 0.6;
const MAX_TOPUP = 40;

export const DEFAULT_SETTINGS = {
  key: "app",
  carrierName: "Iron Prairie Transport LLC",
  carrierMc: "MC-1184520",
  carrierDot: "3391207",
  carrierAddress: "4410 Freightliner Way",
  carrierCity: "Fort Worth",
  carrierState: "TX",
  carrierZip: "76106",
  carrierPhone: "(817) 555-0164",
  carrierEmail: "dispatch@ironprairie-transport.com",
  dispatcherName: "Dispatcher",
  costPerMile: 1.85,
  targetRpm: 2.5,
};

async function brokerRefs(db: PrismaClient): Promise<BrokerRef[]> {
  const brokers = await db.broker.findMany({ select: { id: true, name: true, personality: true, hqState: true, contacts: true } });
  return brokers.map((b) => ({ ...b, contacts: b.contacts.map((c) => ({ ...c, ext: c.ext ?? null })) }));
}

async function insertLoads(db: PrismaClient, count: number, postedWithinMin: number, seed?: number) {
  const settings = await db.settings.update({ where: { key: "app" }, data: { loadSeq: { increment: count } } });
  const firstSeq = settings.loadSeq - count + 1;
  const brokers = await brokerRefs(db);
  const rng = seed == null ? liveRng() : makeRng(seed);
  const now = new Date();
  const loads = Array.from({ length: count }, (_, i) => generateLoad(rng, { now, seq: firstSeq + i, brokers, postedWithinMin }));
  // createMany keeps inserts to a single round trip per chunk
  for (let i = 0; i < loads.length; i += 200) {
    await db.load.createMany({ data: loads.slice(i, i + 200) });
  }
  return count;
}

const STARTER_FLEET = [
  { number: "101", equipment: "F" as const, trailerLength: 48, maxWeight: 48000, city: "Dallas", state: "TX", driver: { name: "Dale Kowalski", phone: "(214) 555-0118", cdlState: "TX" } },
  { number: "102", equipment: "SD" as const, trailerLength: 48, maxWeight: 46000, city: "Houston", state: "TX", driver: { name: "Luis Ramirez", phone: "(713) 555-0127", cdlState: "TX" } },
  { number: "103", equipment: "CN" as const, trailerLength: 48, maxWeight: 44000, city: "Atlanta", state: "GA", driver: { name: "Andrei Popescu", phone: "(404) 555-0133", cdlState: "GA" } },
  { number: "104", equipment: "HS" as const, trailerLength: 40, maxWeight: 16500, city: "Oklahoma City", state: "OK", driver: { name: "Terrence Hayes", phone: "(405) 555-0149", cdlState: "OK" } },
];

/** Full wipe and regeneration of the simulated market (keeps nothing). */
export async function resetMarket(db: PrismaClient = defaultPrisma, opts: { keepFleet?: boolean; seed?: number } = {}) {
  await db.trainingAttempt.deleteMany();
  await db.negotiation.deleteMany();
  await db.load.deleteMany();
  await db.broker.deleteMany();
  if (!opts.keepFleet) {
    await db.truck.deleteMany();
    await db.driver.deleteMany();
  } else {
    await db.truck.updateMany({ data: { status: "AVAILABLE" } });
  }

  const existing = await db.settings.findUnique({ where: { key: "app" } });
  if (!existing) await db.settings.create({ data: DEFAULT_SETTINGS });

  const rng = makeRng(opts.seed ?? Date.now() % 2147483647);
  const brokers = generateBrokers(rng);
  await db.broker.createMany({ data: brokers });

  await insertLoads(db, INITIAL_LOADS, 36 * 60, opts.seed);

  if (!opts.keepFleet) {
    const today = new Date();
    const availableDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    for (const t of STARTER_FLEET) {
      const city = CITIES.find((c) => c.n === t.city && c.s === t.state)!;
      const driver = await db.driver.create({ data: t.driver });
      await db.truck.create({
        data: {
          number: t.number,
          equipment: t.equipment,
          trailerLength: t.trailerLength,
          maxWeight: t.maxWeight,
          city: t.city,
          state: t.state,
          lat: city.lat,
          lng: city.lon,
          availableDate,
          driverId: driver.id,
        },
      });
    }
  }
  await db.settings.update({ where: { key: "app" }, data: { marketSeededAt: new Date(), lastTopUpAt: new Date() } });
}

let ensuring: Promise<void> | null = null;

/**
 * Makes sure a market exists, and simulates a live board: new loads are posted in
 * proportion to the time since the last visit, and stale available loads (pickup
 * date already passed) are marked as covered.
 */
export async function ensureMarket(db: PrismaClient = defaultPrisma) {
  if (ensuring) return ensuring;
  ensuring = (async () => {
    const settings = await db.settings.findUnique({ where: { key: "app" } });
    if (!settings?.marketSeededAt || (await db.broker.count()) === 0) {
      await resetMarket(db);
      return;
    }
    const now = Date.now();
    const last = settings.lastTopUpAt?.getTime() ?? now;
    const elapsedMin = (now - last) / 60000;
    const due = Math.min(MAX_TOPUP, Math.floor(elapsedMin * POSTINGS_PER_MIN));
    if (due >= 1) {
      await db.settings.update({ where: { key: "app" }, data: { lastTopUpAt: new Date() } });
      await insertLoads(db, due, Math.min(elapsedMin, 600));
      const today = new Date();
      const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      await db.load.updateMany({ where: { status: "AVAILABLE", pickupDate: { lt: todayUtc } }, data: { status: "COVERED" } });
      // keep the open board around its initial size
      const open = await db.load.count({ where: { status: "AVAILABLE" } });
      if (open < INITIAL_LOADS * 0.8) await insertLoads(db, Math.min(200, INITIAL_LOADS - open), 12 * 60);
    }
  })().finally(() => {
    ensuring = null;
  });
  return ensuring;
}
