import { connection } from "next/server";
import { body, handle } from "@/lib/route";
import { prisma } from "@/lib/db";
import { createTruck } from "@/lib/services/fleet-service";

export async function GET() {
  // live data: never prerender at build time
  await connection();
  return handle(async () => {
    const [trucks, drivers] = await Promise.all([
      prisma.truck.findMany({ include: { driver: true }, orderBy: { number: "asc" } }),
      prisma.driver.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    ]);
    return { trucks, drivers };
  });
}

export async function POST(req: Request) {
  const b = await body(req);
  return handle(() => createTruck(b));
}
