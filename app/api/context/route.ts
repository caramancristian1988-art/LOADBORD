import { connection } from "next/server";
import { handle } from "@/lib/route";
import { prisma } from "@/lib/db";

/** Everything the load actions (call / book / training) need on the client. */
export async function GET() {
  // live data: never prerender at build time
  await connection();
  return handle(async () => {
    const [trucks, drivers, settings, attempt] = await Promise.all([
      prisma.truck.findMany({ include: { driver: { select: { id: true, name: true, phone: true } } }, orderBy: { number: "asc" } }),
      prisma.driver.findMany({ where: { active: true }, select: { id: true, name: true, phone: true }, orderBy: { name: "asc" } }),
      prisma.settings.findUnique({ where: { key: "app" }, select: { costPerMile: true, targetRpm: true } }),
      prisma.trainingAttempt.findFirst({ where: { status: "ACTIVE" }, select: { id: true, title: true, brief: true, scenarioKey: true, difficulty: true } }),
    ]);
    return { trucks, drivers, costPerMile: settings?.costPerMile ?? 1.85, targetRpm: settings?.targetRpm ?? 2.5, attempt };
  });
}
