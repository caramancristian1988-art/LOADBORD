"use client";

import { FileText, Phone, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreditBadge, Empty, EquipBadge, ErrorNote, Modal, StatusBadge, Field } from "@/components/ui";
import { CallBroker } from "@/components/load/CallBroker";
import { BookLoad } from "@/components/load/BookLoad";
import { useLoadContext } from "@/components/load/useLoadContext";
import { api } from "@/lib/api-client";
import { money, rpmFmt, shortDay, dateTime } from "@/lib/format";
import type { Jsonify } from "@/lib/client-types";
import type { MyLoadRow } from "@/lib/queries/my-loads";
import type { MyTab } from "@/lib/queries/my-loads";
import { canHaul, equipName } from "@/lib/sim/equipment";
import type { EquipCode } from "@/lib/sim/types";

type Row = Jsonify<MyLoadRow>;

const NEXT_ACTION: Record<string, { to: string; label: string; cls: string } | undefined> = {
  BOOKED: { to: "DISPATCHED", label: "Dispatch", cls: "btn-primary" },
  DISPATCHED: { to: "IN_TRANSIT", label: "Mark in transit", cls: "btn-primary" },
  IN_TRANSIT: { to: "DELIVERED", label: "Mark delivered", cls: "btn-good" },
};

export function MyLoadsTable({ tab, rows, totalRevenue }: { tab: MyTab; rows: Row[]; totalRevenue: number }) {
  const router = useRouter();
  const ctx = useLoadContext();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [call, setCall] = useState<Row | null>(null);
  const [book, setBook] = useState<{ row: Row; rate: number | null } | null>(null);
  const [assign, setAssign] = useState<Row | null>(null);
  const [assignTruck, setAssignTruck] = useState("");
  const [assignDriver, setAssignDriver] = useState("");
  const [cancel, setCancel] = useState<Row | null>(null);
  const [cancelNote, setCancelNote] = useState("");

  const refresh = () => {
    router.refresh();
    ctx.reload();
  };

  async function setStatus(row: Row, status: string, note?: string) {
    setBusy(row.id);
    setError(null);
    try {
      await api(`/api/loads/${row.id}/status`, { body: { status, note } });
      refresh();
    } catch (e) {
      setError(`${row.ref}: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function doAssign() {
    if (!assign) return;
    setBusy(assign.id);
    setError(null);
    try {
      await api(`/api/loads/${assign.id}/assign`, { body: { truckId: assignTruck, driverId: assignDriver || null } });
      setAssign(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const lane = (r: Row) => `${r.originCity}, ${r.originState} → ${r.destCity}, ${r.destState}`;
  const showDispatch = ["BOOKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "CANCELLED"].includes(tab);

  if (!rows.length) {
    const text: Record<MyTab, string> = {
      AVAILABLE: "Loads you called about but didn't book show up here while they're still on the board.",
      NEGOTIATING: "Call or email a broker from the load board to start negotiating.",
      BOOKED: "Book a load from the board — it will appear here ready to dispatch.",
      DISPATCHED: "Dispatch a booked load once the driver is rolling to the shipper.",
      IN_TRANSIT: "Mark a dispatched load in transit after pickup.",
      DELIVERED: "Delivered loads land here and count toward revenue.",
      CANCELLED: "Cancelled loads are kept here for your records.",
    };
    return (
      <div className="card">
        <Empty title="Nothing here yet" icon={<Truck size={36} />}>
          {text[tab]}{" "}
          <Link href="/loads/search" className="text-primary hover:underline">
            Search loads
          </Link>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ErrorNote>{error}</ErrorNote>
      {showDispatch && totalRevenue > 0 && (
        <div className="text-[13px] text-muted">
          {rows.length} load{rows.length > 1 ? "s" : ""} · <b className="text-ink">{money(totalRevenue)}</b> revenue
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="dt">
          <thead>
            <tr>
              <th>Load</th>
              <th>Lane</th>
              <th>Pick up · Deliver</th>
              <th>EQ</th>
              <th className="text-right">Rate</th>
              <th>Broker</th>
              {showDispatch ? <th>Truck · Driver</th> : <th>Negotiation</th>}
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rate = r.bookedRate ?? r.negotiation?.agreedRate ?? r.rate;
              const next = NEXT_ACTION[r.status];
              const agreed = r.negotiation?.status === "AGREED" ? r.negotiation.agreedRate : null;
              return (
                <tr key={r.id}>
                  <td>
                    <Link href={`/loads/${r.id}`} className="font-mono font-medium text-primary hover:underline">
                      {r.ref}
                    </Link>
                    {r.rateConNo && <div className="text-[11px] text-muted">{r.rateConNo}</div>}
                  </td>
                  <td className="leading-[1.3]">
                    <div>
                      {r.originCity}, {r.originState}
                    </div>
                    <div className="text-muted">
                      → {r.destCity}, {r.destState} · {r.miles} mi
                    </div>
                  </td>
                  <td className="tnum whitespace-nowrap">
                    {shortDay(r.pickupDate)} · {shortDay(r.deliveryDate)}
                  </td>
                  <td>
                    <EquipBadge code={r.equipment} />
                  </td>
                  <td className="tnum text-right">
                    <div className="font-medium">{rate != null ? money(rate) : "—"}</div>
                    <div className="text-[11.5px] text-muted">{rate != null ? `${rpmFmt(rate / r.miles)}/mi` : ""}</div>
                  </td>
                  <td className="max-w-[180px] leading-[1.3]">
                    <div className="truncate font-medium">{r.brokerName}</div>
                    <div className="text-[11.5px] text-muted">
                      {r.contact.name} · <CreditBadge cs={r.broker.creditScore} dtp={r.broker.daysToPay} stacked={false} />
                    </div>
                  </td>
                  {showDispatch ? (
                    <td className="leading-[1.3]">
                      {r.truck ? (
                        <>
                          <div className="font-medium">#{r.truck.number}</div>
                          <div className="text-[11.5px] text-muted">{r.driver ? `${r.driver.name} · ${r.driver.phone}` : "no driver"}</div>
                        </>
                      ) : (
                        <span className="text-muted">Unassigned</span>
                      )}
                    </td>
                  ) : (
                    <td className="text-[12.5px] leading-[1.3]">
                      {r.negotiation ? (
                        <>
                          <div>
                            {r.negotiation.status === "AGREED" ? (
                              <b className="text-good">Agreed {money(r.negotiation.agreedRate)}</b>
                            ) : r.negotiation.status === "LOST" ? (
                              <span className="text-bad">Lost</span>
                            ) : (
                              <>Broker at {money(r.negotiation.brokerOffer)}</>
                            )}
                          </div>
                          <div className="text-[11.5px] text-muted">
                            {r.negotiation.channel} · {r.negotiation.rounds} round{r.negotiation.rounds === 1 ? "" : "s"} · posted {money(r.negotiation.postedRate)}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  <td>
                    <StatusBadge status={r.status} />
                    {r.history.length > 0 && <div className="mt-0.5 text-[11px] text-muted">{dateTime(r.history[r.history.length - 1].at)}</div>}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      {(r.status === "NEGOTIATING" || r.status === "AVAILABLE") && (
                        <>
                          {r.negotiation?.status !== "AGREED" && (
                            <button className="btn btn-outline btn-sm" onClick={() => setCall(r)}>
                              <Phone size={13} /> {r.status === "AVAILABLE" ? "Call back" : "Continue"}
                            </button>
                          )}
                          <button className="btn btn-primary btn-sm" disabled={agreed == null && r.rate == null} onClick={() => setBook({ row: r, rate: agreed })}>
                            Book{agreed ? ` ${money(agreed)}` : ""}
                          </button>
                          {r.status === "NEGOTIATING" && (
                            <button className="btn btn-danger btn-sm" disabled={busy === r.id} onClick={() => setStatus(r, "AVAILABLE", "Dropped by dispatcher")}>
                              Drop
                            </button>
                          )}
                        </>
                      )}
                      {(r.status === "BOOKED" || r.status === "DISPATCHED") && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setAssign(r);
                            setAssignTruck(r.truckId ?? "");
                            setAssignDriver(r.driverId ?? "");
                          }}
                        >
                          <Truck size={13} /> Assign
                        </button>
                      )}
                      {next && (
                        <button className={`btn btn-sm ${next.cls}`} disabled={busy === r.id} onClick={() => setStatus(r, next.to)}>
                          {next.label}
                        </button>
                      )}
                      {r.rateConNo && (
                        <a className="btn btn-ghost btn-sm" href={`/api/loads/${r.id}/ratecon`} target="_blank" rel="noreferrer" title="Rate confirmation">
                          <FileText size={14} />
                        </a>
                      )}
                      {(r.status === "BOOKED" || r.status === "DISPATCHED") && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            setCancel(r);
                            setCancelNote("");
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {call && (
        <CallBroker
          open
          onClose={() => {
            setCall(null);
            refresh();
          }}
          load={{ id: call.id, ref: call.ref, lane: lane(call), rate: call.rate, miles: call.miles, equipment: call.equipment as EquipCode, brokerName: call.brokerName, contact: { ...call.contact, ext: call.contact.ext ?? null } }}
          trucks={ctx.trucks}
          onChanged={refresh}
          onAgreed={(rate) => {
            const row = call;
            setCall(null);
            setBook({ row, rate });
            refresh();
          }}
        />
      )}
      {book && (
        <BookLoad
          open
          onClose={() => {
            setBook(null);
            refresh();
          }}
          load={{ id: book.row.id, ref: book.row.ref, lane: lane(book.row), miles: book.row.miles, weight: book.row.weight, lengthFt: book.row.lengthFt, equipment: book.row.equipment as EquipCode, rate: book.row.rate }}
          agreedRate={book.rate}
          trucks={ctx.trucks}
          drivers={ctx.drivers}
          costPerMile={ctx.costPerMile}
          onBooked={refresh}
        />
      )}
      <Modal
        open={!!assign}
        onClose={() => setAssign(null)}
        title={`Assign ${assign?.ref ?? ""}`}
        subtitle={assign ? `${lane(assign)} · ${equipName(assign.equipment)} · ${assign.weight.toLocaleString("en-US")} lbs` : undefined}
        width={480}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setAssign(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={!assignTruck || busy === assign?.id} onClick={doAssign}>
              Save assignment
            </button>
          </>
        }
      >
        {assign && (
          <div className="flex flex-col gap-4">
            <Field label="Truck">
              <select
                className="input"
                value={assignTruck}
                onChange={(e) => {
                  setAssignTruck(e.target.value);
                  setAssignDriver(ctx.trucks.find((t) => t.id === e.target.value)?.driverId ?? "");
                }}
              >
                <option value="">Select a truck…</option>
                {ctx.trucks.map((t) => (
                  <option key={t.id} value={t.id} disabled={!canHaul(t.equipment as EquipCode, assign.equipment as EquipCode)}>
                    #{t.number} · {equipName(t.equipment)} · {t.city}, {t.state}
                    {!canHaul(t.equipment as EquipCode, assign.equipment as EquipCode) ? " — wrong equipment" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Driver">
              <select className="input" value={assignDriver} onChange={(e) => setAssignDriver(e.target.value)}>
                <option value="">Truck&apos;s driver</option>
                {ctx.drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.phone}
                  </option>
                ))}
              </select>
            </Field>
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </Modal>
      <Modal
        open={!!cancel}
        onClose={() => setCancel(null)}
        title={`Cancel ${cancel?.ref ?? ""}?`}
        width={460}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setCancel(null)}>
              Keep load
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (cancel) setStatus(cancel, "CANCELLED", cancelNote || "Cancelled by dispatcher");
                setCancel(null);
              }}
            >
              Cancel load
            </button>
          </>
        }
      >
        <p className="mb-3 text-[13px] text-muted">Cancelling after booking hurts your relationship with the broker and may cost a TONU. The truck becomes available again.</p>
        <Field label="Reason (optional)">
          <input className="input" value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} placeholder="e.g. truck broke down" />
        </Field>
      </Modal>
    </div>
  );
}
