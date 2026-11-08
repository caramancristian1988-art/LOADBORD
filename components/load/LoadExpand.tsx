"use client";

import { ArrowRight, ChevronDown, Copy, EyeOff, ExternalLink, GraduationCap, Info, Mail, MapPin, Phone, Printer, Star, StickyNote } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect, type ReactNode } from "react";
import { CallBroker } from "./CallBroker";
import { BookLoad } from "./BookLoad";
import { RouteMap } from "./RouteMap";
import { useLoadContext } from "./useLoadContext";
import { ErrorNote, Modal, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api-client";
import { feetInches, money, rpmFmt, toDate } from "@/lib/format";
import type { LaneBand, LoadDetailJson } from "@/lib/client-types";
import { EQUIPMENT } from "@/lib/sim/data/freight";
import { laneQuotes, PERSONALITY, type MarketQuote } from "@/lib/sim/market";
import type { EquipCode } from "@/lib/sim/types";

const day = (d: string) => toDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-2 py-[2px] text-[12.5px]">
      <span className="text-muted">{k}</span>
      <span className="min-w-0 break-words">{v}</span>
    </div>
  );
}

function Quote({ title, q, miles, period, note }: { title: string; q: MarketQuote; miles: number; period: string; note: string }) {
  return (
    <div className="border-t border-line pt-2.5">
      <div className="flex items-baseline justify-between">
        <span className="label">{title}</span>
        <span className="text-[11px] text-muted">{note}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-bold">
          {money(q.rate)} <span className="text-[12.5px] font-normal text-muted">({rpmFmt(q.rpm)}/mi)</span>
        </span>
        <span className="text-[11px] text-muted">
          {miles} mi | {period}
        </span>
      </div>
      <div className="text-[11.5px] text-muted">
        Range: {money(q.low)} – {money(q.high)} ({rpmFmt(q.low / miles)} – {rpmFmt(q.high / miles)})
      </div>
      <div className="text-[11.5px] text-muted">
        {q.companies} Companies | {q.reports} Reports
      </div>
    </div>
  );
}

function Stars({ score }: { score: number }) {
  const n = Math.max(1, Math.min(5, Math.round((score - 60) / 8)));
  return (
    <span className="inline-flex items-center gap-0.5 text-warn" title={`${n} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={12} fill={i < n ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

export function LoadExpand({
  data,
  dho,
  dhd,
  searchOrigin,
  onChanged,
  onHide,
  layout = "row",
  initialAction = null,
}: {
  initialAction?: "call" | null;
  data: { load: LoadDetailJson; band: LaneBand };
  dho?: number | null;
  dhd?: number | null;
  searchOrigin?: { lat: number; lng: number; label: string } | null;
  onChanged?: () => void;
  onHide?: () => void;
  layout?: "row" | "stack" | "page";
}) {
  const { load } = data;
  const router = useRouter();
  const ctx = useLoadContext();
  const [call, setCall] = useState<null | "call" | "email">(initialAction);
  const [book, setBook] = useState<{ rate: number | null } | null>(null);
  const [route, setRoute] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(load.dispatcherNote ?? "");
  const [savedNote, setSavedNote] = useState(load.dispatcherNote ?? "");
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [markOpen, setMarkOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [graded, setGraded] = useState<{ score: number; summary: string } | null>(null);
  const [gradeErr, setGradeErr] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<"" | "yes" | "no">("");
  const markRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!markOpen) return;
    const onDoc = (e: MouseEvent) => !markRef.current?.contains(e.target as Node) && setMarkOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [markOpen]);

  const eq = EQUIPMENT[load.equipment as EquipCode];
  const open = load.status === "AVAILABLE" || load.status === "NEGOTIATING";
  const agreed = load.negotiation?.status === "AGREED" ? load.negotiation.agreedRate : null;
  const rate = load.bookedRate ?? agreed ?? load.rate;
  const quotes = laneQuotes(load.id, load.marketRate, load.miles);
  const lane = `${load.originCity}, ${load.originState} → ${load.destCity}, ${load.destState}`;
  const pers = PERSONALITY[load.broker.personality];
  const c = load.cargo;

  const changed = () => {
    onChanged?.();
    router.refresh();
    ctx.reload();
  };

  async function saveNote() {
    setNoteErr(null);
    try {
      const r = await api<{ dispatcherNote: string | null }>(`/api/loads/${load.id}/note`, { body: { note } });
      setSavedNote(r.dispatcherNote ?? "");
      setNoteOpen(false);
    } catch (e) {
      setNoteErr((e as Error).message);
    }
  }

  async function copyInfo() {
    const text = `${load.ref} ${lane} · ${load.miles} mi · ${eq.name} ${load.size === "FULL" ? "Full" : "Partial"} · ${load.weight.toLocaleString("en-US")} lbs · ${load.commodity} · ${rate != null ? money(rate) : "call for rate"} · ${load.brokerName} ${load.contact.phone}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
    setMarkOpen(false);
  }

  async function submitTraining() {
    setGradeErr(null);
    try {
      const r = await api<{ score: number; summary: string }>("/api/training/submit", { body: { loadId: load.id, verdict: verdict === "" ? null : verdict === "yes" } });
      setGraded(r);
      ctx.reload();
      router.refresh();
    } catch (e) {
      setGradeErr((e as Error).message);
    }
  }

  const stack = layout === "stack";
  const deadheadO = dho ?? load.deadhead;

  return (
    <div className={`bg-panel ${layout === "row" ? "border-y-2 border-primary/30" : ""}`}>
      {/* header */}
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3 ${stack ? "pb-2" : "pb-1"}`}>
        <h3 className={`items-center gap-2 text-[17px] font-bold ${layout === "row" ? "flex" : "hidden"}`}>
          {load.originCity}, {load.originState} <ArrowRight size={16} className="text-primary" /> {load.destCity}, {load.destState}
          <span className="text-[14px] font-medium text-muted">{load.miles} mi</span>
        </h3>
        {layout === "row" && <StatusBadge status={load.status} />}
        <div className="ml-auto flex items-center gap-2">
          <a href={`/loads/${load.id}?print=1`} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-full border border-line-2 text-ink-2 hover:border-primary hover:text-primary" title="Print load details">
            <Printer size={15} />
          </a>
          <button className="btn btn-outline btn-pill h-8" onClick={() => setNoteOpen((o) => !o)}>
            <StickyNote size={14} /> {savedNote ? "Edit note" : "Add note"}
          </button>
        </div>
      </div>
      {noteOpen && (
        <div className="mx-4 mb-2 flex flex-col gap-2 rounded-md border border-line bg-panel-2 p-3 md:flex-row md:items-start">
          <textarea className="input h-20 flex-1 py-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Private note — e.g. broker said call back at 3 PM, can do $2,300" maxLength={1000} />
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={saveNote}>
              Save
            </button>
            <button className="btn btn-outline" onClick={() => setNoteOpen(false)}>
              Cancel
            </button>
          </div>
          <ErrorNote>{noteErr}</ErrorNote>
        </div>
      )}

      <div className={`grid gap-4 px-4 pb-4 ${stack ? "grid-cols-1" : layout === "page" ? "grid-cols-1 xl:grid-cols-2 [&>section:last-child]:xl:col-span-2" : "grid-cols-[1.15fr_1fr_1.1fr]"}`}>
        {/* 1 · TRIP */}
        <section className="rounded-md border border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="label">Trip</span>
            <span className="text-[12px] text-muted">{load.miles} mi</span>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center pt-1">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-primary" />
              <span className="my-1 h-9 border-l border-dashed border-faint" />
              <span className="h-2.5 w-2.5 rounded-[2px] border-2 border-primary" />
            </div>
            <div className="min-w-0 flex-1 text-[13px]">
              <div className="font-bold">
                {load.originCity}, {load.originState} <span className="font-normal text-muted">({deadheadO})</span>
              </div>
              <div className="text-[12px] text-muted">
                {day(load.pickupDate)} · {load.pickup.appointment ? `appt ${load.pickup.windowStart}` : `${load.pickup.windowStart}–${load.pickup.windowEnd} FCFS`}
              </div>
              <div className="mt-2.5 font-bold">
                {load.destCity}, {load.destState} <span className="font-normal text-muted">({dhd ?? 0})</span>
              </div>
              <div className="text-[12px] text-muted">
                {day(load.deliveryDate)} · {load.delivery.appointment ? `appt ${load.delivery.windowStart}` : `${load.delivery.windowStart}–${load.delivery.windowEnd} FCFS`}
              </div>
            </div>
            <button className="btn btn-outline btn-pill h-8 shrink-0 px-3" onClick={() => setRoute(true)}>
              <MapPin size={13} /> View route
            </button>
          </div>

          <div className="label mt-4 mb-1">Equipment</div>
          <Row k="Load" v={load.size === "FULL" ? "Full" : "Partial"} />
          <Row k="Truck" v={eq.name} />
          <Row k="Length" v={`${load.lengthFt} ft`} />
          <Row k="Weight" v={`${load.weight.toLocaleString("en-US")} lbs`} />
          <Row k="Dims" v={`${c.lengthFt}' L × ${feetInches(c.widthIn)} W × ${feetInches(c.heightIn)} H · ${c.pieces} pc`} />
          {eq.openDeck && (
            <Row
              k="Securement"
              v={[c.tarps ? c.tarpSize ?? "Tarps" : "No tarps", c.chains && "Chains", c.straps && "Straps", c.oversize && "OVERSIZE", c.permit && "Permit"].filter(Boolean).join(" · ")}
            />
          )}
          {c.temp && <Row k="Temp" v={c.temp} />}
          <Row k="Commodity" v={load.commodity} />
          <Row k="Reference ID" v={load.ref} />

          <div className="label mt-4 mb-1">Contact information</div>
          <div className="text-[12.5px]">
            {load.contact.name} · <a className="text-primary" href={`tel:${load.contact.phone}`}>{load.contact.phone}</a>
            {load.contact.ext ? ` ext ${load.contact.ext}` : ""}
          </div>
          <div className="text-[12.5px] break-all text-primary">{load.contact.email}</div>

          <div className="label mt-4 mb-1">Comments</div>
          <div className="space-y-1 text-[12.5px] text-ink-2">
            {load.notes && <div>{load.notes}</div>}
            {load.instructions.slice(0, 3).map((i, n) => (
              <div key={n}>• {i}</div>
            ))}
            {load.instructions.length > 3 && (
              <Link className="text-primary hover:underline" href={`/loads/${load.id}`}>
                + {load.instructions.length - 3} more instructions
              </Link>
            )}
          </div>
          {savedNote && (
            <div className="mt-3 rounded border border-warn-line bg-warn-50 px-2.5 py-1.5 text-[12.5px]">
              <b>My note:</b> {savedNote}
            </div>
          )}
        </section>

        {/* 2 · RATE */}
        <section className="rounded-md border border-line p-3">
          <span className="label">Rate</span>
          <div className="mt-2 space-y-0.5">
            <div className="grid grid-cols-[96px_1fr] text-[13px]">
              <span className="text-muted">Total</span>
              <span className="text-[16px] font-bold">{rate != null ? money(rate) : "—"}</span>
            </div>
            <div className="grid grid-cols-[96px_1fr] text-[13px]">
              <span className="text-muted">Trip</span>
              <span>{load.miles} mi</span>
            </div>
            <div className="grid grid-cols-[96px_1fr] text-[13px]">
              <span className="flex items-center gap-1 text-muted">
                Rate / mile <Info size={11} />
              </span>
              <span>{rate != null ? `${rpmFmt(rate / load.miles)}*` : "—"}</span>
            </div>
            {agreed && <div className="pt-1 text-[12px] font-medium text-good">Rate agreed with broker: {money(agreed)}</div>}
            {rate == null && <div className="pt-1 text-[12px] text-warn">No rate posted — call the broker for a rate.</div>}
          </div>
          <div className="label mt-4 mb-2">Market rates</div>
          <div className="space-y-3">
            <Quote title="Spot rate" q={quotes.spot} miles={load.miles} period="3d average" note={`${load.originState} → ${load.destState} Mkt`} />
            <Quote title="Contract rate" q={quotes.contract} miles={load.miles} period="30d average" note={`${load.originState} → ${load.destState} Mkt`} />
          </div>
          <div className="mt-3 rounded bg-surface px-2.5 py-1.5 text-[11.5px] text-muted">
            Fair market (training reference): <b className="text-ink">{money(load.marketRate)}</b> · {rpmFmt(load.marketRate / load.miles)}/mi
          </div>
        </section>

        {/* 3 · COMPANY + actions */}
        <section className="flex flex-col gap-3">
          <div className="rounded-md border border-line p-3">
            <div className="flex items-center justify-between">
              <span className="label">Company</span>
              <Link href={`/loads/search?broker=${encodeURIComponent(load.brokerName)}`} className="text-[11px] font-medium tracking-wide text-primary uppercase hover:underline">
                View in directory
              </Link>
            </div>
            <div className="mt-1.5 text-[14px] font-bold">{load.brokerName}</div>
            <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 text-[12.5px]">
              <span className="min-w-0">
                <a className="text-primary" href={`tel:${load.broker.phone}`}>
                  {load.broker.phone}
                </a>
                <div className="truncate text-primary">{load.broker.email}</div>
                <div className="text-muted">MC#{load.broker.mc.replace(/\D/g, "")}</div>
                <div className="text-muted">
                  {load.broker.hqCity}, {load.broker.hqState}
                </div>
              </span>
              <span className="text-right">
                <div>
                  <span className="text-muted">Credit Score </span>
                  <b className={load.broker.creditScore >= 90 ? "text-good" : load.broker.creditScore >= 80 ? "text-warn" : "text-bad"}>{load.broker.creditScore}</b>
                </div>
                <div>
                  <span className="text-muted">Days to Pay </span>
                  <b>{load.broker.daysToPay}</b>
                </div>
                <div className="mt-1">
                  <Stars score={load.broker.creditScore} />
                </div>
              </span>
            </div>
            <div className="mt-2 rounded bg-surface px-2.5 py-1.5 text-[11.5px] text-ink-2">
              <b>Dispatcher notes:</b> {pers.label} — {pers.blurb}
            </div>
          </div>

          <div className="rounded-md border border-line p-3">
            <span className="label">Load activity</span>
            {load.negotiation ? (
              <div className="mt-1 text-[12.5px]">
                {load.negotiation.status === "AGREED" ? (
                  <b className="text-good">Rate agreed {money(load.negotiation.agreedRate)}</b>
                ) : load.negotiation.status === "LOST" ? (
                  <span className="text-bad">Broker gave it to another carrier</span>
                ) : (
                  <>
                    You talked to the broker · {load.negotiation.rounds} round{load.negotiation.rounds === 1 ? "" : "s"} · broker at <b>{money(load.negotiation.brokerOffer)}</b>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-1 text-[12.5px]">
                <b>No activity yet!</b>
                <div className="text-muted">Be the first to make an offer.</div>
              </div>
            )}
          </div>

          {open ? (
            <>
              <button
                className="btn btn-primary btn-pill h-10 w-full"
                disabled={rate == null}
                title={rate == null ? "No posted rate — call the broker first" : undefined}
                onClick={() => setBook({ rate: agreed ?? null })}
              >
                {rate != null ? `Book ${money(agreed ?? load.rate)}` : "Book (call for rate)"}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-outline btn-pill h-9" onClick={() => setCall("call")}>
                  <Phone size={14} /> Call
                </button>
                <button className="btn btn-outline btn-pill h-9" onClick={() => setCall("email")}>
                  <Mail size={14} /> Email
                </button>
              </div>
            </>
          ) : load.status !== "COVERED" ? (
            <Link href={`/my-loads?tab=${load.status}`} className="btn btn-primary btn-pill h-10 w-full">
              Manage in My Loads
            </Link>
          ) : (
            <div className="rounded bg-surface px-3 py-2 text-[12.5px] text-muted">Covered by another carrier.</div>
          )}
          <div ref={markRef} className="relative">
            <button className="btn btn-outline btn-pill h-9 w-full" onClick={() => setMarkOpen((o) => !o)}>
              {copied ? "Copied!" : "Mark as…"} <ChevronDown size={14} />
            </button>
            {markOpen && (
              <div className="pop absolute right-0 bottom-11 left-0 z-30 rounded-md border border-line bg-panel py-1.5 shadow-xl">
                {onHide && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-hover"
                    onClick={() => {
                      setMarkOpen(false);
                      onHide();
                    }}
                  >
                    <EyeOff size={14} /> Not interested (hide)
                  </button>
                )}
                <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-hover" onClick={copyInfo}>
                  <Copy size={14} /> Copy load info
                </button>
                <Link className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-hover" href={`/loads/${load.id}`}>
                  <ExternalLink size={14} /> Open full details
                </Link>
              </div>
            )}
          </div>

          {ctx.attempt && load.status !== "COVERED" && (
            <div className="rounded-md border border-violet-line bg-violet-50 p-3 text-[12.5px] text-violet-ink">
              <div className="flex items-center gap-1.5 font-bold">
                <GraduationCap size={14} /> {ctx.attempt.title}
              </div>
              {graded ? (
                <div className="mt-1">
                  Score <b>{graded.score}/100</b> — {graded.summary}{" "}
                  <Link className="underline" href="/training">
                    details
                  </Link>
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {ctx.attempt.scenarioKey === "deadhead-profit" && (
                    <select className="input input-sm" value={verdict} onChange={(e) => setVerdict(e.target.value as "" | "yes" | "no")}>
                      <option value="">Your call: is it profitable?</option>
                      <option value="yes">Yes — profitable with the deadhead</option>
                      <option value="no">No — the deadhead kills it</option>
                    </select>
                  )}
                  <button className="btn btn-sm bg-violet text-white hover:bg-violet-600" disabled={ctx.attempt.scenarioKey === "deadhead-profit" && !verdict} onClick={submitTraining}>
                    Submit for evaluation
                  </button>
                </div>
              )}
              <ErrorNote>{gradeErr}</ErrorNote>
            </div>
          )}
        </section>
      </div>

      {/* phones: sticky action bar like the carrier app (BOOK LOAD / CALL) */}
      {stack && open && (
        <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-line bg-panel p-3">
          <button className="btn btn-primary btn-pill h-11 w-full" disabled={rate == null} onClick={() => setBook({ rate: agreed ?? null })}>
            {rate != null ? `Book load ${money(agreed ?? load.rate)}` : "No rate — call broker"}
          </button>
          <button className="btn btn-outline btn-pill h-11 w-full" onClick={() => setCall("call")}>
            <Phone size={15} /> Call
          </button>
        </div>
      )}

      <Modal open={route} onClose={() => setRoute(false)} title={`Route · ${lane}`} subtitle={`${load.miles} loaded mi${deadheadO ? ` · ${deadheadO} deadhead mi` : ""}`} width={860}>
        {route && (
          <RouteMap
            pickup={{ lat: load.pickup.lat, lng: load.pickup.lng, label: `Pick up: ${load.pickup.city}, ${load.pickup.state}` }}
            delivery={{ lat: load.delivery.lat, lng: load.delivery.lng, label: `Delivery: ${load.delivery.city}, ${load.delivery.state}` }}
            start={searchOrigin ?? null}
            height={420}
          />
        )}
      </Modal>

      {call && (
        <CallBroker
          open
          initialChannel={call}
          onClose={() => {
            setCall(null);
            changed();
          }}
          load={{ id: load.id, ref: load.ref, lane, rate: load.rate, miles: load.miles, equipment: load.equipment as EquipCode, brokerName: load.brokerName, contact: { ...load.contact, ext: load.contact.ext ?? null } }}
          trucks={ctx.trucks}
          onChanged={changed}
          onAgreed={(r) => {
            setCall(null);
            setBook({ rate: r });
            changed();
          }}
        />
      )}
      {book && (
        <BookLoad
          open
          onClose={() => {
            setBook(null);
            changed();
          }}
          load={{ id: load.id, ref: load.ref, lane, miles: load.miles, weight: load.weight, lengthFt: load.lengthFt, equipment: load.equipment as EquipCode, rate: load.rate }}
          agreedRate={book.rate ?? agreed}
          trucks={ctx.trucks}
          drivers={ctx.drivers}
          costPerMile={ctx.costPerMile}
          onBooked={changed}
        />
      )}
    </div>
  );
}
