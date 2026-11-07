import { z } from "zod";
import { prisma } from "../db";
import { AppError } from "../errors";
import { findCity } from "../sim/geo";
import { EQUIPMENT } from "../sim/data/freight";
import { dayFromIso } from "../format";

const equipEnum = z.enum(["F", "SD", "CN", "HS", "V", "R", "PO", "BT"]);

export const truckSchema = z.object({
  number: z.string().trim().min(1, "Truck number is required").max(12),
  equipment: equipEnum,
  trailerLength: z.coerce.number().int().min(10).max(60),
  maxWeight: z.coerce.number().int().min(1000).max(80000),
  location: z.string().trim().min(3, "Pick the truck's current city"),
  availableDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the next available date"),
  status: z.enum(["AVAILABLE", "ON_LOAD", "OUT_OF_SERVICE"]).default("AVAILABLE"),
  driverId: z.string().optional().nullable(),
  notes: z.string().max(300).optional().nullable(),
});

export const driverSchema = z.object({
  name: z.string().trim().min(2, "Driver name is required").max(60),
  phone: z.string().trim().min(7, "Driver phone is required").max(20),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")).nullable(),
  cdlState: z.string().trim().length(2, "CDL state = 2 letters").toUpperCase(),
  hosHoursLeft: z.coerce.number().min(0).max(70).default(70),
});

function zodMessage(e: z.ZodError) {
  return e.issues.map((i) => i.message).join(" ");
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new AppError(zodMessage(r.error), 422);
  return r.data;
}

function truckData(input: z.infer<typeof truckSchema>) {
  const city = findCity(input.location);
  if (!city) throw new AppError(`"${input.location}" is not a known market. Pick a city from the list.`, 422);
  return {
    number: input.number,
    equipment: input.equipment,
    trailerLength: input.trailerLength,
    maxWeight: input.maxWeight,
    city: city.n,
    state: city.s,
    lat: city.lat,
    lng: city.lon,
    availableDate: dayFromIso(input.availableDate),
    status: input.status,
    driverId: input.driverId || null,
    notes: input.notes || null,
  };
}

export async function createTruck(raw: unknown) {
  const input = parse(truckSchema, raw);
  if (await prisma.truck.findUnique({ where: { number: input.number } })) throw new AppError(`Truck #${input.number} already exists.`, 409);
  return prisma.truck.create({ data: truckData(input) });
}

export async function updateTruck(id: string, raw: unknown) {
  const input = parse(truckSchema, raw);
  const dup = await prisma.truck.findUnique({ where: { number: input.number } });
  if (dup && dup.id !== id) throw new AppError(`Truck #${input.number} already exists.`, 409);
  return prisma.truck.update({ where: { id }, data: truckData(input) });
}

export async function deleteTruck(id: string) {
  const active = await prisma.load.count({ where: { truckId: id, status: { in: ["BOOKED", "DISPATCHED", "IN_TRANSIT"] } } });
  if (active) throw new AppError("This truck has active loads. Reassign or deliver them first.", 409);
  await prisma.load.updateMany({ where: { truckId: id }, data: { truckId: null } });
  await prisma.truck.delete({ where: { id } });
}

export async function createDriver(raw: unknown) {
  const input = parse(driverSchema, raw);
  return prisma.driver.create({ data: { ...input, email: input.email || null } });
}

export async function updateDriver(id: string, raw: unknown) {
  const input = parse(driverSchema, raw);
  return prisma.driver.update({ where: { id }, data: { ...input, email: input.email || null } });
}

export async function deleteDriver(id: string) {
  const active = await prisma.load.count({ where: { driverId: id, status: { in: ["BOOKED", "DISPATCHED", "IN_TRANSIT"] } } });
  if (active) throw new AppError("This driver has active loads.", 409);
  await prisma.truck.updateMany({ where: { driverId: id }, data: { driverId: null } });
  await prisma.load.updateMany({ where: { driverId: id }, data: { driverId: null } });
  await prisma.driver.delete({ where: { id } });
}

export function defaultsFor(equipment: keyof typeof EQUIPMENT) {
  return { trailerLength: EQUIPMENT[equipment].len, maxWeight: EQUIPMENT[equipment].maxWt };
}

export const settingsSchema = z.object({
  carrierName: z.string().trim().min(2),
  carrierMc: z.string().trim().min(3),
  carrierDot: z.string().trim().min(3),
  carrierAddress: z.string().trim().min(3),
  carrierCity: z.string().trim().min(2),
  carrierState: z.string().trim().length(2).toUpperCase(),
  carrierZip: z.string().trim().min(5).max(10),
  carrierPhone: z.string().trim().min(7),
  carrierEmail: z.string().trim().email(),
  dispatcherName: z.string().trim().min(2),
  costPerMile: z.coerce.number().min(0.5).max(5),
  targetRpm: z.coerce.number().min(0.5).max(10),
});

export async function updateSettings(raw: unknown) {
  const input = parse(settingsSchema, raw);
  return prisma.settings.update({ where: { key: "app" }, data: input });
}
