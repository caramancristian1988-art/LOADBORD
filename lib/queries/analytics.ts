import { prisma } from "../db";
import { equipName } from "../sim/equipment";

const ACTIVE = ["BOOKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED"] as const;

export async function getAnalytics() {
  const [settings, loads, negotiations, attempts, trucks] = await Promise.all([
    prisma.settings.findUnique({ where: { key: "app" } }),
    prisma.load.findMany({
      where: { status: { in: [...ACTIVE] } },
      select: {
        id: true, ref: true, status: true, bookedRate: true, rate: true, miles: true, bookedDeadhead: true, equipment: true, brokerName: true,
        bookedAt: true, truckId: true, driverId: true, marketRate: true, originState: true, destState: true,
      },
    }),
    prisma.negotiation.findMany({ select: { status: true, postedRate: true, agreedRate: true, channel: true, rounds: true } }),
    prisma.trainingAttempt.findMany({ where: { status: "COMPLETED" }, select: { difficulty: true, score: true, title: true, completedAt: true }, orderBy: { completedAt: "desc" } }),
    prisma.truck.findMany({ include: { driver: true } }),
  ]);
  const cpm = settings?.costPerMile ?? 1.85;

  const revenue = loads.reduce((a, l) => a + (l.bookedRate ?? 0), 0);
  const loadedMiles = loads.reduce((a, l) => a + l.miles, 0);
  const deadheadMiles = loads.reduce((a, l) => a + (l.bookedDeadhead ?? 0), 0);
  const totalMiles = loadedMiles + deadheadMiles;
  const delivered = loads.filter((l) => l.status === "DELIVERED");
  const deliveredRevenue = delivered.reduce((a, l) => a + (l.bookedRate ?? 0), 0);
  const marketTotal = loads.reduce((a, l) => a + l.marketRate, 0);

  const group = <K extends string>(key: (l: (typeof loads)[number]) => K | null) => {
    const m = new Map<K, { revenue: number; loads: number; miles: number; deadhead: number }>();
    for (const l of loads) {
      const k = key(l);
      if (k == null) continue;
      const g = m.get(k) ?? { revenue: 0, loads: 0, miles: 0, deadhead: 0 };
      g.revenue += l.bookedRate ?? 0;
      g.loads += 1;
      g.miles += l.miles;
      g.deadhead += l.bookedDeadhead ?? 0;
      m.set(k, g);
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, ...v, rpm: v.miles ? v.revenue / v.miles : 0 })).sort((a, b) => b.revenue - a.revenue);
  };

  const truckLabel = new Map(trucks.map((t) => [t.id, `#${t.number} · ${t.driver?.name ?? "no driver"}`]));
  const byTruck = group((l) => (l.truckId ? truckLabel.get(l.truckId) ?? "Removed truck" : null));
  const byEquipment = group((l) => equipName(l.equipment));
  const byBroker = group((l) => l.brokerName).slice(0, 8);

  // bookings per day for the last 14 days
  const days: { day: string; revenue: number; loads: number }[] = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    days.push({ day: `${d.getMonth() + 1}/${d.getDate()}`, revenue: 0, loads: 0 });
  }
  for (const l of loads) {
    if (!l.bookedAt) continue;
    const diff = Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(l.bookedAt.getFullYear(), l.bookedAt.getMonth(), l.bookedAt.getDate()).getTime()) / 86400000);
    if (diff >= 0 && diff < 14) {
      days[13 - diff].revenue += l.bookedRate ?? 0;
      days[13 - diff].loads += 1;
    }
  }

  const closed = negotiations.filter((n) => n.status !== "OPEN" && n.status !== "ON_HOLD");
  const won = negotiations.filter((n) => n.status === "AGREED");
  const avgGain = won.length ? won.reduce((a, n) => a + ((n.agreedRate ?? n.postedRate) - n.postedRate), 0) / won.length : 0;

  const byDifficulty = (["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const).map((d) => {
    const xs = attempts.filter((a) => a.difficulty === d);
    return { difficulty: d, count: xs.length, avg: xs.length ? xs.reduce((a, x) => a + (x.score ?? 0), 0) / xs.length : null };
  });

  return {
    costPerMile: cpm,
    totals: {
      bookedLoads: loads.length,
      deliveredLoads: delivered.length,
      revenue,
      deliveredRevenue,
      avgRpm: loadedMiles ? revenue / loadedMiles : null,
      allInRpm: totalMiles ? revenue / totalMiles : null,
      loadedMiles,
      deadheadMiles,
      deadheadPct: totalMiles ? deadheadMiles / totalMiles : null,
      estProfit: revenue - totalMiles * cpm,
      avgPerLoad: loads.length ? revenue / loads.length : null,
      vsMarket: marketTotal ? revenue / marketTotal : null,
    },
    byTruck,
    byEquipment,
    byBroker,
    days,
    negotiation: {
      total: negotiations.length,
      won: won.length,
      lost: negotiations.filter((n) => n.status === "LOST").length,
      successRate: closed.length ? won.length / closed.length : null,
      avgGain,
      calls: negotiations.filter((n) => n.channel === "call").length,
      emails: negotiations.filter((n) => n.channel === "email").length,
    },
    training: { attempts: attempts.length, avg: attempts.length ? attempts.reduce((a, x) => a + (x.score ?? 0), 0) / attempts.length : null, byDifficulty, recent: attempts.slice(0, 5) },
  };
}
export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;
