"use client";

import { Mail, Phone, PhoneOff, Send, Music, CheckCircle2, XCircle, Truck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, ErrorNote } from "@/components/ui";
import { api } from "@/lib/api-client";
import { money } from "@/lib/format";
import type { TruckOption } from "@/lib/client-types";
import { canHaul } from "@/lib/sim/equipment";
import type { EquipCode } from "@/lib/sim/types";

type Msg = { from: string; text: string; offer: number | null; at: string };
type Neg = {
  id: string;
  status: "OPEN" | "ON_HOLD" | "AGREED" | "LOST" | "CLOSED";
  channel: string;
  postedRate: number;
  brokerOffer: number;
  lastAsk: number | null;
  rounds: number;
  agreedRate: number | null;
  finalOffer: boolean;
  messages: Msg[];
};

export interface CallLoad {
  id: string;
  ref: string;
  lane: string;
  rate: number | null;
  miles: number;
  equipment: EquipCode;
  brokerName: string;
  contact: { name: string; phone: string; ext: string | null; email: string };
}

const QUESTIONS: { topic: string; label: string; text: string }[] = [
  { topic: "weight", label: "Weight?", text: "How much does it weigh?" },
  { topic: "dims", label: "Dims?", text: "What are the dimensions?" },
  { topic: "tarps", label: "Tarps / securement?", text: "Does it need tarps? What securement?" },
  { topic: "pickup", label: "Pick up time?", text: "When does it pick up?" },
  { topic: "delivery", label: "Delivery?", text: "When does it deliver?" },
  { topic: "detention", label: "Detention?", text: "Do you pay detention?" },
  { topic: "quickpay", label: "Quick pay?", text: "What are your pay terms? Quick pay?" },
  { topic: "stops", label: "Stops?", text: "Any extra stops?" },
  { topic: "commodity", label: "Commodity?", text: "What's the commodity?" },
];

const initials = (n: string) =>
  n
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

export function CallBroker({
  open,
  onClose,
  load,
  trucks,
  initialChannel = "call",
  onAgreed,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  load: CallLoad;
  trucks: TruckOption[];
  initialChannel?: "call" | "email";
  onAgreed: (rate: number) => void;
  onChanged?: () => void;
}) {
  const [phase, setPhase] = useState<"setup" | "dialing" | "live">("setup");
  const [channel, setChannel] = useState<"call" | "email">(initialChannel);
  // The modal is mounted fresh for each call, so state starts clean.
  // null = not chosen → default to the first truck that can haul this load
  const [chosenTruck, setTruckId] = useState<string | null>(null);
  const [neg, setNeg] = useState<Neg | null>(null);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<string>("");
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  const compatible = trucks.filter((t) => canHaul(t.equipment as EquipCode, load.equipment));
  const truckId = chosenTruck ?? compatible[0]?.id ?? "";

  // the next message waiting to be revealed; a broker line shows a "typing" bubble first
  const pendingMsg = neg && shown < neg.messages.length ? neg.messages[shown] : null;
  const typing = pendingMsg?.from === "broker";

  // reveal messages one at a time
  useEffect(() => {
    if (!pendingMsg) return;
    const base = Math.min(2400, 650 + pendingMsg.text.length * 14);
    const delay = pendingMsg.from === "broker" ? (channel === "email" ? base * 1.5 : base) : pendingMsg.from === "system" ? 350 : 120;
    const t = setTimeout(() => setShown((s) => s + 1), delay);
    return () => clearTimeout(t);
  }, [pendingMsg, channel]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [shown, typing]);

  // call timer
  const live = phase === "live" && neg && (neg.status === "OPEN" || neg.status === "ON_HOLD");
  useEffect(() => {
    if (!live || channel !== "call") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [live, channel]);

  const revealing = !!neg && shown < neg.messages.length;

  const act = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!neg) return;
      setBusy(true);
      setError(null);
      try {
        const n = await api<Neg>(`/api/negotiations/${neg.id}`, { body: payload });
        setNeg(n);
        if (n.status !== "OPEN") onChanged?.();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [neg, onChanged],
  );

  // broker comes back from "checking with the customer"
  useEffect(() => {
    if (neg?.status !== "ON_HOLD" || revealing) return;
    const t = setTimeout(() => act({ type: "resume" }), 4500 + Math.random() * 3500);
    return () => clearTimeout(t);
  }, [neg?.status, revealing, act]);

  async function dial(ch: "call" | "email") {
    setChannel(ch);
    setPhase("dialing");
    setError(null);
    await new Promise((r) => setTimeout(r, ch === "call" ? 1600 + Math.random() * 1200 : 500));
    try {
      const n = await api<Neg>(`/api/loads/${load.id}/negotiate`, { body: { channel: ch, truckId: truckId || null } });
      const resumed = n.messages.length > 0 && n.rounds > 0;
      setNeg(n);
      setShown(resumed ? n.messages.length : 0);
      setPhase("live");
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
      setPhase("setup");
    }
  }

  const lastBrokerOffer = neg ? [...neg.messages.slice(0, shown)].reverse().find((m) => m.from === "broker" && m.offer != null)?.offer ?? null : null;
  const canTalk = !!neg && (neg.status === "OPEN") && !busy && !revealing;
  const ended = neg && ["AGREED", "LOST", "CLOSED"].includes(neg.status) && !revealing;

  function sendOffer(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setOffer("");
    act({ type: "offer", amount });
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const statusLine =
    phase === "dialing"
      ? channel === "call"
        ? "Calling…"
        : "Sending email…"
      : neg?.status === "ON_HOLD"
        ? "On hold"
        : neg?.status === "AGREED"
          ? "Rate agreed"
          : neg?.status === "LOST"
            ? "Load covered by another carrier"
            : neg?.status === "CLOSED"
              ? channel === "call"
                ? "Call ended"
                : "Thread closed"
              : phase === "live"
                ? channel === "call"
                  ? `Connected ${mmss}`
                  : "Email thread"
                : "Ready";

  return (
    <Modal
      open={open}
      onClose={() => {
        if (live && neg?.status === "OPEN" && channel === "call") act({ type: "hangup" });
        onClose();
      }}
      width={880}
      title={
        <span className="flex items-center gap-2">
          {channel === "call" ? <Phone size={16} /> : <Mail size={16} />} {channel === "call" ? "Call broker" : "Email broker"} · {load.ref}
        </span>
      }
      subtitle={`${load.lane} · ${load.miles.toLocaleString("en-US")} mi · posted ${load.rate != null ? money(load.rate) : "no rate (call for rate)"}`}
    >
      <div className="grid grid-cols-[260px_1fr] gap-4">
        {/* broker card */}
        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-sidebar p-4 text-center text-white">
            <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-xl font-bold ${phase === "dialing" && channel === "call" ? "ringing" : ""}`}>{initials(load.contact.name)}</div>
            <div className="mt-2 text-[15px] font-bold">{load.contact.name}</div>
            <div className="text-[12px] text-sidebar-text">{load.brokerName}</div>
            <div className="tnum mt-2 text-[14px] font-medium">
              {channel === "call" ? load.contact.phone : load.contact.email}
              {channel === "call" && load.contact.ext ? <span className="text-sidebar-text"> ext {load.contact.ext}</span> : null}
            </div>
            <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] ${neg?.status === "AGREED" ? "bg-good" : neg?.status === "LOST" ? "bg-bad" : "bg-white/15"}`}>
              {phase === "live" && neg?.status === "OPEN" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4ade80]" />}
              {statusLine}
            </div>
          </div>

          {neg && (
            <div className="card p-3 text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-muted">Initial offer</span>
                <span className="tnum font-medium">{money(neg.postedRate)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted">Broker is at</span>
                <span className="tnum font-bold text-primary">{money(lastBrokerOffer ?? neg.brokerOffer)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted">Your last ask</span>
                <span className="tnum">{money(neg.lastAsk)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted">Rounds</span>
                <span className="tnum">{neg.rounds}</span>
              </div>
              {(lastBrokerOffer ?? neg.brokerOffer) > 0 && (
                <div className="mt-1 flex justify-between">
                  <span className="text-muted">RPM at that rate</span>
                  <span className="tnum">${((lastBrokerOffer ?? neg.brokerOffer) / load.miles).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {phase !== "live" && (
            <div className="card flex flex-col gap-3 p-3">
              <div className="field">
                <label>Calling for truck</label>
                <select className="input input-sm" value={truckId} onChange={(e) => setTruckId(e.target.value)}>
                  <option value="">— don&apos;t mention a truck —</option>
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id} disabled={!canHaul(t.equipment as EquipCode, load.equipment)}>
                      #{t.number} {t.equipment} · {t.city}, {t.state}
                      {!canHaul(t.equipment as EquipCode, load.equipment) ? " (wrong equipment)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
                <Truck size={13} /> Brokers react to where your truck is.
              </div>
            </div>
          )}
        </div>

        {/* conversation */}
        <div className="flex min-h-[460px] flex-col rounded-lg border border-line">
          <div ref={scroller} className="scroll-thin flex-1 space-y-2.5 overflow-y-auto bg-surface/60 p-4" style={{ maxHeight: 400 }}>
            {phase === "setup" && (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
                <div className="text-[14px] font-medium">Contact {load.contact.name.split(" ")[0]} about this load</div>
                <div className="max-w-sm text-[12.5px] text-muted">
                  Ask questions, make an offer and negotiate. Every broker has a hidden limit and a personality — push too hard and they give the load to someone else.
                </div>
                <ErrorNote>{error}</ErrorNote>
                <div className="mt-2 flex gap-2">
                  <button className="btn btn-good h-10 px-5" onClick={() => dial("call")}>
                    <Phone size={16} /> Call {load.contact.phone}
                  </button>
                  <button className="btn btn-outline h-10 px-4" onClick={() => dial("email")}>
                    <Mail size={16} /> Email instead
                  </button>
                </div>
              </div>
            )}
            {phase === "dialing" && (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-muted">
                <div className="typing">
                  <span />
                  <span />
                  <span />
                </div>
                {channel === "call" ? "Ringing…" : "Sending…"}
              </div>
            )}
            {neg &&
              neg.messages.slice(0, shown).map((m, i) =>
                m.from === "system" ? (
                  <div key={i} className="text-center text-[11.5px] text-muted italic">
                    {m.text}
                  </div>
                ) : (
                  <div key={i} className={`pop flex ${m.from === "dispatcher" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug whitespace-pre-line ${
                        m.from === "dispatcher" ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm border border-line bg-white"
                      }`}
                    >
                      <div className={`mb-0.5 text-[10.5px] font-medium ${m.from === "dispatcher" ? "text-white/70" : "text-muted"}`}>{m.from === "dispatcher" ? "You" : load.contact.name.split(" ")[0]}</div>
                      {m.text}
                    </div>
                  </div>
                ),
              )}
            {typing && (
              <div className="flex">
                <div className="rounded-2xl rounded-bl-sm border border-line bg-white px-3.5 py-2.5">
                  <div className="typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
            {neg?.status === "ON_HOLD" && !revealing && (
              <div className="flex items-center justify-center gap-2 py-2 text-[12.5px] text-muted">
                <Music size={14} className="animate-bounce" /> On hold — the broker is checking with the customer…
              </div>
            )}
          </div>

          {phase === "live" && neg && (
            <div className="border-t border-line bg-white p-3">
              <ErrorNote>{error}</ErrorNote>
              {ended ? (
                <div className="flex items-center gap-3">
                  {neg.status === "AGREED" ? (
                    <>
                      <CheckCircle2 className="text-good" size={22} />
                      <div className="flex-1">
                        <div className="font-bold text-good">Rate agreed at {money(neg.agreedRate)}</div>
                        <div className="text-[12px] text-muted">
                          {neg.agreedRate! - neg.postedRate >= 0 ? `+${money(neg.agreedRate! - neg.postedRate)} over the initial offer` : `${money(neg.agreedRate! - neg.postedRate)} vs the initial offer`}
                        </div>
                      </div>
                      <button className="btn btn-good h-9 px-5" onClick={() => onAgreed(neg.agreedRate!)}>
                        Book load
                      </button>
                    </>
                  ) : neg.status === "LOST" ? (
                    <>
                      <XCircle className="text-bad" size={22} />
                      <div className="flex-1 text-[13px]">The broker gave this load to another carrier. Find another one on the board.</div>
                      <button className="btn btn-outline" onClick={onClose}>
                        Close
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 text-[13px] text-muted">Conversation ended without a deal. You can call back — the broker will remember your last numbers.</div>
                      <button className="btn btn-outline" onClick={() => dial(channel)}>
                        <Phone size={14} /> Call back
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {QUESTIONS.map((q) => (
                      <button key={q.topic} className="chip normal-case tracking-normal" disabled={!canTalk} onClick={() => act({ type: "ask", topic: q.topic, text: q.text })}>
                        {q.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-[150px]">
                      <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted">$</span>
                      <input
                        className="input input-sm tnum pl-6"
                        type="number"
                        placeholder="Your rate"
                        value={offer}
                        disabled={!canTalk}
                        onChange={(e) => setOffer(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendOffer(Number(offer))}
                      />
                    </div>
                    <button className="btn btn-primary" disabled={!canTalk || !offer} onClick={() => sendOffer(Number(offer))}>
                      Offer
                    </button>
                    {[50, 100, 200].map((d) => (
                      <button key={d} className="btn btn-outline btn-sm" disabled={!canTalk} onClick={() => sendOffer((lastBrokerOffer ?? neg.brokerOffer) + d)} title="Counter above the broker's number">
                        +${d}
                      </button>
                    ))}
                    <div className="ml-auto flex gap-2">
                      {lastBrokerOffer != null && (
                        <button className="btn btn-good" disabled={!canTalk} onClick={() => act({ type: "accept" })}>
                          Accept {money(lastBrokerOffer)}
                        </button>
                      )}
                      <button className="btn btn-danger" disabled={busy || revealing} onClick={() => act({ type: "hangup" })} title={channel === "call" ? "Hang up" : "Close thread"}>
                        <PhoneOff size={15} />
                      </button>
                    </div>
                  </div>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!text.trim()) return;
                      act({ type: "text", text });
                      setText("");
                    }}
                  >
                    <input
                      className="input input-sm flex-1"
                      placeholder={`Say something… e.g. "can you do 2,400?" or "is it tarped?"`}
                      value={text}
                      disabled={!canTalk}
                      onChange={(e) => setText(e.target.value)}
                    />
                    <button className="btn btn-outline" disabled={!canTalk || !text.trim()}>
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
