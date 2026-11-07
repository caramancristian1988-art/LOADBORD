import type { LoadStatus } from "@prisma/client";
import { prisma } from "../db";
import { AppError } from "../errors";
import { canHaul, equipName, NEXT_STATUS, STATUS_LABEL } from "../sim/equipment";
import { roadMiles } from "../sim/geo";
import { money, shortDay } from "../format";
import { evaluateActiveAttempt } from "./training-service";

export interface BookInput {
  loadId: string;
  rate: number;
  truckId: string;
  driverId?: string | null;
}

/** Validates truck/load fit. Returns hard errors and soft warnings. */
async function checkFit(loadId: string, truckId: string) {
  const [load, truck] = await Promise.all([
    prisma.load.findUnique({ where: { id: loadId } }),
    prisma.truck.findUnique({ where: { id: truckId }, include: { driver: true } }),
  ]);
  if (!load) throw new AppError("Load not found", 404);
  if (!truck) throw new AppError("Truck not found", 404);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!canHaul(truck.equipment, load.equipment)) errors.push(`Truck #${truck.number} is a ${equipName(truck.equipment)} — this load needs a ${equipName(load.equipment)}.`);
  if (load.weight > truck.maxWeight) errors.push(`Load weighs ${load.weight.toLocaleString("en-US")} lbs; truck #${truck.number} max is ${truck.maxWeight.toLocaleString("en-US")} lbs.`);
  if (load.lengthFt > truck.trailerLength && !load.cargo.oversize) errors.push(`Load needs ${load.lengthFt} ft of deck; trailer is ${truck.trailerLength} ft.`);
  if (truck.status === "OUT_OF_SERVICE") errors.push(`Truck #${truck.number} is out of service.`);
  if (truck.availableDate.getTime() > load.pickupDate.getTime()) warnings.push(`Truck #${truck.number} is available ${shortDay(truck.availableDate)} but pickup is ${shortDay(load.pickupDate)}.`);
  if (truck.status === "ON_LOAD") warnings.push(`Truck #${truck.number} is currently on another load.`);
  const deadhead = roadMiles(truck.lat, truck.lng, load.originLat, load.originLng);
  if (deadhead > 250) warnings.push(`Deadhead from ${truck.city}, ${truck.state} is ${deadhead} miles.`);
  if (load.cargo.oversize && load.lengthFt > truck.trailerLength) warnings.push("Overhang/oversize — make sure the permits cover it.");
  return { load, truck, deadhead, errors, warnings };
}

export async function previewFit(loadId: string, truckId: string) {
  const { deadhead, errors, warnings } = await checkFit(loadId, truckId);
  return { deadhead, errors, warnings };
}

export async function bookLoad(input: BookInput) {
  const { load, truck, deadhead, errors } = await checkFit(input.loadId, input.truckId);
  if (errors.length) throw new AppError(errors.join(" "), 422);
  if (!["AVAILABLE", "NEGOTIATING"].includes(load.status)) throw new AppError(`Load is already ${STATUS_LABEL[load.status].toLowerCase()}.`, 409);

  const neg = await prisma.negotiation.findFirst({ where: { loadId: load.id }, orderBy: { createdAt: "desc" } });
  if (neg?.status === "LOST") throw new AppError("The broker gave this load to another carrier.", 409);

  // What the broker actually agreed to (or the posted rate when booking straight off the board)
  const agreed = neg?.status === "AGREED" ? neg.agreedRate! : load.rate;
  if (agreed == null) throw new AppError("This load has no posted rate. Call or email the broker to agree on a rate first.", 422);
  const rate = Math.round(input.rate);
  if (!(rate > 0)) throw new AppError("Enter the agreed rate.", 422);
  if (rate > agreed) throw new AppError(`The broker agreed to ${money(agreed)}. You can't book at ${money(rate)} — negotiate first.`, 422);

  const driverId = input.driverId || truck.driverId;
  if (!driverId) throw new AppError(`Truck #${truck.number} has no driver. Assign a driver on My Trucks or pick one here.`, 422);

  const now = new Date();
  const rateConNo = `RC-${load.ref.replace(/\D/g, "")}-${String(now.getTime()).slice(-4)}`;
  const updated = await prisma.load.update({
    where: { id: load.id },
    data: {
      status: "BOOKED",
      bookedRate: rate,
      bookedAt: now,
      rateConNo,
      truckId: truck.id,
      driverId,
      bookedDeadhead: deadhead,
      history: { push: { status: "BOOKED", at: now, note: `Booked at ${money(rate)} on truck #${truck.number}` } },
    },
  });
  if (neg && neg.status !== "AGREED") await prisma.negotiation.update({ where: { id: neg.id }, data: { status: "AGREED", agreedRate: rate } });
  await prisma.truck.update({ where: { id: truck.id }, data: { status: "ON_LOAD", driverId } });

  const training = await evaluateActiveAttempt(load.id).catch(() => null);
  return { load: updated, training };
}

export async function updateLoadStatus(loadId: string, status: LoadStatus, note?: string) {
  const load = await prisma.load.findUnique({ where: { id: loadId } });
  if (!load) throw new AppError("Load not found", 404);
  const allowed = NEXT_STATUS[load.status] ?? [];
  if (!allowed.includes(status)) throw new AppError(`Can't move a ${STATUS_LABEL[load.status]} load to ${STATUS_LABEL[status]}.`, 422);
  if ((status === "DISPATCHED" || status === "IN_TRANSIT") && (!load.truckId || !load.driverId)) throw new AppError("Assign a truck and driver before dispatching.", 422);

  const now = new Date();
  const data: Parameters<typeof prisma.load.update>[0]["data"] = {
    status,
    history: { push: { status, at: now, note: note || null } },
  };
  if (status === "DELIVERED") data.deliveredAt = now;
  await prisma.load.update({ where: { id: loadId }, data });

  if (status === "CANCELLED" || status === "AVAILABLE") {
    await prisma.negotiation.updateMany({ where: { loadId, status: { in: ["OPEN", "ON_HOLD", "AGREED"] } }, data: { status: "CLOSED" } });
    if (load.truckId) await releaseTruck(load.truckId, loadId);
  }
  if (status === "DELIVERED" && load.truckId) {
    // truck is now empty at the receiver
    await prisma.truck.update({
      where: { id: load.truckId },
      data: { city: load.destCity, state: load.destState, lat: load.destLat, lng: load.destLng, availableDate: load.deliveryDate, status: "AVAILABLE" },
    });
  }
}

async function releaseTruck(truckId: string, exceptLoadId: string) {
  const other = await prisma.load.count({ where: { truckId, id: { not: exceptLoadId }, status: { in: ["BOOKED", "DISPATCHED", "IN_TRANSIT"] } } });
  if (!other) await prisma.truck.update({ where: { id: truckId }, data: { status: "AVAILABLE" } });
}

export async function assignLoad(loadId: string, truckId: string, driverId?: string | null) {
  const { load, truck, deadhead, errors } = await checkFit(loadId, truckId);
  if (errors.length) throw new AppError(errors.join(" "), 422);
  if (!["BOOKED", "DISPATCHED"].includes(load.status)) throw new AppError("Only booked loads can be reassigned.", 422);
  const finalDriver = driverId || truck.driverId;
  if (!finalDriver) throw new AppError(`Truck #${truck.number} has no driver.`, 422);
  const prevTruck = load.truckId;
  await prisma.load.update({
    where: { id: loadId },
    data: { truckId, driverId: finalDriver, bookedDeadhead: deadhead, history: { push: { status: load.status, at: new Date(), note: `Assigned to truck #${truck.number}` } } },
  });
  await prisma.truck.update({ where: { id: truckId }, data: { status: "ON_LOAD" } });
  if (prevTruck && prevTruck !== truckId) await releaseTruck(prevTruck, loadId);
}
