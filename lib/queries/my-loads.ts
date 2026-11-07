import type { LoadStatus, Prisma } from "@prisma/client";
import { prisma } from "../db";

export const MY_TABS = ["AVAILABLE", "NEGOTIATING", "BOOKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "CANCELLED"] as const;
export type MyTab = (typeof MY_TABS)[number];

async function contactedIds() {
  return (await prisma.negotiation.findMany({ select: { loadId: true }, distinct: ["loadId"] })).map((n) => n.loadId);
}

function whereFor(tab: MyTab, contacted: string[]): Prisma.LoadWhereInput {
  // "Available" = loads the dispatcher called about that went back on the board
  return tab === "AVAILABLE" ? { status: "AVAILABLE", id: { in: contacted } } : { status: tab as LoadStatus };
}

export async function getMyLoadCounts() {
  const contacted = await contactedIds();
  const pairs = await Promise.all(MY_TABS.map(async (t) => [t, await prisma.load.count({ where: whereFor(t, contacted) })] as const));
  return { counts: Object.fromEntries(pairs) as Record<MyTab, number>, contacted };
}

export async function getMyLoadRows(tab: MyTab, contacted: string[]) {
  const loads = await prisma.load.findMany({
    where: whereFor(tab, contacted),
    orderBy: tab === "NEGOTIATING" || tab === "AVAILABLE" ? { postedAt: "desc" } : [{ pickupDate: "asc" }, { bookedAt: "desc" }],
    take: 200,
    include: {
      truck: { select: { id: true, number: true } },
      driver: { select: { id: true, name: true, phone: true } },
      broker: { select: { creditScore: true, daysToPay: true } },
      negotiations: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, brokerOffer: true, agreedRate: true, postedRate: true, rounds: true, channel: true } },
    },
  });
  return loads.map(({ brokerCeiling: _c, negotiations, ...l }) => {
    void _c;
    return { ...l, negotiation: negotiations[0] ?? null };
  });
}
export type MyLoadRow = Awaited<ReturnType<typeof getMyLoadRows>>[number];
