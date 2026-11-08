"use client";

import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LoadExpand } from "./LoadExpand";
import { RouteMap } from "./RouteMap";
import { ErrorNote, StatusBadge } from "@/components/ui";
import { Time } from "@/components/ui/Time";
import { api } from "@/lib/api-client";
import { longDay, money } from "@/lib/format";
import type { LaneBand, LoadDetailJson } from "@/lib/client-types";
import { NEXT_STATUS, STATUS_LABEL } from "@/lib/sim/equipment";

function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line bg-panel-2 px-4 py-2.5">
        <h2 className="text-[14px] font-bold">{title}</h2>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function StatusControl({ load }: { load: LoadDetailJson }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = NEXT_STATUS[load.status] ?? [];
  async function change(status: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/loads/${load.id}/status`, { body: { status } });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <select
        className="input h-10 cursor-pointer rounded-full text-center font-medium tracking-wide uppercase"
        value={load.status}
        disabled={busy || next.length === 0}
        onChange={(e) => e.target.value !== load.status && change(e.target.value)}
        aria-label="Load status"
      >
        <option value={load.status}>{STATUS_LABEL[load.status]}</option>
        {next.map((s) => (
          <option key={s} value={s}>
            → {s === "AVAILABLE" ? "Drop (back to board)" : STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

export function LoadDetailView({ data, print = false }: { data: { load: LoadDetailJson; band: LaneBand }; print?: boolean }) {
  const { load } = data;
  const router = useRouter();

  useEffect(() => {
    if (!print) return;
    const t = setTimeout(() => window.print(), 900);
    return () => clearTimeout(t);
  }, [print]);

  const mine = !["AVAILABLE", "COVERED"].includes(load.status);

  return (
    <div className="flex flex-col gap-4">
      {/* title bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href="/loads/search" className="no-print -ml-2 grid h-9 w-9 place-items-center rounded-full text-primary hover:bg-primary-50" aria-label="Back to load board">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-[17px] font-bold md:text-[20px]">
          {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
        </h1>
        <span className="rounded-full border border-line-2 px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase">{STATUS_LABEL[load.status]}</span>
        <span className="w-full text-[12px] text-muted md:ml-auto md:w-auto">
          {load.ref} · posted <Time value={load.postedAt} format="age" /> ago
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-panel-2 px-4 py-2.5">
              <h2 className="text-[14px] font-bold">Load Details</h2>
              <StatusBadge status={load.status} />
            </div>
            <LoadExpand data={data} layout="page" onChanged={() => router.refresh()} />
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(["pickup", "delivery"] as const).map((k) => {
              const st = load[k];
              return (
                <Card key={k} title={k === "pickup" ? "Shipper (pick up)" : "Consignee (delivery)"}>
                  <div className="text-[14px] font-medium">{st.facility}</div>
                  <div className="text-[13px]">{st.address}</div>
                  <div className="text-[13px]">
                    {st.city}, {st.state} {st.zip}
                  </div>
                  <div className="mt-2 grid grid-cols-[110px_1fr] gap-y-1 text-[12.5px]">
                    <span className="text-muted">Date</span>
                    <span>{longDay(st.date)}</span>
                    <span className="text-muted">{st.appointment ? "Appointment" : "Hours (FCFS)"}</span>
                    <span>
                      {st.windowStart} – {st.windowEnd}
                    </span>
                    <span className="text-muted">Contact</span>
                    <span>
                      {st.contact} ·{" "}
                      <a className="text-primary" href={`tel:${st.phone}`}>
                        {st.phone}
                      </a>
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card title="Special instructions">
            <ul className="list-disc space-y-1 pl-5 text-[13px]">
              {load.instructions.map((i, n) => (
                <li key={n}>{i}</li>
              ))}
            </ul>
            {load.notes && <div className="mt-2 rounded border border-line bg-surface px-3 py-2 text-[13px]">Broker note: {load.notes}</div>}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="card overflow-hidden">
            <RouteMap
              pickup={{ lat: load.pickup.lat, lng: load.pickup.lng, label: `Pick up: ${load.pickup.city}, ${load.pickup.state}` }}
              delivery={{ lat: load.delivery.lat, lng: load.delivery.lng, label: `Delivery: ${load.delivery.city}, ${load.delivery.state}` }}
              start={load.truck ? { lat: load.truck.lat, lng: load.truck.lng, label: `Truck #${load.truck.number}` } : null}
              height={300}
            />
          </div>

          {mine && (
            <Card title="Dispatch">
              <div className="grid grid-cols-[100px_1fr] gap-y-1.5 text-[13px]">
                <span className="text-muted">Booked rate</span>
                <b>{money(load.bookedRate ?? load.negotiation?.agreedRate ?? load.rate)}</b>
                <span className="text-muted">Truck</span>
                <span>{load.truck ? `#${load.truck.number} · ${load.truck.city}, ${load.truck.state}` : "—"}</span>
                <span className="text-muted">Driver</span>
                <span>{load.driver ? `${load.driver.name} · ${load.driver.phone}` : "—"}</span>
                <span className="text-muted">Rate con</span>
                <span>{load.rateConNo ?? "—"}</span>
              </div>
              <div className="no-print mt-3 flex flex-col gap-2">
                <StatusControl load={load} />
                {load.rateConNo && (
                  <a className="btn btn-outline btn-pill h-10" href={`/api/loads/${load.id}/ratecon`} target="_blank" rel="noreferrer">
                    <FileText size={15} /> Rate confirmation
                  </a>
                )}
                <Link className="btn btn-ghost" href={`/my-loads?tab=${load.status}`}>
                  Open in My Loads
                </Link>
              </div>
            </Card>
          )}

          <Card title="History">
            <ol className="space-y-1.5 text-[12.5px]">
              {[...load.history].reverse().map((h, i) => (
                <li key={i} className="grid grid-cols-[104px_1fr] gap-2">
                  <span className="text-muted">
                    <Time value={h.at} />
                  </span>
                  <span>
                    <b>{STATUS_LABEL[h.status] ?? h.status}</b> {h.note && <span className="text-muted">· {h.note}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
