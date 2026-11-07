"use client";

import { ArrowLeftRight, ChevronDown, Search, Truck, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { CityInput } from "./CityInput";
import { EQUIPMENT } from "@/lib/sim/data/freight";
import { ALL_EQUIPMENT, parseLoadSearch, toQuery, type LoadSearch } from "@/lib/search-params";
import { addDaysIso, todayIso } from "@/lib/format";
import type { EquipCode } from "@/lib/sim/types";
import { api } from "@/lib/api-client";
import { createLocalStore, useLocalStore } from "@/lib/local-store";

type TruckLite = { id: string; number: string; equipment: EquipCode; city: string; state: string; availableDate: string; maxWeight: number; trailerLength: number; status: string; driver: { name: string } | null };

/** Recent searches shown as tabs above the search bar (per viewer). */
const recentStore = createLocalStore<{ q: string; o: string; d: string }[]>("ld.recentSearches", []);

function Popover({ label, active, children, width = 280 }: { label: string; active?: boolean; children: ReactNode; width?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" className="chip" data-active={active || open} onClick={() => setOpen((o) => !o)}>
        {label} <ChevronDown size={12} />
      </button>
      {open && (
        <div className="pop absolute top-8 left-0 z-40 rounded-md border border-line bg-white p-3 shadow-xl" style={{ width }}>
          {children}
        </div>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange, placeholder, step }: { label: string; value?: number; onChange: (v: number | undefined) => void; placeholder?: string; step?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        className="input input-sm"
        type="number"
        step={step}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    </div>
  );
}

export function SearchForm() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const current = parseLoadSearch(Object.fromEntries(params.entries()));
  const [f, setF] = useState<LoadSearch>({ ...current, page: 1 });
  const [eqOpen, setEqOpen] = useState(false);
  const eqRef = useRef<HTMLDivElement>(null);
  const [trucks, setTrucks] = useState<TruckLite[]>([]);
  const recent = useLocalStore(recentStore);
  const setRecent = recentStore.write;

  // keep the form in sync when the URL changes (back/forward, truck shortcuts):
  // adjust state during render instead of in an effect
  const paramKey = params.toString();
  const [syncedKey, setSyncedKey] = useState(paramKey);
  if (syncedKey !== paramKey) {
    setSyncedKey(paramKey);
    setF({ ...current, page: 1 });
  }

  useEffect(() => {
    api<{ trucks: TruckLite[] }>("/api/trucks").then((r) => setTrucks(r.trucks), () => {});
  }, []);

  useEffect(() => {
    if (!eqOpen) return;
    const onDoc = (e: MouseEvent) => !eqRef.current?.contains(e.target as Node) && setEqOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [eqOpen]);

  const set = <K extends keyof LoadSearch>(k: K, v: LoadSearch[K]) => setF((p) => ({ ...p, [k]: v }));

  function navigate(next: LoadSearch) {
    const q = toQuery({ ...next, page: 1 }).toString();
    if (next.origin || next.dest) {
      const entry = { q, o: next.origin ?? next.originState ?? "Anywhere", d: next.dest ?? next.destState ?? "Anywhere" };
      setRecent([entry, ...recent.filter((r) => r.q !== q)].slice(0, 6));
    }
    start(() => router.push(`${pathname}${q ? `?${q}` : ""}`));
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    navigate(f);
  }

  function fromTruck(t: TruckLite) {
    const today = todayIso();
    const avail = t.availableDate.slice(0, 10);
    const pf = avail > today ? avail : today;
    const next: LoadSearch = {
      ...f,
      origin: `${t.city}, ${t.state}`,
      originState: undefined,
      dho: 150,
      equipment: t.equipment === "SD" ? ["SD", "F"] : t.equipment === "CN" ? ["CN", "F"] : [t.equipment],
      pickupFrom: pf,
      pickupTo: addDaysIso(pf, 2),
      weightMax: t.maxWeight,
      lengthMax: t.trailerLength,
    };
    setF(next);
    navigate(next);
  }

  const eqLabel = f.equipment.length === 0 ? "All equipment" : f.equipment.length <= 2 ? f.equipment.map((c) => EQUIPMENT[c].name + "s").join(", ") : `${f.equipment.length} types`;
  const reqActive = !!(f.size || f.weightMax || f.lengthMax || f.noTarps || f.noOversize);
  const rateActive = !!(f.rateMin || f.rateMax || f.rpmMin || f.rateOnly);

  return (
    <div className="border-b border-line bg-white">
      {/* recent search tabs */}
      {recent.length > 0 && (
        <div className="scroll-thin flex items-end gap-0 overflow-x-auto border-b border-line px-4 pt-1.5">
          {recent.map((r) => {
            const active = r.q === paramKey;
            return (
              <div key={r.q} className={`group flex items-center gap-2 border-b-2 px-3 py-1.5 text-[12px] leading-tight ${active ? "border-primary" : "border-transparent hover:bg-surface"}`}>
                <button type="button" className="text-left" onClick={() => start(() => router.push(`${pathname}?${r.q}`))}>
                  <span className="block font-medium">• {r.o}</span>
                  <span className="block text-muted">• {r.d}</span>
                </button>
                <button
                  type="button"
                  aria-label="Remove search"
                  className="text-faint opacity-0 group-hover:opacity-100 hover:text-ink"
                  onClick={() => setRecent(recent.filter((x) => x.q !== r.q))}
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={submit} className="px-4 pt-4 pb-2">
        <div className="flex items-start gap-2">
          <CityInput label="Origin" value={f.origin ?? ""} onChange={(v) => set("origin", v || undefined)} placeholder="City, ST or state" className="w-[200px]" />
          <div className="field w-[64px]">
            <label>DH-O</label>
            <input className="input text-center" type="number" min={0} max={500} value={f.dho} onChange={(e) => set("dho", Number(e.target.value) || 0)} />
          </div>
          <button
            type="button"
            className="mt-2 grid h-7 w-7 place-items-center rounded text-muted hover:bg-surface hover:text-primary"
            title="Swap origin and destination"
            onClick={() => setF((p) => ({ ...p, origin: p.dest, dest: p.origin, dho: p.dhd, dhd: p.dho, originState: p.destState, destState: p.originState }))}
          >
            <ArrowLeftRight size={16} />
          </button>
          <CityInput label="Destination" value={f.dest ?? ""} onChange={(v) => set("dest", v || undefined)} placeholder="Anywhere" className="w-[200px]" />
          <div className="field w-[64px]">
            <label>DH-D</label>
            <input className="input text-center" type="number" min={0} max={500} value={f.dhd} onChange={(e) => set("dhd", Number(e.target.value) || 0)} />
          </div>

          <div ref={eqRef} className="field relative w-[210px]">
            <label>Equipment Type</label>
            <button type="button" className="input flex items-center justify-between text-left" onClick={() => setEqOpen((o) => !o)}>
              <span className="truncate">{eqLabel}</span>
              <ChevronDown size={14} className="text-muted" />
            </button>
            {eqOpen && (
              <div className="pop absolute top-[42px] left-0 z-40 w-[250px] rounded-md border border-line bg-white p-2 shadow-xl">
                <div className="mb-1 flex justify-between px-1 text-[11px]">
                  <button type="button" className="text-primary hover:underline" onClick={() => set("equipment", ["F", "SD", "CN", "HS"])}>
                    Open deck
                  </button>
                  <button type="button" className="text-primary hover:underline" onClick={() => set("equipment", [])}>
                    Clear
                  </button>
                </div>
                {ALL_EQUIPMENT.map((c) => (
                  <label key={c} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-hover">
                    <input
                      type="checkbox"
                      checked={f.equipment.includes(c)}
                      onChange={(e) => set("equipment", e.target.checked ? [...f.equipment, c] : f.equipment.filter((x) => x !== c))}
                    />
                    <span className="inline-grid h-[18px] min-w-[24px] place-items-center rounded-[3px] px-1 text-[10.5px] font-bold text-white" style={{ background: EQUIPMENT[c].color }}>
                      {c}
                    </span>
                    {EQUIPMENT[c].name}
                    {EQUIPMENT[c].openDeck && <span className="ml-auto text-[10px] text-muted">open deck</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="field w-[250px]">
            <label>Pick Up Date Range</label>
            <div className="input flex items-center gap-1 px-2">
              <input type="date" className="w-full bg-transparent text-[12.5px] outline-none" value={f.pickupFrom ?? ""} onChange={(e) => set("pickupFrom", e.target.value || undefined)} />
              <span className="text-muted">–</span>
              <input type="date" className="w-full bg-transparent text-[12.5px] outline-none" value={f.pickupTo ?? ""} onChange={(e) => set("pickupTo", e.target.value || undefined)} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary h-10 w-12" title="Search" disabled={pending}>
            {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Search size={18} />}
          </button>
        </div>

        {/* filter chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {trucks.length > 0 && (
            <Popover label="Search from truck" width={300}>
              <div className="mb-2 text-[12px] text-muted">Fills origin, equipment, dates, weight and length from the truck.</div>
              <div className="flex flex-col">
                {trucks.map((t) => (
                  <button key={t.id} type="button" onClick={() => fromTruck(t)} className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-hover">
                    <Truck size={14} className="text-muted" />
                    <span className="font-medium">#{t.number}</span>
                    <span className="text-muted">{EQUIPMENT[t.equipment].name}</span>
                    <span className="ml-auto text-[12px]">
                      {t.city}, {t.state}
                    </span>
                  </button>
                ))}
              </div>
            </Popover>
          )}
          <Popover label="Load requirements" active={reqActive}>
            <div className="flex flex-col gap-3">
              <div className="flex gap-1">
                {(["", "FULL", "PARTIAL"] as const).map((s) => (
                  <button key={s} type="button" className={`btn btn-sm flex-1 ${(f.size ?? "") === s ? "btn-primary" : "btn-outline"}`} onClick={() => set("size", s || undefined)}>
                    {s === "" ? "Any size" : s === "FULL" ? "Full" : "Partial"}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Max weight (lbs)" value={f.weightMax} onChange={(v) => set("weightMax", v)} placeholder="48000" />
                <NumberField label="Max length (ft)" value={f.lengthMax} onChange={(v) => set("lengthMax", v)} placeholder="48" />
              </div>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={!!f.noTarps} onChange={(e) => set("noTarps", e.target.checked)} /> No tarps
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={!!f.noOversize} onChange={(e) => set("noOversize", e.target.checked)} /> Legal size only (no oversize)
              </label>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => submit()}>
                Apply
              </button>
            </div>
          </Popover>
          <Popover label="Rate" active={rateActive}>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Min rate ($)" value={f.rateMin} onChange={(v) => set("rateMin", v)} />
              <NumberField label="Max rate ($)" value={f.rateMax} onChange={(v) => set("rateMax", v)} />
              <NumberField label="Min RPM ($/mi)" step="0.05" value={f.rpmMin} onChange={(v) => set("rpmMin", v)} placeholder="2.50" />
              <label className="flex items-center gap-2 self-center text-[12.5px]">
                <input type="checkbox" checked={!!f.rateOnly} onChange={(e) => set("rateOnly", e.target.checked)} /> Rate posted
              </label>
              <button type="button" className="btn btn-primary btn-sm col-span-2" onClick={() => submit()}>
                Apply
              </button>
            </div>
          </Popover>
          <Popover label="States" active={!!(f.originState || f.destState)}>
            <div className="flex flex-col gap-3">
              <div className="field">
                <label>Origin state(s)</label>
                <input className="input input-sm uppercase" placeholder="TX, OK" value={f.originState ?? ""} onChange={(e) => set("originState", e.target.value || undefined)} />
              </div>
              <div className="field">
                <label>Destination state(s)</label>
                <input className="input input-sm uppercase" placeholder="GA, FL" value={f.destState ?? ""} onChange={(e) => set("destState", e.target.value || undefined)} />
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => submit()}>
                Apply
              </button>
            </div>
          </Popover>
          <Popover label="Delivery date" active={!!(f.deliveryFrom || f.deliveryTo)}>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label>From</label>
                <input type="date" className="input input-sm" value={f.deliveryFrom ?? ""} onChange={(e) => set("deliveryFrom", e.target.value || undefined)} />
              </div>
              <div className="field">
                <label>To</label>
                <input type="date" className="input input-sm" value={f.deliveryTo ?? ""} onChange={(e) => set("deliveryTo", e.target.value || undefined)} />
              </div>
              <button type="button" className="btn btn-primary btn-sm col-span-2" onClick={() => submit()}>
                Apply
              </button>
            </div>
          </Popover>
          <Popover label={f.searchBackHrs ? `Search back - ${f.searchBackHrs} hrs` : "Search back"} active={!!f.searchBackHrs} width={200}>
            <div className="flex flex-col">
              {[undefined, 1, 4, 8, 24, 48].map((h) => (
                <button
                  key={h ?? "any"}
                  type="button"
                  className={`rounded px-2 py-1.5 text-left text-[13px] hover:bg-hover ${f.searchBackHrs === h ? "font-bold text-primary" : ""}`}
                  onClick={() => navigate({ ...f, searchBackHrs: h })}
                >
                  {h ? `Posted in last ${h} hr${h > 1 ? "s" : ""}` : "Any age"}
                </button>
              ))}
            </div>
          </Popover>
          <Popover label="Company" active={!!(f.broker || f.csMin)}>
            <div className="flex flex-col gap-3">
              <div className="field">
                <label>Broker name contains</label>
                <input className="input input-sm" value={f.broker ?? ""} onChange={(e) => set("broker", e.target.value || undefined)} placeholder="e.g. Freight" />
              </div>
              <NumberField label="Min credit score" value={f.csMin} onChange={(v) => set("csMin", v)} placeholder="90" />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => submit()}>
                Apply
              </button>
            </div>
          </Popover>
          <button
            type="button"
            className="ml-1 text-[12px] text-primary hover:underline"
            onClick={() => {
              const cleared = parseLoadSearch({});
              setF(cleared);
              navigate(cleared);
            }}
          >
            Clear all
          </button>
        </div>
      </form>
    </div>
  );
}
