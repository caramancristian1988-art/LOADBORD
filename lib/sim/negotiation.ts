// Broker negotiation engine. Pure functions: given the current negotiation state and a
// dispatcher action, produce the broker's reply and the next state. The broker's ceiling
// (the most it will pay) never leaves the server.
import { PERSONALITY, roundTo } from "./market";
import type { Rng } from "./rng";
import type { PersonalityKey } from "./types";
import { money } from "../format";
import { EQUIPMENT } from "./data/freight";

export type NegStatus = "OPEN" | "ON_HOLD" | "AGREED" | "LOST" | "CLOSED";

export interface NegState {
  status: NegStatus;
  postedRate: number;
  brokerOffer: number;
  ceiling: number;
  patience: number;
  rounds: number;
  lastAsk: number | null;
  agreedRate: number | null;
  flags: string[];
}

export interface NegContext {
  rng: Rng;
  personality: PersonalityKey;
  brokerName: string;
  contactName: string;
  hasPostedRate: boolean;
  load: {
    ref: string;
    originCity: string;
    originState: string;
    destCity: string;
    destState: string;
    miles: number;
    commodity: string;
    weight: number;
    equipment: string;
    pickupDate: Date;
    deliveryDate: Date;
    pickupWindow: string;
    deliveryWindow: string;
    cargo: { lengthFt: number; widthIn: number; heightIn: number; pieces: number; tarps: boolean; tarpSize: string | null; chains: boolean; straps: boolean; oversize: boolean; permit: boolean; temp: string | null };
    quickPayPct: number;
    daysToPay: number;
    instructions: string[];
  };
}

export type DispatcherAction =
  | { type: "offer"; amount: number; text?: string }
  | { type: "accept" }
  | { type: "ask"; topic: QuestionTopic; text?: string }
  | { type: "say"; text: string }
  | { type: "resume" }
  | { type: "hangup" };

export type QuestionTopic = "available" | "weight" | "dims" | "tarps" | "pickup" | "delivery" | "detention" | "quickpay" | "commodity" | "stops" | "rate";

export interface Reply {
  state: NegState;
  messages: { from: "broker" | "dispatcher" | "system"; text: string; offer?: number }[];
}

const has = (s: NegState, f: string) => s.flags.includes(f);
const flag = (s: NegState, f: string) => (has(s, f) ? s.flags : [...s.flags, f]);

function fill(rng: Rng, lines: string[], vars: Record<string, string>) {
  return rng.pick(lines).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

// ---------- phrasing ----------

const GREETING: Record<PersonalityKey, string[]> = {
  corporate: ["Thank you for calling {broker}, this is {name}. How can I help you?", "{broker}, {name} speaking. What load are you calling on?"],
  flexible: ["{broker}, this is {name}. What can I do for you?", "Hey, {name} here with {broker}. Which load you calling about?"],
  friendly: ["Hey there! {name} with {broker}. How's your day going?", "{broker}, this is {name}! What can I help you with today?"],
  lowballer: ["{broker}, {name}.", "Yeah, {name} here. Which load?"],
  firm: ["{broker}, this is {name}.", "{name}, {broker}. Go ahead."],
  hustler: ["{name} with {broker}, talk to me!", "Yo, {name} here, {broker}. I got a lot of calls on these — which one?"],
};

const OPENING_POSTED: Record<PersonalityKey, string[]> = {
  corporate: ["Yes, {ref} {lane} is still available. We have it posted at {posted}.", "That one is open. The rate on {lane} is {posted} all in."],
  flexible: ["Yep, still got it. {lane}, paying {posted}. What do you think?", "Still open. I've got {posted} on it — what do you need?"],
  friendly: ["Oh yeah, that one's still available! {lane}, I've got {posted} on it.", "It sure is. {posted} for {lane}. Where's your truck at?"],
  lowballer: ["Still open. {posted}, that's the rate.", "Yeah it's there. {posted}. Lane's soft right now honestly."],
  firm: ["It's available. {posted}, all in.", "Open. Rate is {posted}."],
  hustler: ["It's still here but going fast, I've got three carriers calling. {posted} on it.", "Still have it for now. {posted} — you want it?"],
};

const OPENING_NORATE: Record<PersonalityKey, string[]> = {
  corporate: ["That load is available. What rate would you need for {lane}?", "It's open. We're taking offers on {lane} — what's your rate?"],
  flexible: ["Still got it. What do you need to haul it?", "Yep. {lane} — give me a number."],
  friendly: ["Sure is! What would you need to move {lane}?", "It's open. What rate works for you on that one?"],
  lowballer: ["It's open. What are you looking for? Keep it reasonable.", "Yeah. What do you need on it?"],
  firm: ["Available. What's your rate?", "Open. Make me an offer."],
  hustler: ["Got it, but I've got a few offers already. What do you need?", "Hot load. Give me your best number."],
};

const COUNTER: Record<PersonalityKey, string[]> = {
  corporate: ["I can't get to {ask}. I can do {counter}.", "That's above what the customer is paying. I could go {counter}.", "Best I can offer right now is {counter}."],
  flexible: ["{ask} is a bit rich. Meet me at {counter}?", "Can you do {counter}? I can make that work.", "How about {counter}? Let's get it moving."],
  friendly: ["Ah, that's a little high for me. Could you do {counter}?", "I want to help you out — I can do {counter}.", "Let's meet somewhere — {counter} work for you?"],
  lowballer: ["{ask}? No way. {counter} and that's being generous.", "That's too high. Can you do {counter}?", "Lane doesn't pay that. {counter}."],
  firm: ["I can do {counter}. That's about it.", "{counter}. Not much room on this one."],
  hustler: ["I've got a guy at less than that. Do {counter} and it's yours.", "Come on, {counter} and I book you right now.", "Another carrier is offering lower. {counter}, final-ish."],
};

const TOO_HIGH: Record<PersonalityKey, string[]> = {
  corporate: ["That's well over our budget for this lane. I can't present that to the customer.", "We're not anywhere near {ask} on this one, I'm sorry."],
  flexible: ["Whoa, {ask}? We're nowhere close to that.", "That's way too high. This lane doesn't pay that."],
  friendly: ["Oof, {ask} is way out of range for me, sorry!", "I wish I could, but {ask} is way more than this load pays."],
  lowballer: ["{ask}? You're dreaming. Next.", "Not happening. That's crazy money for this lane."],
  firm: ["No. That's far above the rate.", "Not at {ask}."],
  hustler: ["{ask}?! I've got carriers at half that. Come on.", "Ha, no. Way too high, buddy."],
};

const FINAL: Record<PersonalityKey, string[]> = {
  corporate: ["{counter} is the absolute max I'm authorized to pay.", "I've checked — {counter} is the best we can do."],
  flexible: ["Honestly {counter} is all I've got on it.", "{counter} is the ceiling, I can't go higher."],
  friendly: ["I really want to make it work — {counter} is as high as I can go.", "{counter} is my best, I promise."],
  lowballer: ["{counter}. Final. Take it or leave it.", "{counter}, that's it, I'm not going higher."],
  firm: ["{counter}. That's final.", "Final number: {counter}."],
  hustler: ["{counter} and I need an answer now, I've got another carrier on the other line.", "{counter}, last call — yes or no?"],
};

const ACCEPT: Record<PersonalityKey, string[]> = {
  corporate: ["Okay, {rate} works. I'll send the rate confirmation over.", "Approved at {rate}. Let me get your MC to set up the load."],
  flexible: ["Alright, {rate}, let's do it.", "Deal. {rate}. Sending the rate con."],
  friendly: ["You got it! {rate} it is. Pleasure doing business.", "Done deal at {rate}! I'll shoot the rate con over."],
  lowballer: ["Fine. {rate}. Don't be late.", "{rate}. Book it. Rate con coming."],
  firm: ["{rate}. Done.", "Okay, {rate}. Booking you."],
  hustler: ["Boom, {rate}, you're booked! Rate con in your inbox in five.", "Let's go, {rate}. Booked!"],
};

const WALK: Record<PersonalityKey, string[]> = {
  corporate: ["I'm going to have to go with another carrier. Thank you for your time.", "We've covered it with another carrier. Thanks for calling."],
  flexible: ["Sorry, I just covered it with someone else.", "I'm gonna pass, we're too far apart. Thanks."],
  friendly: ["Ah, I'm sorry — I've got to give it to another carrier. Call me on the next one!", "We just can't get there. I'll keep you in mind though!"],
  lowballer: ["Forget it, I'll find someone else.", "Not worth it. Covered."],
  firm: ["We're done here. I'll cover it elsewhere.", "No deal. Thanks."],
  hustler: ["Too slow, my guy, just booked another truck.", "Another carrier took it. Next time jump on it."],
};

const HOLD = ["Let me check with my customer and see what I can do. Hold on a sec.", "Hang on, let me run that by my shipper.", "Give me a minute, I'll check with my manager."];
const PRESSURE = ["Just so you know, I have another carrier interested at a lower rate.", "I've got two other trucks asking about this one.", "I need to cover this in the next 15 minutes."];

// ---------- engine ----------

export function initialState(ctx: NegContext, posted: number, ceiling: number): NegState {
  const p = PERSONALITY[ctx.personality];
  return {
    status: "OPEN",
    postedRate: posted,
    brokerOffer: posted,
    ceiling: Math.max(posted, ceiling),
    patience: ctx.rng.int(p.patience[0], p.patience[1]),
    rounds: 0,
    lastAsk: null,
    agreedRate: null,
    flags: [],
  };
}

export function greeting(ctx: NegContext, s: NegState, extra?: { truckLine?: string; truckIssue?: string }) {
  const lane = `${ctx.load.originCity}, ${ctx.load.originState} to ${ctx.load.destCity}, ${ctx.load.destState}`;
  const vars = { broker: ctx.brokerName, name: ctx.contactName.split(" ")[0], ref: ctx.load.ref, lane, posted: money(s.postedRate) };
  const msgs: Reply["messages"] = [
    { from: "broker", text: fill(ctx.rng, GREETING[ctx.personality], vars) },
    { from: "dispatcher", text: `Hi, I'm calling about load ${ctx.load.ref}, ${lane}. Is it still available?` },
    { from: "broker", text: fill(ctx.rng, ctx.hasPostedRate ? OPENING_POSTED[ctx.personality] : OPENING_NORATE[ctx.personality], vars), offer: ctx.hasPostedRate ? s.postedRate : undefined },
  ];
  if (extra?.truckLine) msgs.push({ from: "dispatcher", text: extra.truckLine });
  if (extra?.truckIssue) msgs.push({ from: "broker", text: extra.truckIssue });
  return msgs;
}

function answer(ctx: NegContext, s: NegState, topic: QuestionTopic): string {
  const L = ctx.load;
  const c = L.cargo;
  const day = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric", timeZone: "UTC" });
  switch (topic) {
    case "available":
      return "Yes, it's still available as of right now.";
    case "weight":
      return `It's ${L.weight.toLocaleString("en-US")} lbs${c.pieces > 1 ? `, ${c.pieces} pieces` : ""}.`;
    case "dims":
      return `Dims are ${c.lengthFt}' long, ${c.widthIn}" wide, ${c.heightIn}" tall${c.oversize ? " — it's oversize" + (c.permit ? ", permits are on us" : "") : ", fully legal"}.`;
    case "tarps":
      return c.tarps
        ? `Yes, ${c.tarpSize ?? "tarps"} required. Tarp pay is included in the rate.`
        : EQUIPMENT[L.equipment as keyof typeof EQUIPMENT]?.openDeck
          ? `No tarps needed. Securement is ${[c.chains && "chains", c.straps && "straps"].filter(Boolean).join(" and ") || "straps"}.`
          : `It's ${EQUIPMENT[L.equipment as keyof typeof EQUIPMENT]?.name ?? "enclosed"} freight, no tarps.${c.temp ? ` Reefer at ${c.temp}.` : ""}`;
    case "pickup":
      return `Picks up ${day(L.pickupDate)} in ${L.originCity}, ${L.originState}, ${L.pickupWindow}.`;
    case "delivery":
      return `Delivers ${day(L.deliveryDate)} in ${L.destCity}, ${L.destState}, ${L.deliveryWindow}.`;
    case "detention":
      return L.instructions.find((i) => i.toLowerCase().includes("detention")) ?? "Detention is $40/hr after 2 hours free, with in/out times on the BOL.";
    case "quickpay":
      return `We pay in about ${L.daysToPay} days. Quick pay is available at ${L.quickPayPct}%, paid in 2 business days.`;
    case "commodity":
      return `It's ${L.commodity.toLowerCase()}.`;
    case "stops":
      return L.instructions.some((i) => /multi-stop|2 stops/i.test(i)) ? "There's a second stop, it's included in the rate." : "Just one pick, one drop.";
    case "rate":
      return ctx.hasPostedRate || s.rounds > 0 ? `I'm at ${money(s.brokerOffer)} right now.` : "Make me an offer and we'll see.";
  }
}

/** Detects intent from free text: dollar amounts, accept words, or a known question. */
export function parseFreeText(text: string): DispatcherAction {
  const t = text.toLowerCase();
  const amt = t.match(/\$?\s*(\d{1,2}(?:,\d{3})+|\d{3,5})(?:\.\d+)?\s*(k)?/);
  if (amt) {
    let n = Number(amt[1].replace(/,/g, ""));
    if (amt[2]) n *= 1000;
    if (n >= 100 && n <= 50000) return { type: "offer", amount: n, text };
  }
  const km = t.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (km) return { type: "offer", amount: Math.round(Number(km[1]) * 1000), text };
  if (/\b(deal|book it|i'?ll take it|accept|sounds good|let'?s do it|ok(ay)? (book|deal))\b/.test(t)) return { type: "accept" };
  const topics: [RegExp, QuestionTopic][] = [
    [/still available|available\?|still open/, "available"],
    [/weigh|lbs|pounds|heavy/, "weight"],
    [/dim|length|width|wide|tall|height|oversize|permit/, "dims"],
    [/tarp|chain|strap|securement|reefer|temp/, "tarps"],
    [/pick ?up|pu |load time|shipper/, "pickup"],
    [/deliver|drop|receiver|consignee/, "delivery"],
    [/detention|layover|tonu/, "detention"],
    [/quick ?pay|days to pay|payment|pay terms|factor/, "quickpay"],
    [/commodity|what is it|what's the freight|product/, "commodity"],
    [/stop|multi/, "stops"],
    [/rate|best you can|how much|pay/, "rate"],
  ];
  for (const [re, topic] of topics) if (re.test(t)) return { type: "ask", topic, text };
  return { type: "say", text };
}

const ASK_LINES = ["Can you do {ask}?", "I'd need {ask} to make it work.", "My driver needs {ask} on this one.", "Could you get to {ask}?", "{ask} and I'll book it right now."];

export function respond(prev: NegState, action: DispatcherAction, ctx: NegContext): Reply {
  const rng = ctx.rng;
  const pers = PERSONALITY[ctx.personality];
  const s: NegState = { ...prev, flags: [...prev.flags] };
  const out: Reply["messages"] = [];
  const say = (text: string, offer?: number) => out.push({ from: "broker", text, offer });

  if (s.status === "AGREED" || s.status === "LOST" || s.status === "CLOSED") {
    return { state: s, messages: [{ from: "system", text: "This conversation has ended." }] };
  }

  switch (action.type) {
    case "hangup": {
      out.push({ from: "system", text: "Call ended." });
      s.status = "CLOSED";
      return { state: s, messages: out };
    }

    case "ask": {
      if (action.text) out.push({ from: "dispatcher", text: action.text });
      say(answer(ctx, s, action.topic));
      return { state: s, messages: out };
    }

    case "say": {
      out.push({ from: "dispatcher", text: action.text });
      say(rng.pick(["Okay. So what rate do you need on it?", "Got it. Are you able to cover it?", "Sure. What's your number?", "Alright — do you want the load?"]));
      return { state: s, messages: out };
    }

    case "accept": {
      out.push({ from: "dispatcher", text: rng.pick([`${money(s.brokerOffer)} works, let's book it.`, `Okay, I'll take it at ${money(s.brokerOffer)}.`, `Deal at ${money(s.brokerOffer)}.`]) });
      s.status = "AGREED";
      s.agreedRate = s.brokerOffer;
      say(fill(rng, ACCEPT[ctx.personality], { rate: money(s.brokerOffer) }), s.brokerOffer);
      return { state: s, messages: out };
    }

    case "resume": {
      if (s.status !== "ON_HOLD") return { state: s, messages: out };
      s.status = "OPEN";
      const ask = s.lastAsk ?? s.brokerOffer;
      out.push({ from: "system", text: "Broker is back on the line." });
      if (ask <= s.ceiling && rng.chance(0.55)) {
        s.status = "AGREED";
        s.agreedRate = ask;
        s.brokerOffer = ask;
        say(`Good news — customer approved ${money(ask)}. ${fill(rng, ACCEPT[ctx.personality], { rate: money(ask) })}`, ask);
      } else {
        const counter = Math.min(s.ceiling, Math.max(s.brokerOffer + 25, roundTo(s.brokerOffer + (Math.min(ask, s.ceiling) - s.brokerOffer) * 0.8, 25)));
        s.brokerOffer = counter;
        s.flags = flag(s, "final");
        say(`Okay, I talked to them. They can't do ${money(ask)}, but I got them to ${money(counter)}. That's the best I can do.`, counter);
      }
      return { state: s, messages: out };
    }

    case "offer": {
      const ask = Math.round(action.amount);
      s.rounds += 1;
      out.push({ from: "dispatcher", text: action.text?.trim() || fill(rng, ASK_LINES, { ask: money(ask) }), offer: ask });
      s.lastAsk = ask;

      // At or below what the broker already offered: instant yes (lesson: you left money on the table)
      if (ask <= s.brokerOffer) {
        s.status = "AGREED";
        s.agreedRate = ask;
        s.brokerOffer = ask;
        say(fill(rng, ACCEPT[ctx.personality], { rate: money(ask) }), ask);
        return { state: s, messages: out };
      }

      const vars = { ask: money(ask) };

      // Already gave a final number and dispatcher keeps pushing
      if (has(s, "final") && ask > s.brokerOffer) {
        s.patience -= 1;
        if (s.patience <= 0 || rng.chance(ctx.personality === "firm" || ctx.personality === "lowballer" ? 0.6 : 0.35)) {
          return walk(s, ctx, out);
        }
        say(fill(rng, FINAL[ctx.personality], { counter: money(s.brokerOffer) }), s.brokerOffer);
        return { state: s, messages: out };
      }

      const gap = ask - s.brokerOffer;

      // Way above the ceiling
      if (ask > s.ceiling * 1.18) {
        s.patience -= 2;
        if (s.patience <= 0) return walk(s, ctx, out);
        say(fill(rng, TOO_HIGH[ctx.personality], vars));
        if (ctx.personality === "hustler" || ctx.personality === "lowballer") s.flags = flag(s, "pressure");
        if (rng.chance(0.5)) say(`I'm at ${money(s.brokerOffer)}.`, s.brokerOffer);
        return { state: s, messages: out };
      }

      // Within reach of the ceiling
      if (ask <= s.ceiling) {
        const room = s.ceiling - s.brokerOffer;
        const closeness = room <= 0 ? 1 : gap / room; // 0 = tiny ask, 1 = at ceiling
        const acceptBias = { corporate: 0.45, flexible: 0.6, friendly: 0.6, lowballer: 0.3, firm: 0.35, hustler: 0.5 }[ctx.personality];
        let pAccept = gap <= 50 ? 0.9 : Math.max(0.05, (1 - closeness) * acceptBias + (s.rounds >= 3 ? 0.2 : 0));
        // brokers rarely take the very first counter without pushing back
        if (s.rounds === 1 && gap > 50) pAccept *= 0.45;
        if (rng.chance(pAccept)) {
          s.status = "AGREED";
          s.agreedRate = ask;
          s.brokerOffer = ask;
          say(fill(rng, ACCEPT[ctx.personality], { rate: money(ask) }), ask);
          return { state: s, messages: out };
        }
        // Corporate-style brokers go check with the customer on bigger jumps
        if (!has(s, "checked") && gap >= 150 && rng.chance(ctx.personality === "corporate" ? 0.6 : 0.25)) {
          s.flags = flag(s, "checked");
          s.status = "ON_HOLD";
          say(rng.pick(HOLD));
          return { state: s, messages: out };
        }
      }

      // Counter toward the dispatcher, never above the ceiling
      const concession = Math.min(0.85, Math.max(0.1, pers.concession + rng.float(-0.1, 0.12) + s.rounds * 0.05));
      const target = Math.min(ask, s.ceiling);
      let counter = roundTo(s.brokerOffer + (target - s.brokerOffer) * concession, 25);
      counter = Math.max(s.brokerOffer + 25, Math.min(counter, s.ceiling, ask - 25));
      if (counter <= s.brokerOffer || s.brokerOffer >= s.ceiling) {
        // no more room
        s.flags = flag(s, "final");
        s.patience -= 1;
        if (s.patience <= 0) return walk(s, ctx, out);
        say(fill(rng, FINAL[ctx.personality], { counter: money(s.brokerOffer) }), s.brokerOffer);
        return { state: s, messages: out };
      }
      s.brokerOffer = counter;
      if (ask > s.ceiling) s.patience -= 1;
      if (s.patience <= 0) return walk(s, ctx, out);

      const nearCeiling = s.ceiling - counter < 50;
      if (nearCeiling && s.rounds >= 2) {
        s.flags = flag(s, "final");
        say(fill(rng, FINAL[ctx.personality], { counter: money(counter) }), counter);
      } else {
        say(fill(rng, COUNTER[ctx.personality], { ...vars, counter: money(counter) }), counter);
      }
      if (!has(s, "pressure") && (ctx.personality === "hustler" || ctx.personality === "lowballer" || rng.chance(0.15)) && s.rounds >= 1) {
        s.flags = flag(s, "pressure");
        say(rng.pick(PRESSURE));
      }
      return { state: s, messages: out };
    }
  }
}

function walk(s: NegState, ctx: NegContext, out: Reply["messages"]): Reply {
  s.status = "LOST";
  out.push({ from: "broker", text: fill(ctx.rng, WALK[ctx.personality], {}) });
  out.push({ from: "system", text: "The broker covered this load with another carrier." });
  return { state: s, messages: out };
}
