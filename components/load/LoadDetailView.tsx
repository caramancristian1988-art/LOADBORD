"use client";

import { AlertTriangle, ArrowRight, Check, FileText, GraduationCap, Mail, Phone, Minus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CallBroker } from "./CallBroker";
import { BookLoad } from "./BookLoad";
import { RouteMap } from "./RouteMap";
import { useLoadContext } from "./useLoadContext";
import { CreditBadge, EquipBadge, ErrorNote, StatusBadge } from "@/components/ui";
import { age, dateTime, feetInches, lbs, longDay, money, rpmFmt } from "@/lib/format";
import type { LaneBand, LoadDetailJson } from "@/lib/client-types";
import { EQUIPMENT } from "@/lib/sim/data/freight";
import { PERSONALITY } from "@/lib/sim/market";
import { STATUS_LABEL } from "@/lib/sim/equipment";
import { api } from "@/lib/api-client";
import type { EquipCode } from "@/lib/sim/types";

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-t border-line px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function KV({ k, v, strong }: { k: string; v: ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-[3px] text-[13px]">
      <span className="text-muted">{k}</span>
      <span className={`tnum text-right ${strong ? "font-bold" : ""}`}>{v}</span>
    </div>
  );
}

function Req({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[12px] ${on ? "border-[#b9d3f6] bg-primary-50 text-primary" : "border-line text-faint line-through"}`}>
      {on ? <Check size={12} /> : <Minus size={12} />} {label}
    </span>
  );
}

export function LoadDetailView({
  data,
  dho,
  searchOrigin,
  compact = false,
  onChanged,
}: {
  data: { load: LoadDetailJson; band: LaneBand };
  dho?: number | null;
  searchOrigin?: { lat: number; lng: number; label: string } | null;
  compact?: boolean;
  onChanged?: () => void;
}) {
  const { load, band } = data;
  const router = useRouter();
  const ctx = useLoadContext();
  const [call, setCall] = useState<null | "call" | "email">(null);
  const [book, setBook] = useState<{ rate: number | null } | null>(null);
  const [verdict, setVerdict] = useState<"" | "yes" | "no">("");
  const [grading, setGrading] = useState(false);
  const [gradeErr, setGradeErr] = useState<string | null>(null);
  const [graded, setGraded] = useState<{ score: number; summary: string } | null>(null);

  const eq = EQUIPMENT[load.equipment as EquipCode];
  const deadhead = dho ?? load.bookedDeadhead ?? load.deadhead;
  const rate = load.bookedRate ?? load.negotiation?.agreedRate ?? load.rate;
  const rpm = rate != null ? rate / load.miles : null;
  const allIn = rate != null ? rate / (load.miles + deadhead) : null;
  const lane = `${load.originCity}, ${load.originState} → ${load.destCity}, ${load.destState}`;
  const open = load.status === "AVAILABLE" || load.status === "NEGOTIATING";
  const agreed = load.negotiation?.status === "AGREED" ? load.negotiation.agreedRate : null;
  const pers = PERSONALITY[load.broker.personality];
  const marketRatio = rate != null ? rate / load.marketRate : null;

  const changed = () => {
    onChanged?.();
    router.refresh();
    ctx.reload();
  };

  async function submitTraining() {
    setGrading(true);
    setGradeErr(null);
    try {
      const r = await api<{ score: number; summary: string }>("/api/training/submit", { body: { loadId: load.id, verdict: verdict === "" ? null : verdict === "yes" } });
      setGraded(r);
      ctx.reload();
      router.refresh();
    } catch (e) {
      setGradeErr((e as Error).message);
    } finally {
      setGrading(false);
    }
  }

  const callLoad = {
    id: load.id,
    ref: load.ref,
    lane,
    rate: load.rate,
    miles: load.miles,
    equipment: load.equipment as EquipCode,
    brokerName: load.brokerName,
    contact: { ...load.contact, ext: load.contact.ext ?? null },
  };

  return (
    <div className="bg-white">
      {/* header */}
      <div className="px-5 pt-4 pb-4">
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <span className="font-mono font-medium text-ink">{load.ref}</span>
          <StatusBadge status={load.status} />
          {load.negotiation && load.status === "NEGOTIATING" && (
            <span className="text-warn">{load.negotiation.status === "AGREED" ? `rate agreed ${money(load.negotiation.agreedRate)}` : `in talks · broker at ${money(load.negotiation.brokerOffer)}`}</span>
          )}
          <span className="ml-auto">Posted {age(load.postedAt)} ago</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[18px] font-bold">
          {load.originCity}, {load.originState} <ArrowRight size={18} className="text-muted" /> {load.destCity}, {load.destState}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
          <EquipBadge code={load.equipment} full />
          <span>{load.size === "FULL" ? "Full" : "Partial"}</span>
          <span>{lbs(load.weight)}</span>
          <span>{load.lengthFt} ft</span>
          <span>{load.commodity}</span>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <div className="col-span-1 rounded-lg bg-primary-50 px-3 py-2">
            <div className="text-[10.5px] tracking-wide text-muted uppercase">{load.bookedRate ? "Booked rate" : agreed ? "Agreed rate" : "Rate"}</div>
            <div className="tnum text-[20px] font-bold text-primary">{rate != null ? money(rate) : "Call"}</div>
            <div className="tnum text-[12px] text-muted">{rpmFmt(rpm)}/mi</div>
          </div>
          {[
            ["Trip", `${load.miles.toLocaleString("en-US")} mi`, "loaded"],
            ["Deadhead", `${deadhead} mi`, dho != null ? "from search origin" : load.bookedDeadhead != null ? "from truck" : "typical"],
            ["All-in RPM", rpmFmt(allIn), `${(load.miles + deadhead).toLocaleString("en-US")} total mi`],
          ].map(([k, v, s]) => (
            <div key={k} className="rounded-lg bg-surface px-3 py-2">
              <div className="text-[10.5px] tracking-wide text-muted uppercase">{k}</div>
              <div className="tnum text-[17px] font-bold">{v}</div>
              <div className="text-[11.5px] text-muted">{s}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {open && (
            <>
              <button className="btn btn-good" onClick={() => setCall("call")}>
                <Phone size={15} /> Call broker
              </button>
              <button className="btn btn-outline" onClick={() => setCall("email")}>
                <Mail size={15} /> Email
              </button>
              <button className="btn btn-primary" disabled={rate == null} title={rate == null ? "No posted rate — call the broker first" : undefined} onClick={() => setBook({ rate: agreed ?? null })}>
                {agreed ? `Book at ${money(agreed)}` : load.rate != null ? `Book now ${money(load.rate)}` : "Book"}
              </button>
            </>
          )}
          {load.rateConNo && (
            <a className="btn btn-outline" href={`/api/loads/${load.id}/ratecon`} target="_blank" rel="noreferrer">
              <FileText size={15} /> Rate confirmation
            </a>
          )}
          {!open && load.status !== "COVERED" && (
            <Link className="btn btn-outline" href={`/my-loads?tab=${load.status}`}>
              Manage in My Loads
            </Link>
          )}
          {compact && (
            <Link className="btn btn-ghost ml-auto" href={`/loads/${load.id}`}>
              Open full page
            </Link>
          )}
        </div>
        {load.status === "COVERED" && <div className="mt-3 rounded bg-surface px-3 py-2 text-[13px] text-muted">This load was covered by another carrier.</div>}
      </div>

      {/* training */}
      {ctx.attempt && load.status !== "COVERED" && (
        <section className="border-t border-[#d9c7f7] bg-[#f8f5fe] px-5 py-3">
          <div className="flex items-start gap-2 text-[13px] text-[#3b1d78]">
            <GraduationCap size={16} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="font-bold">Training: {ctx.attempt.title}</div>
              <div className="text-[12.5px]">{ctx.attempt.brief}</div>
              {graded ? (
                <div className="mt-2 font-medium">
                  Score {graded.score}/100 — {graded.summary}{" "}
                  <Link className="underline" href="/training">
                    details
                  </Link>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {ctx.attempt.scenarioKey === "deadhead-profit" && (
                    <select className="input input-sm w-auto" value={verdict} onChange={(e) => setVerdict(e.target.value as "" | "yes" | "no")}>
                      <option value="">Your call: is it profitable?</option>
                      <option value="yes">Yes — profitable with the deadhead</option>
                      <option value="no">No — the deadhead kills it</option>
                    </select>
                  )}
                  <button className="btn btn-sm bg-violet text-white hover:bg-[#5b21b6]" disabled={grading || (ctx.attempt.scenarioKey === "deadhead-profit" && !verdict)} onClick={submitTraining}>
                    {grading ? "Evaluating…" : "Submit this load for evaluation"}
                  </button>
                  <span className="text-[11.5px] text-[#6b4fa8]">Booking also submits it automatically. Negotiate first if the scenario asks for it.</span>
                </div>
              )}
              <ErrorNote>{gradeErr}</ErrorNote>
            </div>
          </div>
        </section>
      )}

      <Section title="Route">
        <RouteMap
          pickup={{ lat: load.pickup.lat, lng: load.pickup.lng, label: `Pick up: ${load.pickup.city}, ${load.pickup.state}` }}
          delivery={{ lat: load.delivery.lat, lng: load.delivery.lng, label: `Delivery: ${load.delivery.city}, ${load.delivery.state}` }}
          start={searchOrigin ?? (load.truck ? { lat: load.truck.lat, lng: load.truck.lng, label: `Truck #${load.truck.number}` } : null)}
          height={compact ? 210 : 300}
        />
      </Section>

      <div className={compact ? "" : "grid grid-cols-2"}>
        {(["pickup", "delivery"] as const).map((k) => {
          const st = load[k];
          return (
            <Section key={k} title={k === "pickup" ? "Pick up" : "Delivery"}>
              <div className="text-[13.5px] font-medium">{st.facility}</div>
              <div className="text-[13px]">{st.address}</div>
              <div className="text-[13px]">
                {st.city}, {st.state} {st.zip}
              </div>
              <div className="mt-2">
                <KV k="Date" v={longDay(st.date)} />
                <KV k={st.appointment ? "Appointment" : "Hours (FCFS)"} v={st.appointment ? `${st.windowStart} – ${st.windowEnd}` : `${st.windowStart} – ${st.windowEnd}`} />
                <KV k="Contact" v={`${st.contact} · ${st.phone}`} />
              </div>
            </Section>
          );
        })}
      </div>

      <div className={compact ? "" : "grid grid-cols-2"}>
        <Section title="Cargo">
          <KV k="Commodity" v={load.commodity} />
          <KV k="Weight" v={lbs(load.weight)} />
          <KV k="Pieces" v={load.cargo.pieces} />
          <KV k="Dimensions (L × W × H)" v={`${load.cargo.lengthFt}' × ${feetInches(load.cargo.widthIn)} × ${feetInches(load.cargo.heightIn)}`} />
          <KV k="Deck space" v={`${load.lengthFt} ft · ${load.size === "FULL" ? "Full" : "Partial"}`} />
          {load.cargo.temp && <KV k="Temperature" v={load.cargo.temp} />}
        </Section>
        <Section title="Equipment requirements">
          <KV k="Trailer" v={`${eq.name} (${eq.len} ft)`} />
          <KV k="Max weight" v={lbs(eq.maxWt)} />
          <KV k="Legal cargo height" v={feetInches(eq.legalH)} />
          {eq.openDeck && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Req on={load.cargo.tarps} label={load.cargo.tarps ? load.cargo.tarpSize ?? "Tarps" : "Tarps"} />
              <Req on={load.cargo.chains} label="Chains" />
              <Req on={load.cargo.straps} label="Straps" />
              <Req on={load.cargo.oversize} label="Oversize" />
              <Req on={load.cargo.permit} label="Permit" />
            </div>
          )}
          {load.cargo.oversize && (
            <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-warn">
              <AlertTriangle size={13} /> Oversize — check permits, escort and travel-time restrictions.
            </div>
          )}
        </Section>
      </div>

      <div className={compact ? "" : "grid grid-cols-2"}>
        <Section title="Rate analysis">
          <KV k="Posted rate" v={load.rate != null ? money(load.rate) : "Not posted"} />
          <KV k="Market rate (this lane)" v={money(load.marketRate)} />
          <KV k="Market RPM" v={rpmFmt(load.marketRate / load.miles)} />
          {band && <KV k={`Board RPM ${load.originState}→${load.destState} (${band.n} loads)`} v={`${rpmFmt(band.low)} – ${rpmFmt(band.high)}`} />}
          {marketRatio != null && (
            <div className={`mt-2 rounded px-2.5 py-1.5 text-[12.5px] ${marketRatio >= 1 ? "bg-good-50 text-good" : marketRatio >= 0.93 ? "bg-warn-50 text-warn" : "bg-bad-50 text-bad"}`}>
              {marketRatio >= 1
                ? `At or above market (${Math.round(marketRatio * 100)}%).`
                : `${Math.round(marketRatio * 100)}% of market — there should be room to negotiate ${money(Math.round((load.marketRate - (rate ?? 0)) / 25) * 25)}+.`}
            </div>
          )}
          <KV k={`Est. profit @ ${rpmFmt(ctx.costPerMile)}/mi cost`} v={rate != null ? money(Math.round(rate - (load.miles + deadhead) * ctx.costPerMile)) : "—"} strong />
        </Section>
        <Section title="Broker">
          <div className="text-[14px] font-bold">{load.broker.name}</div>
          <div className="text-[12.5px] text-muted">
            MC {load.broker.mc} · DOT {load.broker.dot} · {load.broker.yearsInBiz} yrs in business
          </div>
          <div className="text-[12.5px] text-muted">
            {load.broker.address}, {load.broker.hqCity}, {load.broker.hqState} {load.broker.zip}
          </div>
          <div className="mt-2 flex items-center gap-4">
            <CreditBadge cs={load.broker.creditScore} dtp={load.broker.daysToPay} stacked={false} />
            <span className="text-[12.5px] text-muted">Quick pay {load.broker.quickPayPct}%</span>
          </div>
          <div className="mt-2">
            <KV k="Contact" v={load.contact.name} />
            <KV k="Phone" v={`${load.contact.phone}${load.contact.ext ? ` ext ${load.contact.ext}` : ""}`} />
            <KV k="Email" v={load.contact.email} />
          </div>
          <div className="mt-2 rounded bg-surface px-2.5 py-1.5 text-[12px] text-ink-2">
            <b>Dispatcher notes:</b> {pers.label} — {pers.blurb}
          </div>
        </Section>
      </div>

      <Section title="Special instructions">
        <ul className="list-disc space-y-1 pl-5 text-[13px]">
          {load.instructions.map((i, n) => (
            <li key={n}>{i}</li>
          ))}
        </ul>
        {load.notes && <div className="mt-2 rounded border border-line bg-surface px-3 py-2 text-[13px]">Note: {load.notes}</div>}
      </Section>

      {(load.truck || load.driver) && (
        <Section title="Dispatch">
          <KV k="Truck" v={load.truck ? `#${load.truck.number} · ${load.truck.city}, ${load.truck.state}` : "—"} />
          <KV k="Driver" v={load.driver ? `${load.driver.name} · ${load.driver.phone}` : "—"} />
          <KV k="Rate con #" v={load.rateConNo ?? "—"} />
        </Section>
      )}

      <Section title="History">
        <ol className="space-y-1 text-[12.5px]">
          {[...load.history].reverse().map((h, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-28 shrink-0 text-muted">{dateTime(h.at)}</span>
              <span className="font-medium">{STATUS_LABEL[h.status] ?? h.status}</span>
              {h.note && <span className="text-muted">{h.note}</span>}
            </li>
          ))}
        </ol>
      </Section>

      {call && (
        <CallBroker
          open
          initialChannel={call}
          onClose={() => {
            setCall(null);
            changed();
          }}
          load={callLoad}
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
