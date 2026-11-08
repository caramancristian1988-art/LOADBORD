"use client";

import { Time } from "@/components/ui/Time";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote, Field, Modal } from "@/components/ui";
import { api } from "@/lib/api-client";
import { dateTime } from "@/lib/format";

type S = {
  carrierName: string;
  carrierMc: string;
  carrierDot: string;
  carrierAddress: string;
  carrierCity: string;
  carrierState: string;
  carrierZip: string;
  carrierPhone: string;
  carrierEmail: string;
  dispatcherName: string;
  costPerMile: number;
  targetRpm: number;
  marketSeededAt: string | null;
  lastTopUpAt: string | null;
};

const FIELDS: { k: keyof S; label: string; span?: 2; type?: string; step?: string }[] = [
  { k: "dispatcherName", label: "Dispatcher name", span: 2 },
  { k: "carrierName", label: "Carrier company name", span: 2 },
  { k: "carrierMc", label: "MC number" },
  { k: "carrierDot", label: "DOT number" },
  { k: "carrierAddress", label: "Street address", span: 2 },
  { k: "carrierCity", label: "City" },
  { k: "carrierState", label: "State" },
  { k: "carrierZip", label: "ZIP" },
  { k: "carrierPhone", label: "Phone" },
  { k: "carrierEmail", label: "Dispatch email", span: 2 },
];

export function SettingsForm({ initial, stats }: { initial: S; stats: { loads: number; brokers: number } }) {
  const router = useRouter();
  const [v, setV] = useState<S>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reset, setReset] = useState<null | { keepFleet: boolean }>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api("/api/settings", { method: "PUT", body: v });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doReset() {
    if (!reset) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/market/reset", { body: reset });
      setReset(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={save} className="card p-5">
        <h2 className="mb-4 font-bold">Carrier profile</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {FIELDS.map((f) => (
            <Field key={f.k} label={f.label} className={f.span === 2 ? "col-span-2" : ""}>
              <input className="input" value={String(v[f.k] ?? "")} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />
            </Field>
          ))}
        </div>
        <h2 className="mt-6 mb-4 font-bold">Economics</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Operating cost ($/mile)">
            <input className="input" type="number" step="0.01" value={v.costPerMile} onChange={(e) => setV({ ...v, costPerMile: Number(e.target.value) })} />
          </Field>
          <Field label="Target RPM ($/mile)">
            <input className="input" type="number" step="0.05" value={v.targetRpm} onChange={(e) => setV({ ...v, targetRpm: Number(e.target.value) })} />
          </Field>
          <p className="col-span-2 self-center text-[12px] text-muted">Fuel, driver pay, insurance, truck payment and maintenance per mile. Typical open-deck carriers run $1.70–$2.10.</p>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button className="btn btn-primary" disabled={busy}>
            Save settings
          </button>
          {saved && <span className="text-[13px] text-good">Saved.</span>}
          <div className="flex-1">
            <ErrorNote>{!reset ? error : null}</ErrorNote>
          </div>
        </div>
      </form>

      <div className="card p-5">
        <h2 className="mb-1 font-bold">Simulated market</h2>
        <p className="text-[13px] text-muted">
          {stats.loads.toLocaleString("en-US")} loads from {stats.brokers} brokers. Generated <Time value={v.marketSeededAt} />; new loads post automatically while you work (last update <Time value={v.lastTopUpAt} />).
        </p>
        <div className="mt-4 flex gap-2">
          <button className="btn btn-outline" onClick={() => setReset({ keepFleet: true })}>
            Reset market (keep my trucks & drivers)
          </button>
          <button className="btn btn-danger" onClick={() => setReset({ keepFleet: false })}>
            Full reset
          </button>
        </div>
      </div>

      <Modal
        open={!!reset}
        onClose={() => setReset(null)}
        title={reset?.keepFleet ? "Reset the market?" : "Full reset?"}
        width={460}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setReset(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={doReset}>
              {busy ? "Generating…" : "Reset"}
            </button>
          </>
        }
      >
        <p className="text-[13px]">
          All loads, negotiations, bookings and training results are deleted and a fresh market of 650 loads is generated.
          {reset?.keepFleet ? " Your trucks and drivers are kept." : " Trucks and drivers are reset to the starter fleet."}
        </p>
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      </Modal>
    </div>
  );
}
