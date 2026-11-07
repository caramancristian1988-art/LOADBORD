"use client";

import { CheckCircle2, FileText, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Modal, ErrorNote, WarnNote, Field } from "@/components/ui";
import { api } from "@/lib/api-client";
import { money, rpmFmt } from "@/lib/format";
import type { DriverOption, TruckOption } from "@/lib/client-types";
import { canHaul, equipName } from "@/lib/sim/equipment";
import type { EquipCode } from "@/lib/sim/types";

export interface BookLoadInfo {
  id: string;
  ref: string;
  lane: string;
  miles: number;
  weight: number;
  lengthFt: number;
  equipment: EquipCode;
  rate: number | null;
}

type TrainingResult = { id: string; score: number | null; summary: string | null } | null;

export function BookLoad({
  open,
  onClose,
  load,
  agreedRate,
  trucks,
  drivers,
  costPerMile,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  load: BookLoadInfo;
  agreedRate: number | null;
  trucks: TruckOption[];
  drivers: DriverOption[];
  costPerMile: number;
  onBooked?: () => void;
}) {
  // The modal is mounted fresh for each booking, so initial values come straight from props.
  const [rate, setRate] = useState<string>(String(agreedRate ?? load.rate ?? ""));
  // null = not chosen yet → default to the best compatible truck (trucks may still be loading)
  const [chosenTruck, setTruckId] = useState<string | null>(null);
  const [chosenDriver, setDriverId] = useState<string | null>(null);
  const [fitState, setFit] = useState<{ truckId: string; deadhead: number; errors: string[]; warnings: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ rateConNo: string | null; training: TrainingResult } | null>(null);

  const compatible = trucks.filter((t) => canHaul(t.equipment as EquipCode, load.equipment) && t.maxWeight >= load.weight);
  const defaultTruck = compatible.find((t) => t.status === "AVAILABLE") ?? compatible[0];
  const truckId = chosenTruck ?? defaultTruck?.id ?? "";
  const driverId = chosenDriver ?? trucks.find((t) => t.id === truckId)?.driverId ?? "";
  const fit = fitState?.truckId === truckId ? fitState : null;

  useEffect(() => {
    if (!open || !truckId) return;
    let cancel = false;
    api<{ deadhead: number; errors: string[]; warnings: string[] }>(`/api/loads/${load.id}/fit?truckId=${truckId}`).then(
      (f) => !cancel && setFit({ ...f, truckId }),
      (e) => !cancel && setError((e as Error).message),
    );
    return () => {
      cancel = true;
    };
  }, [open, truckId, load.id]);

  const r = Number(rate);
  const dh = fit?.deadhead ?? 0;
  const totalMiles = load.miles + dh;
  const profit = r ? r - totalMiles * costPerMile : null;

  async function book() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ rateConNo: string; training: TrainingResult }>(`/api/loads/${load.id}/book`, { body: { rate: r, truckId, driverId: driverId || null } });
      setDone({ rateConNo: res.rateConNo, training: res.training });
      onBooked?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Modal open={open} onClose={onClose} title="Load booked" width={520}>
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <CheckCircle2 size={42} className="text-good" />
          <div className="text-[16px] font-bold">
            {load.ref} booked at {money(r)}
          </div>
          <div className="text-[13px] text-muted">
            {load.lane} · Rate confirmation {done.rateConNo}
          </div>
          {done.training && (
            <div className="mt-3 w-full rounded-lg border border-[#d9c7f7] bg-[#f4effd] p-3 text-left">
              <div className="flex items-center gap-2 font-bold text-[#3b1d78]">
                <GraduationCap size={16} /> Training score: {done.training.score}/100
              </div>
              <div className="mt-1 text-[13px] text-[#3b1d78]">{done.training.summary}</div>
              <Link href="/training" className="mt-1 inline-block text-[12.5px] font-medium text-violet hover:underline">
                See full evaluation →
              </Link>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <a className="btn btn-primary" href={`/api/loads/${load.id}/ratecon`} target="_blank" rel="noreferrer">
              <FileText size={15} /> View rate confirmation (PDF)
            </a>
            <Link className="btn btn-outline" href="/my-loads?tab=BOOKED">
              Go to My Loads
            </Link>
          </div>
        </div>
      </Modal>
    );
  }

  const selectedTruck = trucks.find((t) => t.id === truckId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={600}
      title={`Book ${load.ref}`}
      subtitle={`${load.lane} · ${load.miles.toLocaleString("en-US")} mi · ${equipName(load.equipment)} · ${load.weight.toLocaleString("en-US")} lbs`}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-good" disabled={busy || !truckId || !r || (fit?.errors.length ?? 0) > 0} onClick={book}>
            {busy ? "Booking…" : `Book at ${r ? money(r) : "—"}`}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Agreed rate (USD)">
            <input className="input tnum" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
          <div className="flex flex-col justify-center text-[12.5px] text-muted">
            {agreedRate != null ? (
              <span>
                Broker agreed to <b className="text-ink">{money(agreedRate)}</b>
              </span>
            ) : load.rate != null ? (
              <span>
                Booking at the posted rate <b className="text-ink">{money(load.rate)}</b> — no negotiation.
              </span>
            ) : (
              <span className="text-bad">No posted rate — call the broker to agree a rate first.</span>
            )}
          </div>
        </div>

        <Field label="Truck">
          <select
            className="input"
            value={truckId}
            onChange={(e) => {
              setTruckId(e.target.value);
              setDriverId(trucks.find((t) => t.id === e.target.value)?.driverId ?? "");
            }}
          >
            <option value="">Select a truck…</option>
            {trucks.map((t) => {
              const ok = canHaul(t.equipment as EquipCode, load.equipment);
              return (
                <option key={t.id} value={t.id} disabled={!ok}>
                  #{t.number} · {equipName(t.equipment)} {t.trailerLength}ft · {t.city}, {t.state} · {t.status === "AVAILABLE" ? "available" : t.status.toLowerCase().replace(/_/g, " ")}
                  {!ok ? " — wrong equipment" : ""}
                </option>
              );
            })}
          </select>
        </Field>
        <Field label="Driver">
          <select className="input" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">{selectedTruck?.driver ? `Truck's driver (${selectedTruck.driver.name})` : "Select a driver…"}</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.phone}
              </option>
            ))}
          </select>
        </Field>

        {fit && (
          <div className="grid grid-cols-4 gap-2 rounded-lg bg-surface p-3 text-center">
            {[
              ["Deadhead", `${dh} mi`],
              ["Loaded", `${load.miles} mi`],
              ["All-in RPM", r ? rpmFmt(r / Math.max(1, totalMiles)) : "—"],
              ["Est. profit", profit == null ? "—" : money(Math.round(profit))],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-[10.5px] tracking-wide text-muted uppercase">{k}</div>
                <div className={`tnum text-[15px] font-bold ${k === "Est. profit" && profit != null ? (profit > 0 ? "text-good" : "text-bad") : ""}`}>{v}</div>
              </div>
            ))}
            <div className="col-span-4 text-[11px] text-muted">Profit uses your operating cost of {rpmFmt(costPerMile)}/mi (Settings) on loaded + deadhead miles.</div>
          </div>
        )}
        {fit?.errors.length ? <ErrorNote>{fit.errors.join(" ")}</ErrorNote> : null}
        {fit?.warnings.length ? <WarnNote>{fit.warnings.join(" ")}</WarnNote> : null}
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  );
}
