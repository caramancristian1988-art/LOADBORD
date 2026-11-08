"use client";

import { ArrowLeftRight, ArrowUpDown, ChevronDown, EllipsisVertical, Plus, Search, SlidersHorizontal, Truck, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { CityInput } from "./CityInput";
import { EQUIPMENT } from "@/lib/sim/data/freight";
import { ALL_EQUIPMENT, parseLoadSearch, toQuery, type LoadSearch } from "@/lib/search-params";
import { addDaysIso, shortDay, todayIso } from "@/lib/format";
import type { EquipCode } from "@/lib/sim/types";
import { api } from "@/lib/api-client";
import { createLocalStore, useLocalStore } from "@/lib/local-store";

type TruckLite = { id: string; number: string; equipment: EquipCode; city: string; state: string; availableDate: string; maxWeight: number; trailerLength: number; status: string; driver: { name: string } | null };
type Recent = { q: string; o: string; d: string };

/** Recent searches shown as tabs above the search bar (per viewer). */
const recentStore = createLocalStore<Recent[]>("ld.recentSearches", []);

const SEARCH_BACK = [undefined, 1, 4, 8, 24, 48] as const;

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close]);
  return ref;
}

function Popover({ label, active, dark, children, width = 280, align = "left" }: { label: ReactNode; active?: boolean; dark?: boolean; children: (close: () => void) => ReactNode; width?: number; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button type="button" className={`chip ${dark ? "chip-dark" : ""}`} data-active={active || open} onClick={() => setOpen((o) => !o)}>
        {label} <ChevronDown size={12} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <div className={`pop absolute top-8 z-40 rounded-md border border-line bg-panel p-4 shadow-xl ${align === "right" ? "right-0" : "left-0"}`} style={{ width }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange, placeholder, step, hint }: { label: string; value?: number; onChange: (v: number | undefined) => void; placeholder?: string; step?: string; hint?: string }) {
  return (
    <div>
      <div className="field">
        <label>{label}</label>
        <input className="input" type="number" inputMode="decimal" step={step} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

function PopFooter({ onClear, onDone }: { onClear: () => void; onDone: () => void }) {
  return (
    <div className="mt-4 flex items-center justify-end gap-3">
      <button type="button" className="text-[12px] font-medium tracking-wide text-primary uppercase hover:underline" onClick={onClear}>
        Clear all
      </button>
      <button type="button" className="btn btn-primary btn-pill h-8" onClick={onDone}>
        Done
      </button>
    </div>
  );
}

function EquipmentPicker({ value, onChange, onClose }: { value: EquipCode[]; onChange: (v: EquipCode[]) => void; onClose?: () => void }) {
  return (
    <div>
      <div className="mb-1 flex justify-between px-1 text-[11.5px]">
        <button type="button" className="text-primary hover:underline" onClick={() => onChange(["F", "SD", "CN", "HS"])}>
          Open deck
        </button>
        <button type="button" className="text-primary hover:underline" onClick={() => onChange([])}>
          Clear
        </button>
      </div>
      {ALL_EQUIPMENT.map((c) => (
        <label key={c} className="flex cursor-pointer items-center gap-2.5 rounded px-1.5 py-1.5 text-[13px] hover:bg-hover">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-primary)]" checked={value.includes(c)} onChange={(e) => onChange(e.target.checked ? [...value, c] : value.filter((x) => x !== c))} />
          <span className="w-6 font-bold">{c}</span>
          {EQUIPMENT[c].name}
          {EQUIPMENT[c].openDeck && <span className="ml-auto text-[10px] text-muted uppercase">open deck</span>}
        </label>
      ))}
      {onClose && (
        <div className="mt-2 flex justify-end">
          <button type="button" className="btn btn-primary btn-pill h-8" onClick={onClose}>
            Done
          </button>
        </div>
      )}
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
  const eqRef = useOutside(eqOpen, () => setEqOpen(false));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useOutside(menuOpen, () => setMenuOpen(false));
  const [trucks, setTrucks] = useState<TruckLite[]>([]);
  const recent = useLocalStore(recentStore);
  const setRecent = recentStore.write;
  const paramKey = params.toString();
  // phones: the form collapses into a summary once a search is running
  const [mobileOpen, setMobileOpen] = useState(!paramKey);
  const [mobileTab, setMobileTab] = useState<"new" | "recent">("new");
  const [moreFilters, setMoreFilters] = useState(false);

  // keep the form in sync when the URL changes (back/forward, truck shortcuts):
  // adjust state during render instead of in an effect
  const [syncedKey, setSyncedKey] = useState(paramKey);
  if (syncedKey !== paramKey) {
    setSyncedKey(paramKey);
    setF({ ...current, page: 1 });
  }

  useEffect(() => {
    api<{ trucks: TruckLite[] }>("/api/trucks").then((r) => setTrucks(r.trucks), () => {});
  }, []);

  const set = <K extends keyof LoadSearch>(k: K, v: LoadSearch[K]) => setF((p) => ({ ...p, [k]: v }));

  function navigate(next: LoadSearch) {
    const q = toQuery({ ...next, page: 1 }).toString();
    if (next.origin || next.dest || next.originState || next.destState) {
      const entry = { q, o: next.origin ?? next.originState ?? "Anywhere", d: next.dest ?? next.destState ?? "Anywhere" };
      setRecent([entry, ...recent.filter((r) => r.q !== q)].slice(0, 6));
    }
    setMobileOpen(false);
    start(() => router.push(`${pathname}${q ? `?${q}` : ""}`));
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    navigate(f);
  }

  function clearAll() {
    const cleared = parseLoadSearch({});
    setF(cleared);
    return cleared;
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

  const swap = () => setF((p) => ({ ...p, origin: p.dest, dest: p.origin, dho: p.dhd, dhd: p.dho, originState: p.destState, destState: p.originState }));
  const eqLabel = f.equipment.length === 0 ? "All equipment" : f.equipment.length <= 2 ? f.equipment.map((c) => EQUIPMENT[c].name + "s").join(", ") : `${f.equipment.length} equipment types`;
  const reqActive = !!(f.noTarps || f.noOversize);
  const rateActive = !!(f.rateMin || f.rateMax || f.rpmMin);
  const activeTab = recent.find((r) => r.q === paramKey);

  // ------------------------------------------------------------------ phone
  const mobile = (
    <div className="border-b border-line bg-panel md:hidden">
      {!mobileOpen ? (
        <button type="button" onClick={() => setMobileOpen(true)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
          <div className="flex flex-col items-center pt-1">
            <span className="h-2 w-2 rounded-[2px] bg-primary" />
            <span className="my-0.5 h-4 border-l border-dashed border-faint" />
            <span className="h-2 w-2 rounded-[2px] border border-primary" />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[14px] font-medium">
              {f.origin || f.originState || "Anywhere"} <span className="text-muted">({f.dho} mi)</span>
            </div>
            <div className="mt-1.5 truncate text-[14px] font-medium">{f.dest || f.destState || "Anywhere"}</div>
            <div className="mt-1 truncate text-[11.5px] text-muted">
              {f.equipment.length ? f.equipment.map((c) => EQUIPMENT[c].name).join(", ") : "All equipment"}
              {f.pickupFrom ? ` · ${shortDay(f.pickupFrom)}${f.pickupTo ? `–${shortDay(f.pickupTo)}` : ""}` : ""}
            </div>
          </div>
          <span className="flex items-center gap-1 rounded-full border border-line-2 px-3 py-1.5 text-[11.5px] font-medium tracking-wide text-primary uppercase">
            <SlidersHorizontal size={13} /> Edit
          </span>
        </button>
      ) : (
        <form onSubmit={submit} className="px-4 pb-4">
          <div className="-mx-4 mb-4 flex border-b border-line">
            {(["new", "recent"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setMobileTab(t)} className={`flex-1 border-b-2 py-3 text-[13px] font-medium ${mobileTab === t ? "border-primary text-ink" : "border-transparent text-muted"}`}>
                {t === "new" ? "New Search" : "Recent"}
              </button>
            ))}
            {paramKey && (
              <button type="button" aria-label="Close search" onClick={() => setMobileOpen(false)} className="px-4 text-muted">
                <X size={18} />
              </button>
            )}
          </div>
          {mobileTab === "recent" ? (
            <div className="flex flex-col">
              {recent.length === 0 && <div className="py-8 text-center text-[13px] text-muted">No recent searches yet.</div>}
              {recent.map((r) => (
                <button
                  key={r.q}
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    start(() => router.push(`${pathname}?${r.q}`));
                  }}
                  className="flex items-center justify-between border-b border-line py-3 text-left"
                >
                  <span className="leading-tight">
                    <span className="block text-[14px] font-medium">{r.o}</span>
                    <span className="block text-[13px] text-muted">→ {r.d}</span>
                  </span>
                  <Search size={16} className="text-primary" />
                </button>
              ))}
              {trucks.length > 0 && (
                <>
                  <div className="label mt-5 mb-1">Search from my trucks</div>
                  {trucks.map((t) => (
                    <button key={t.id} type="button" onClick={() => fromTruck(t)} className="flex items-center gap-3 border-b border-line py-3 text-left text-[14px]">
                      <Truck size={16} className="text-muted" /> #{t.number} {EQUIPMENT[t.equipment].name}
                      <span className="ml-auto text-[13px] text-muted">
                        {t.city}, {t.state}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-[1fr_96px] gap-3">
                <CityInput label="Origin*" value={f.origin ?? ""} onChange={(v) => set("origin", v || undefined)} placeholder="City, ST or state" />
                <div className="field">
                  <label>Deadhead</label>
                  <select className="input" value={f.dho} onChange={(e) => set("dho", Number(e.target.value))}>
                    {[25, 50, 100, 150, 200, 250, 300, 400].map((n) => (
                      <option key={n} value={n}>
                        {n} mi
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="button" onClick={swap} className="-my-2 flex items-center gap-1 self-start text-[11.5px] text-primary">
                <ArrowUpDown size={13} /> Swap
              </button>
              <div className="grid grid-cols-[1fr_96px] gap-3">
                <CityInput label="Destination" value={f.dest ?? ""} onChange={(v) => set("dest", v || undefined)} placeholder="Anywhere" />
                <div className="field">
                  <label>Deadhead</label>
                  <select className="input" value={f.dhd} onChange={(e) => set("dhd", Number(e.target.value))}>
                    {[25, 50, 100, 150, 200, 250, 300, 400].map((n) => (
                      <option key={n} value={n}>
                        {n} mi
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <div className="label mb-2">Truck type</div>
                <div className="flex flex-wrap gap-2">
                  {ALL_EQUIPMENT.map((c) => {
                    const on = f.equipment.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => set("equipment", on ? f.equipment.filter((x) => x !== c) : [...f.equipment, c])}
                        className={`rounded-md border px-2.5 py-1.5 text-[12.5px] ${on ? "border-primary bg-primary-50 text-primary" : "border-line-2 text-ink-2"}`}
                      >
                        {EQUIPMENT[c].name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label>Start date</label>
                  <input type="date" className="input" value={f.pickupFrom ?? ""} onChange={(e) => set("pickupFrom", e.target.value || undefined)} />
                </div>
                <div className="field">
                  <label>End date</label>
                  <input type="date" className="input" value={f.pickupTo ?? ""} onChange={(e) => set("pickupTo", e.target.value || undefined)} />
                </div>
              </div>
              <div className="field">
                <label>Maximum post age</label>
                <select className="input" value={f.searchBackHrs ?? ""} onChange={(e) => set("searchBackHrs", e.target.value ? Number(e.target.value) : undefined)}>
                  {SEARCH_BACK.map((h) => (
                    <option key={h ?? "any"} value={h ?? ""}>
                      {h ? `No more than ${h} hour${h > 1 ? "s" : ""}` : "Any age"}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={() => setMoreFilters((m) => !m)} className="flex items-center justify-between rounded-md border border-line-2 px-3 py-2.5 text-[13px]">
                <span className="flex items-center gap-2">
                  <SlidersHorizontal size={15} /> More filters {reqActive || rateActive || f.size || f.weightMax || f.lengthMax || f.broker || f.rateOnly ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                </span>
                <ChevronDown size={15} className={moreFilters ? "rotate-180" : ""} />
              </button>
              {moreFilters && (
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Min rate ($)" value={f.rateMin} onChange={(v) => set("rateMin", v)} />
                  <NumberField label="Min RPM ($/mi)" step="0.05" value={f.rpmMin} onChange={(v) => set("rpmMin", v)} />
                  <NumberField label="Max weight (lbs)" value={f.weightMax} onChange={(v) => set("weightMax", v)} />
                  <NumberField label="Max length (ft)" value={f.lengthMax} onChange={(v) => set("lengthMax", v)} />
                  <div className="field">
                    <label>Load type</label>
                    <select className="input" value={f.size ?? ""} onChange={(e) => set("size", (e.target.value || undefined) as LoadSearch["size"])}>
                      <option value="">Full & Partial</option>
                      <option value="FULL">Full</option>
                      <option value="PARTIAL">Partial</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Broker</label>
                    <input className="input" value={f.broker ?? ""} onChange={(e) => set("broker", e.target.value || undefined)} placeholder="Name contains" />
                  </div>
                  <label className="col-span-2 flex items-center gap-2 text-[13px]">
                    <input type="checkbox" className="h-4 w-4" checked={!!f.rateOnly} onChange={(e) => set("rateOnly", e.target.checked)} /> Only bookable (rate posted)
                  </label>
                  <label className="col-span-2 flex items-center gap-2 text-[13px]">
                    <input type="checkbox" className="h-4 w-4" checked={!!f.noTarps} onChange={(e) => set("noTarps", e.target.checked)} /> No tarps
                  </label>
                  <label className="col-span-2 flex items-center gap-2 text-[13px]">
                    <input type="checkbox" className="h-4 w-4" checked={!!f.noOversize} onChange={(e) => set("noOversize", e.target.checked)} /> Legal size only
                  </label>
                </div>
              )}
              <button type="submit" className="btn btn-primary btn-pill h-12 w-full text-[13px]" disabled={pending}>
                {pending ? "Searching…" : "Search loads"}
              </button>
              <button type="button" className="text-[12px] text-primary" onClick={() => navigate(clearAll())}>
                Clear all filters
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );

  // ---------------------------------------------------------------- desktop
  const desktop = (
    <div className="hidden border-b border-line bg-panel md:block">
      {/* search tabs */}
      <div className="no-scrollbar flex items-stretch gap-0 overflow-x-auto border-b border-line px-3">
        {(activeTab ? recent : [{ q: paramKey, o: f.origin ?? current.origin ?? "New Search", d: current.dest ?? "Anywhere" } as Recent, ...recent]).map((r) => {
          const active = r.q === paramKey;
          return (
            <div key={r.q || "new"} className={`group flex min-w-[150px] items-center gap-2 border-b-2 px-3 py-1.5 text-[12px] leading-tight ${active ? "border-primary bg-panel" : "border-transparent hover:bg-surface"}`}>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => start(() => router.push(`${pathname}${r.q ? `?${r.q}` : ""}`))}>
                <span className="block truncate font-medium">• {r.o}</span>
                <span className="block truncate text-muted">• {r.d}</span>
              </button>
              {recent.some((x) => x.q === r.q) && (
                <button type="button" aria-label="Close search tab" className="text-faint hover:text-ink" onClick={() => setRecent(recent.filter((x) => x.q !== r.q))}>
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}
        <button type="button" title="New search" className="my-1.5 ml-2 grid h-8 w-9 shrink-0 place-items-center self-center rounded bg-primary text-white hover:bg-primary-600" onClick={() => navigate(clearAll())}>
          <Plus size={18} />
        </button>
      </div>

      <form onSubmit={submit} className="px-4 pt-4 pb-2.5">
        {/* row 1: lane */}
        <div className="flex items-start gap-2">
          <CityInput label="Origin" value={f.origin ?? ""} onChange={(v) => set("origin", v || undefined)} placeholder="City, ST or state" className="min-w-0 flex-1" />
          <div className="field w-[64px] shrink-0">
            <label>DH-O</label>
            <input className="input text-center" type="number" min={0} max={500} value={f.dho} onChange={(e) => set("dho", Number(e.target.value) || 0)} />
          </div>
          <button type="button" className="mt-2 grid h-7 w-7 shrink-0 place-items-center rounded text-primary hover:bg-primary-50" title="Swap origin and destination" onClick={swap}>
            <ArrowLeftRight size={16} />
          </button>
          <CityInput label="Destination" value={f.dest ?? ""} onChange={(v) => set("dest", v || undefined)} placeholder="Anywhere" className="min-w-0 flex-1" />
          <div className="field w-[64px] shrink-0">
            <label>DH-D</label>
            <input className="input text-center" type="number" min={0} max={500} value={f.dhd} onChange={(e) => set("dhd", Number(e.target.value) || 0)} />
          </div>
        </div>

        {/* row 2: equipment, size, dates */}
        <div className="mt-3.5 flex items-start gap-2">
          <div ref={eqRef} className="field relative w-[230px] shrink-0">
            <label>Equipment Type*</label>
            <button type="button" className="input flex items-center justify-between text-left" onClick={() => setEqOpen((o) => !o)}>
              <span className="truncate">{eqLabel}</span>
              <ChevronDown size={14} className="shrink-0 text-muted" />
            </button>
            {eqOpen && (
              <div className="pop absolute top-[42px] left-0 z-40 w-[260px] rounded-md border border-line bg-panel p-2 shadow-xl">
                <EquipmentPicker value={f.equipment} onChange={(v) => set("equipment", v)} onClose={() => setEqOpen(false)} />
              </div>
            )}
          </div>
          <div className="field w-[150px] shrink-0">
            <label>Load Type</label>
            <select className="input" value={f.size ?? ""} onChange={(e) => set("size", (e.target.value || undefined) as LoadSearch["size"])}>
              <option value="">Full & Partial</option>
              <option value="FULL">Full</option>
              <option value="PARTIAL">Partial</option>
            </select>
          </div>
          <input className="input min-w-0 flex-1" type="number" placeholder="Length ft" value={f.lengthMax ?? ""} onChange={(e) => set("lengthMax", e.target.value === "" ? undefined : Number(e.target.value))} aria-label="Maximum length in feet" />
          <input className="input min-w-0 flex-1" type="number" placeholder="Weight lbs" value={f.weightMax ?? ""} onChange={(e) => set("weightMax", e.target.value === "" ? undefined : Number(e.target.value))} aria-label="Maximum weight in pounds" />
          <div className="field w-[260px] shrink-0">
            <label>Date Range*</label>
            <div className="input flex items-center gap-1 px-2">
              <input type="date" className="w-full min-w-0 bg-transparent text-[12.5px] outline-none" value={f.pickupFrom ?? ""} onChange={(e) => set("pickupFrom", e.target.value || undefined)} aria-label="Pick up from" />
              <span className="text-muted">–</span>
              <input type="date" className="w-full min-w-0 bg-transparent text-[12.5px] outline-none" value={f.pickupTo ?? ""} onChange={(e) => set("pickupTo", e.target.value || undefined)} aria-label="Pick up to" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-pill h-10 shrink-0 px-5" disabled={pending}>
            {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Search size={16} />}
            Search
          </button>
          <div ref={menuRef} className="relative shrink-0">
            <button type="button" aria-label="More search options" className="grid h-10 w-8 place-items-center rounded text-ink-2 hover:bg-surface" onClick={() => setMenuOpen((o) => !o)}>
              <EllipsisVertical size={18} />
            </button>
            {menuOpen && (
              <div className="pop absolute top-11 right-0 z-40 w-56 rounded-md border border-line bg-panel py-1.5 shadow-xl">
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-hover" onClick={() => { setMenuOpen(false); setF(clearAll()); }}>
                  <X size={14} /> Clear filters
                </button>
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-hover" onClick={() => { setMenuOpen(false); navigate(clearAll()); }}>
                  <Plus size={14} /> New search
                </button>
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-hover" onClick={() => { setMenuOpen(false); swap(); }}>
                  <ArrowLeftRight size={14} /> Reverse lane
                </button>
              </div>
            )}
          </div>
        </div>

        {/* filter chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Popover label="Load requirements" active={reqActive}>
            {(close) => (
              <div>
                <div className="mb-3 text-[15px] font-bold">Load Requirements</div>
                <div className="mb-4 flex gap-4 text-[13px]">
                  {(["", "FULL", "PARTIAL"] as const).map((s) => (
                    <label key={s} className="flex items-center gap-1.5">
                      <input type="radio" name="size" checked={(f.size ?? "") === s} onChange={() => set("size", s || undefined)} />
                      {s === "" ? "All" : s === "FULL" ? "Full" : "Partial"}
                    </label>
                  ))}
                </div>
                <div className="flex flex-col gap-3">
                  <NumberField label="Length ft" value={f.lengthMax} onChange={(v) => set("lengthMax", v)} hint="Maximum limit" />
                  <NumberField label="Weight lbs" value={f.weightMax} onChange={(v) => set("weightMax", v)} hint="Maximum limit" />
                  <label className="flex items-center gap-2 text-[13px]">
                    <input type="checkbox" checked={!!f.noTarps} onChange={(e) => set("noTarps", e.target.checked)} /> No tarps
                  </label>
                  <label className="flex items-center gap-2 text-[13px]">
                    <input type="checkbox" checked={!!f.noOversize} onChange={(e) => set("noOversize", e.target.checked)} /> Legal size only (no oversize)
                  </label>
                </div>
                <PopFooter
                  onClear={() => setF((p) => ({ ...p, size: undefined, lengthMax: undefined, weightMax: undefined, noTarps: false, noOversize: false }))}
                  onDone={() => {
                    close();
                    submit();
                  }}
                />
              </div>
            )}
          </Popover>
          <Popover label={f.searchBackHrs ? `Search back - ${f.searchBackHrs} hrs` : "Search back - any"} active={!!f.searchBackHrs} width={220}>
            {(close) => (
              <div className="-m-2 flex flex-col">
                {SEARCH_BACK.map((h) => (
                  <button
                    key={h ?? "any"}
                    type="button"
                    className={`rounded px-2 py-1.5 text-left text-[13px] hover:bg-hover ${f.searchBackHrs === h ? "font-bold text-primary" : ""}`}
                    onClick={() => {
                      close();
                      navigate({ ...f, searchBackHrs: h });
                    }}
                  >
                    {h ? `Posted in last ${h} hr${h > 1 ? "s" : ""}` : "Any age"}
                  </button>
                ))}
              </div>
            )}
          </Popover>
          <Popover label="Company" active={!!(f.broker || f.csMin)}>
            {(close) => (
              <div className="flex flex-col gap-3">
                <div className="field">
                  <label>Company name contains</label>
                  <input className="input" value={f.broker ?? ""} onChange={(e) => set("broker", e.target.value || undefined)} placeholder="e.g. Freight" />
                </div>
                <NumberField label="Min credit score" value={f.csMin} onChange={(v) => set("csMin", v)} placeholder="90" />
                <PopFooter
                  onClear={() => setF((p) => ({ ...p, broker: undefined, csMin: undefined }))}
                  onDone={() => {
                    close();
                    submit();
                  }}
                />
              </div>
            )}
          </Popover>
          <Popover label="Rate" active={rateActive}>
            {(close) => (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Min rate ($)" value={f.rateMin} onChange={(v) => set("rateMin", v)} />
                  <NumberField label="Max rate ($)" value={f.rateMax} onChange={(v) => set("rateMax", v)} />
                  <NumberField label="Min RPM ($/mi)" step="0.05" value={f.rpmMin} onChange={(v) => set("rpmMin", v)} placeholder="2.50" />
                </div>
                <PopFooter
                  onClear={() => setF((p) => ({ ...p, rateMin: undefined, rateMax: undefined, rpmMin: undefined }))}
                  onDone={() => {
                    close();
                    submit();
                  }}
                />
              </div>
            )}
          </Popover>
          <Popover label="States" active={!!(f.originState || f.destState)}>
            {(close) => (
              <div className="flex flex-col gap-3">
                <div className="field">
                  <label>Origin state(s)</label>
                  <input className="input uppercase" placeholder="TX, OK" value={f.originState ?? ""} onChange={(e) => set("originState", e.target.value || undefined)} />
                </div>
                <div className="field">
                  <label>Destination state(s)</label>
                  <input className="input uppercase" placeholder="GA, FL" value={f.destState ?? ""} onChange={(e) => set("destState", e.target.value || undefined)} />
                </div>
                <PopFooter
                  onClear={() => setF((p) => ({ ...p, originState: undefined, destState: undefined }))}
                  onDone={() => {
                    close();
                    submit();
                  }}
                />
              </div>
            )}
          </Popover>
          <Popover label="Delivery date" active={!!(f.deliveryFrom || f.deliveryTo)}>
            {(close) => (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label>From</label>
                    <input type="date" className="input" value={f.deliveryFrom ?? ""} onChange={(e) => set("deliveryFrom", e.target.value || undefined)} />
                  </div>
                  <div className="field">
                    <label>To</label>
                    <input type="date" className="input" value={f.deliveryTo ?? ""} onChange={(e) => set("deliveryTo", e.target.value || undefined)} />
                  </div>
                </div>
                <PopFooter
                  onClear={() => setF((p) => ({ ...p, deliveryFrom: undefined, deliveryTo: undefined }))}
                  onDone={() => {
                    close();
                    submit();
                  }}
                />
              </div>
            )}
          </Popover>
          {trucks.length > 0 && (
            <Popover label="From my truck" width={300}>
              {(close) => (
                <div>
                  <div className="mb-2 text-[12px] text-muted">Fills origin, equipment, dates, weight and length from the truck.</div>
                  {trucks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        close();
                        fromTruck(t);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-hover"
                    >
                      <Truck size={14} className="text-muted" />
                      <span className="font-medium">#{t.number}</span>
                      <span className="text-muted">{EQUIPMENT[t.equipment].name}</span>
                      <span className="ml-auto text-[12px]">
                        {t.city}, {t.state}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Popover>
          )}
          <button type="button" className="chip chip-dark" data-active={!!f.rateOnly} onClick={() => navigate({ ...f, rateOnly: !f.rateOnly })}>
            Only bookable
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      {mobile}
      {desktop}
    </>
  );
}
