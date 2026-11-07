import type { Difficulty } from "@prisma/client";
import { prisma } from "../db";
import { AppError } from "../errors";
import { liveRng } from "../sim/rng";
import { buildScenario, evaluate, TEMPLATE_BY_KEY, type AnchorLoad } from "../sim/training";
import type { EquipCode } from "../sim/types";

async function anchors(): Promise<AnchorLoad[]> {
  const loads = await prisma.load.findMany({
    where: { status: "AVAILABLE" },
    select: {
      id: true, originCity: true, originState: true, originLat: true, originLng: true, destCity: true, destState: true, destLat: true, destLng: true,
      equipment: true, miles: true, weight: true, rate: true, rpm: true, marketRate: true, pickupDate: true, cargo: { select: { oversize: true, permit: true } },
    },
    take: 1200,
  });
  return loads as AnchorLoad[];
}

export async function getActiveAttempt() {
  return prisma.trainingAttempt.findFirst({ where: { status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
}

export async function startScenario(difficulty: Difficulty, key?: string) {
  await prisma.trainingAttempt.updateMany({ where: { status: "ACTIVE" }, data: { status: "ABANDONED", completedAt: new Date() } });
  const draft = buildScenario(liveRng(), difficulty, await anchors(), key);
  if (!draft) throw new AppError("No suitable loads on the board for that scenario right now — refresh the market or try another one.", 409);
  return prisma.trainingAttempt.create({
    data: {
      scenarioKey: draft.key,
      title: draft.title,
      brief: draft.brief,
      difficulty,
      criteria: { ...draft.criteria, equipment: draft.criteria.equipment },
      hints: draft.hints,
    },
  });
}

export async function abandonAttempt(id: string) {
  await prisma.trainingAttempt.update({ where: { id }, data: { status: "ABANDONED", completedAt: new Date() } });
}

export const needsVerdict = (scenarioKey: string) => scenarioKey in TEMPLATE_BY_KEY && scenarioKey === "deadhead-profit";

/**
 * Grades the active attempt against a load. Called automatically on booking
 * (unless the scenario needs a profitability verdict) and from the "Submit" button.
 */
export async function evaluateActiveAttempt(loadId: string, verdict?: boolean | null) {
  const attempt = await getActiveAttempt();
  if (!attempt) return null;
  if (needsVerdict(attempt.scenarioKey) && verdict == null) return null;
  return gradeAttempt(attempt.id, loadId, verdict);
}

export async function gradeAttempt(attemptId: string, loadId: string, verdict?: boolean | null) {
  const attempt = await prisma.trainingAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.status !== "ACTIVE") throw new AppError("No active training scenario.", 409);
  const [load, settings, neg] = await Promise.all([
    prisma.load.findUnique({ where: { id: loadId } }),
    prisma.settings.findUnique({ where: { key: "app" } }),
    prisma.negotiation.findFirst({ where: { loadId }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!load) throw new AppError("Load not found", 404);
  const lastNeg = await prisma.negotiation.findFirst({ where: { loadId }, orderBy: { createdAt: "desc" } });
  const finalRate = load.bookedRate ?? (lastNeg?.status === "AGREED" ? lastNeg.agreedRate : null) ?? load.rate;
  if (finalRate == null) throw new AppError("Agree on a rate with the broker first — this load has no posted rate.", 422);

  const c = attempt.criteria;
  const result = evaluate({
    scenarioKey: attempt.scenarioKey,
    criteria: {
      equipment: c.equipment as EquipCode[],
      startCity: c.startCity ?? undefined,
      startState: c.startState ?? undefined,
      startLat: c.startLat ?? undefined,
      startLng: c.startLng ?? undefined,
      maxDeadhead: c.maxDeadhead ?? undefined,
      destCity: c.destCity ?? undefined,
      destState: c.destState ?? undefined,
      destLat: c.destLat ?? undefined,
      destLng: c.destLng ?? undefined,
      destRadius: c.destRadius ?? undefined,
      minRpm: c.minRpm ?? undefined,
      minNegotiationGain: c.minNegotiationGain ?? undefined,
      maxWeight: c.maxWeight ?? undefined,
      pickupBy: c.pickupBy ?? undefined,
    },
    load: { ...load, cargo: { oversize: load.cargo.oversize, permit: load.cargo.permit } } as AnchorLoad,
    finalRate,
    postedRate: load.rate,
    negotiationStart: neg?.postedRate ?? null,
    booked: load.status === "BOOKED",
    costPerMile: settings?.costPerMile ?? 1.85,
    verdict,
  });

  return prisma.trainingAttempt.update({
    where: { id: attempt.id },
    data: { status: "COMPLETED", completedAt: new Date(), loadId, score: result.score, checks: result.checks, summary: result.summary },
  });
}
