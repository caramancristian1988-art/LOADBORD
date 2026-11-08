import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { FleetManager } from "@/components/fleet/FleetManager";

export const metadata: Metadata = { title: "My Trucks" };

async function Fleet() {
  await connection();
  const [trucks, drivers, booked] = await Promise.all([
    prisma.truck.findMany({ include: { driver: true }, orderBy: { number: "asc" } }),
    prisma.driver.findMany({ orderBy: { name: "asc" }, include: { trucks: { select: { number: true } } } }),
    prisma.load.findMany({
      where: { status: { in: ["BOOKED", "DISPATCHED", "IN_TRANSIT"] } },
      select: { id: true, ref: true, status: true, truckId: true, originCity: true, originState: true, destCity: true, destState: true, pickupDate: true, deliveryDate: true, equipment: true, weight: true, bookedRate: true },
      orderBy: { pickupDate: "asc" },
    }),
  ]);
  return <FleetManager data={JSON.parse(JSON.stringify({ trucks, drivers, booked }))} />;
}

export default function TrucksPage() {
  return (
    <div className="p-3 md:p-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-bold">My Trucks</h1>
        <p className="text-[13px] text-muted">Your fleet and drivers. Keep locations and availability current — they drive deadhead, broker reactions and booking checks.</p>
      </div>
      <Suspense
        fallback={
          <div className="card space-y-3 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="skeleton h-9" />
            ))}
          </div>
        }
      >
        <Fleet />
      </Suspense>
    </div>
  );
}
