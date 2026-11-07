import { prisma } from "../db";
import { liveRng } from "../sim/rng";
import { greeting, initialState, respond, type DispatcherAction, type NegContext, type NegState } from "../sim/negotiation";
import { roadMiles } from "../sim/geo";
import { money, shortDay } from "../format";
import { roundTo } from "../sim/market";
import { AppError } from "../errors";
import { EQUIPMENT } from "../sim/data/freight";

async function contextFor(loadId: string): Promise<{ ctx: NegContext; load: NonNullable<Awaited<ReturnType<typeof loadWithBroker>>> }> {
  const load = await loadWithBroker(loadId);
  if (!load) throw new AppError("Load not found", 404);
  const ctx: NegContext = {
    rng: liveRng(),
    personality: load.broker.personality,
    brokerName: load.brokerName,
    contactName: load.contact.name,
    hasPostedRate: load.rate != null,
    load: {
      ref: load.ref,
      originCity: load.originCity,
      originState: load.originState,
      destCity: load.destCity,
      destState: load.destState,
      miles: load.miles,
      commodity: load.commodity,
      weight: load.weight,
      equipment: load.equipment,
      pickupDate: load.pickupDate,
      deliveryDate: load.deliveryDate,
      pickupWindow: load.pickup.appointment ? `appointment at ${load.pickup.windowStart}` : `FCFS ${load.pickup.windowStart}–${load.pickup.windowEnd}`,
      deliveryWindow: load.delivery.appointment ? `appointment at ${load.delivery.windowStart}` : `FCFS ${load.delivery.windowStart}–${load.delivery.windowEnd}`,
      cargo: { ...load.cargo, tarpSize: load.cargo.tarpSize ?? null, temp: load.cargo.temp ?? null },
      quickPayPct: load.broker.quickPayPct,
      daysToPay: load.broker.daysToPay,
      instructions: load.instructions,
    },
  };
  return { ctx, load };
}

function loadWithBroker(id: string) {
  return prisma.load.findUnique({ where: { id }, include: { broker: true } });
}

function toState(n: { status: NegState["status"]; postedRate: number; brokerOffer: number; ceiling: number; patience: number; rounds: number; lastAsk: number | null; agreedRate: number | null; flags: string[] }): NegState {
  return { status: n.status, postedRate: n.postedRate, brokerOffer: n.brokerOffer, ceiling: n.ceiling, patience: n.patience, rounds: n.rounds, lastAsk: n.lastAsk, agreedRate: n.agreedRate, flags: n.flags };
}

/** What the client is allowed to see (never the ceiling or patience). */
export function publicNegotiation(n: { id: string; loadId: string; channel: string; status: string; postedRate: number; brokerOffer: number; rounds: number; agreedRate: number | null; lastAsk: number | null; flags: string[]; messages: { from: string; text: string; offer: number | null; at: Date }[] }) {
  return {
    id: n.id,
    loadId: n.loadId,
    channel: n.channel,
    status: n.status,
    postedRate: n.postedRate,
    brokerOffer: n.brokerOffer,
    lastAsk: n.lastAsk,
    rounds: n.rounds,
    agreedRate: n.agreedRate,
    finalOffer: n.flags.includes("final"),
    messages: n.messages.map((m) => ({ from: m.from, text: m.text, offer: m.offer ?? null, at: m.at })),
  };
}
export type PublicNegotiation = ReturnType<typeof publicNegotiation>;

/** Starts (or resumes) a call/email with the broker of a load. */
export async function startNegotiation(loadId: string, channel: "call" | "email", truckId?: string | null) {
  const { ctx, load } = await contextFor(loadId);
  if (load.status === "COVERED") throw new AppError("This load was already covered by another carrier.", 409);
  if (!["AVAILABLE", "NEGOTIATING"].includes(load.status)) throw new AppError(`Load is ${load.status.toLowerCase().replace("_", " ")} — negotiation is closed.`, 409);

  const existing = await prisma.negotiation.findFirst({ where: { loadId, status: { in: ["OPEN", "ON_HOLD", "AGREED"] } }, orderBy: { createdAt: "desc" } });
  if (existing) return publicNegotiation(existing);

  // Calling back after hanging up: broker remembers the last number but is less patient.
  const previous = await prisma.negotiation.findFirst({ where: { loadId }, orderBy: { createdAt: "desc" } });
  if (previous?.status === "LOST") throw new AppError("The broker already gave this load to another carrier.", 409);

  // Busy line now and then
  if (channel === "call" && !previous && ctx.rng.chance(0.07)) {
    throw new AppError(`Busy signal — ${load.contact.name.split(" ")[0]} is on another line. Try again in a moment or send an email.`, 503);
  }

  const posted = load.rate ?? roundTo(load.marketRate * ctx.rng.float(0.86, 0.95), 25);
  let state = initialState(ctx, posted, load.brokerCeiling);
  if (previous) {
    state = { ...state, brokerOffer: previous.brokerOffer, patience: Math.max(1, previous.patience - 1), rounds: previous.rounds, flags: previous.flags };
  }

  let truckLine: string | undefined;
  let truckIssue: string | undefined;
  if (truckId) {
    const truck = await prisma.truck.findUnique({ where: { id: truckId } });
    if (truck) {
      const dh = roadMiles(truck.lat, truck.lng, load.originLat, load.originLng);
      truckLine = `I have a ${EQUIPMENT[truck.equipment].name.toLowerCase()} empty in ${truck.city}, ${truck.state}, about ${dh} miles out, available ${shortDay(truck.availableDate)}.`;
      const daysToPickup = (load.pickupDate.getTime() - Date.now()) / 86400000;
      if (truck.availableDate.getTime() > load.pickupDate.getTime()) {
        truckIssue = `Hmm, this one picks up ${shortDay(load.pickupDate)} — your truck won't be empty in time. I can't wait on it.`;
        state.patience = Math.max(1, state.patience - 2);
      } else if (dh > 250 && daysToPickup < 1) {
        truckIssue = `${dh} miles out? That's pretty far for a same-day pickup, I need someone close by. If you can make it on time we can talk.`;
        state.patience = Math.max(1, state.patience - 1);
      } else if (dh < 60) {
        truckIssue = rngLine(ctx, ["Perfect, you're right there.", "Oh nice, that's close.", "Great, that works location-wise."]);
      }
    }
  }

  type Msg = { from: "broker" | "dispatcher" | "system"; text: string; offer?: number };
  const quoted = load.rate != null || !!previous;
  let opening: Msg[];
  if (channel === "email") {
    opening = [
      {
        from: "broker",
        text: `Re: ${load.ref} ${load.originCity}, ${load.originState} → ${load.destCity}, ${load.destState}\n\nHi, thanks for reaching out. ${quoted ? `Load is available at ${money(state.brokerOffer)}.` : "Load is available — what rate do you need?"}\n\n${load.contact.name}\n${load.brokerName}`,
        offer: quoted ? state.brokerOffer : undefined,
      },
    ];
  } else if (previous) {
    opening = [
      { from: "broker", text: `${load.brokerName}, ${load.contact.name.split(" ")[0]}.` },
      { from: "dispatcher", text: `Hi, it's me again about ${load.ref}.` },
      { from: "broker", text: `Oh, you again. I'm still at ${money(state.brokerOffer)} on it.`, offer: state.brokerOffer },
    ];
  } else {
    opening = greeting(ctx, state, { truckLine, truckIssue });
  }

  const now = new Date();
  const neg = await prisma.negotiation.create({
    data: {
      loadId,
      channel,
      status: "OPEN",
      postedRate: state.postedRate,
      brokerOffer: state.brokerOffer,
      ceiling: state.ceiling,
      patience: state.patience,
      rounds: state.rounds,
      flags: state.flags,
      truckId: truckId || null,
      messages: opening.map((m, i) => ({ from: m.from, text: m.text, offer: m.offer ?? null, at: new Date(now.getTime() + i) })),
    },
  });
  if (load.status === "AVAILABLE") {
    await prisma.load.update({ where: { id: loadId }, data: { status: "NEGOTIATING", history: { push: { status: "NEGOTIATING", at: now, note: `${channel === "call" ? "Called" : "Emailed"} ${load.contact.name}` } } } });
  }
  return publicNegotiation(neg);
}

function rngLine(ctx: NegContext, lines: string[]) {
  return ctx.rng.pick(lines);
}

export async function actOnNegotiation(negotiationId: string, action: DispatcherAction) {
  const neg = await prisma.negotiation.findUnique({ where: { id: negotiationId } });
  if (!neg) throw new AppError("Conversation not found", 404);
  const { ctx, load } = await contextFor(neg.loadId);
  if (load.status === "COVERED") throw new AppError("Load already covered.", 409);

  const reply = respond(toState(neg), action, ctx);
  const s = reply.state;
  const now = Date.now();
  const updated = await prisma.negotiation.update({
    where: { id: neg.id },
    data: {
      status: s.status,
      brokerOffer: s.brokerOffer,
      patience: s.patience,
      rounds: s.rounds,
      lastAsk: s.lastAsk,
      agreedRate: s.agreedRate,
      flags: s.flags,
      messages: { push: reply.messages.map((m, i) => ({ from: m.from, text: m.text, offer: m.offer ?? null, at: new Date(now + i) })) },
    },
  });

  if (s.status === "LOST") {
    await prisma.load.update({ where: { id: load.id }, data: { status: "COVERED", history: { push: { status: "COVERED", at: new Date(), note: "Broker covered with another carrier" } } } });
  } else if (s.status === "CLOSED" && load.status === "NEGOTIATING" && !s.agreedRate) {
    await prisma.load.update({ where: { id: load.id }, data: { status: "AVAILABLE", history: { push: { status: "AVAILABLE", at: new Date(), note: "Call ended without a deal" } } } });
  } else if (s.status === "AGREED" && neg.status !== "AGREED") {
    await prisma.load.update({ where: { id: load.id }, data: { history: { push: { status: "NEGOTIATING", at: new Date(), note: `Rate agreed at ${money(s.agreedRate)}` } } } });
  }
  return publicNegotiation(updated);
}

export async function getNegotiation(id: string) {
  const n = await prisma.negotiation.findUnique({ where: { id } });
  return n ? publicNegotiation(n) : null;
}
