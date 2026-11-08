"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronLeft, ChevronRight, DollarSign, EyeOff, Gauge, RefreshCw, Truck, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useMemo, useState, useTransition } from "react";
import { Time } from "@/components/ui/Time";
import { Empty, ErrorNote } from "@/components/ui";
import { LoadExpand } from "@/components/load/LoadExpand";
import { BookLoad } from "@/components/load/BookLoad";
import { useLoadContext } from "@/components/load/useLoadContext";
import { createLocalStore, useLocalStore } from "@/lib/local-store";
import { money, rpmFmt, shortDay } from "@/lib/format";
import { PAGE_SIZE, SORTS, type SortKey } from "@/lib/search-params";
import type { LoadRow } from "@/lib/queries/loads";
import type { LaneBand, LoadDetailJson } from "@/lib/client-types";
import { api } from "@/lib/api-client";
import { findCity } from "@/lib/sim/geo";
import { EQUIPMENT } from "@/lib/sim/data/freight";
import { laneQuotes, marketIndex } from "@/lib/sim/market";
import type { EquipCode } from "@/lib/sim/types";

/** Loads this viewer has opened (blue "new" dot disappears). */
const viewedStore = createLocalStore<string[]>("ld.viewed", []);
/** Loads marked "not interested". */
const hiddenStore = createLocalStore<string[]>("ld.hidden", []);
/** Show the "similar results" section. */
const similarPref = createLocalStore<boolean>("ld.includeSimilar", true);

type Detail = { load: LoadDetailJson; band: LaneBand };

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-5 w-48" />
          <div className="skeleton h-32" />
        </div>
      ))}
    </div>
  );
}

function MarketConditions() {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 86400000);
  const rows = (["F", "SD", "CN", "HS", "V", "R"] as EquipCode[]).map((e) => {
    const idx = marketIndex(e, now);
    const prev = marketIndex(e, lastWeek);
    return { e, idx, change: idx / prev - 1, rpm: ((EQUIPMENT[e].rpm[0] + EQUIPMENT[e].rpm[1]) / 2) * idx };
  });
  return (
    <div className="relative">
      <button className="flex items-center gap-1.5 text-[12px] font-medium tracking-wide uppercase hover:text-primary" onClick={() => setOpen((o) => !o)}>
        <Gauge size={15} /> Market conditions
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="pop absolute top-7 right-0 z-40 w-[320px] rounded-md border border-line bg-panel p-4 shadow-xl">
            <div className="mb-1 font-bold">Market conditions — this week</div>
            <div className="mb-3 text-[12px] text-muted">National average spot RPM by equipment and change vs last week.</div>
            {rows.map((r) => (
              <div key={r.e} className="flex items-center gap-2 border-b border-line py-1.5 text-[13px] last:border-0">
                <span className="w-7 font-bold">{r.e}</span>
                <span className="flex-1">{EQUIPMENT[r.e].name}</span>
                <span className="tnum font-medium">{rpmFmt(r.rpm)}</span>
                <span className={`tnum w-16 text-right text-[12px] ${r.change >= 0 ? "text-good" : "text-bad"}`}>
                  {r.change >= 0 ? "▲" : "▼"} {(Math.abs(r.change) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
            <div className="mt-2 text-[11px] text-muted">
              {rows.filter((r) => r.idx > 1.02).length > 3 ? "Tight capacity — push for higher rates." : rows.filter((r) => r.idx < 0.98).length > 3 ? "Soft market — brokers have leverage." : "Balanced market."}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ResultsTable({
  rows,
  total,
  page,
  pages,
  laneAvgRate,
  laneAvgRpm,
  sort,
  originLabel,
  destLabel,
  hasOriginCity,
  hasDestCity,
  warnings,
  similar,
}: {
  rows: LoadRow[];
  total: number;
  page: number;
  pages: number;
  laneAvgRate: number | null;
  laneAvgRpm: number | null;
  sort: SortKey;
  originLabel?: string;
  destLabel?: string;
  hasOriginCity: boolean;
  hasDestCity: boolean;
  warnings: string[];
  similar: { rows: LoadRow[]; total: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const ctx = useLoadContext();
  const [selected, setSelected] = useState<string | null>(null);
  const [initialAction, setInitialAction] = useState<"call" | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [quickBook, setQuickBook] = useState<LoadRow | null>(null);
  const viewedList = useLocalStore(viewedStore);
  const viewed = useMemo(() => new Set(viewedList), [viewedList]);
  const hiddenList = useLocalStore(hiddenStore);
  const hidden = useMemo(() => new Set(hiddenList), [hiddenList]);
  const includeSimilar = useLocalStore(similarPref);

  const visible = rows.filter((r) => !hidden.has(r.id));
  const visibleSimilar = similar.rows.filter((r) => !hidden.has(r.id));
  const hiddenHere = rows.length - visible.length + (similar.rows.length - visibleSimilar.length);
  const origin = findCity(params.get("o"));
  const all = [...rows, ...similar.rows];
  const selRow = all.find((r) => r.id === selected);

  const loadDetail = useCallback(async (id: string) => {
    setDetailErr(null);
    try {
      setDetail(await api<Detail>(`/api/loads/${id}`));
    } catch (e) {
      setDetailErr((e as Error).message);
    }
  }, []);

  function openRow(id: string, action: "call" | null = null) {
    if (selected === id && !action) {
      setSelected(null);
      return;
    }
    setSelected(id);
    setInitialAction(action);
    setDetail(null);
    loadDetail(id);
    const list = viewedStore.read();
    if (!list.includes(id)) viewedStore.write([...list, id].slice(-800));
  }

  function hide(ids: string[]) {
    hiddenStore.write([...new Set([...hiddenStore.read(), ...ids])].slice(-1000));
    setChecked([]);
    if (selected && ids.includes(selected)) setSelected(null);
  }

  const hrefWith = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    return `${pathname}${s ? `?${s}` : ""}`;
  };

  const setSort = (s: SortKey) => start(() => router.push(hrefWith({ sort: s === "newest" ? null : s, page: null })));
  const sortHead = (label: string, asc: SortKey, desc: SortKey) => {
    const on = sort === asc || sort === desc;
    return (
      <button className={`inline-flex items-center gap-0.5 uppercase ${on ? "text-primary" : "hover:text-ink"}`} onClick={() => setSort(sort === desc ? asc : desc)}>
        {label}
        {sort === asc ? <ArrowUp size={11} /> : sort === desc ? <ArrowDown size={11} /> : null}
      </button>
    );
  };

  const searchOrigin = origin ? { lat: origin.lat, lng: origin.lon, label: `Search origin: ${origin.n}, ${origin.s}` } : null;
  const expand = (r: LoadRow, layout: "row" | "stack") =>
    detailErr ? (
      <div className="p-4">
        <ErrorNote>{detailErr}</ErrorNote>
      </div>
    ) : detail && detail.load.id === r.id ? (
      <LoadExpand
        key={`${r.id}-${initialAction ?? ""}`}
        data={detail}
        layout={layout}
        dho={hasOriginCity ? r.dho : null}
        dhd={hasDestCity ? r.dhd : null}
        searchOrigin={searchOrigin}
        initialAction={initialAction}
        onChanged={() => loadDetail(r.id)}
        onHide={() => hide([r.id])}
      />
    ) : (
      <DetailSkeleton />
    );

  // ---------------- desktop row
  const tableRow = (r: LoadRow) => {
    const isOpen = r.id === selected;
    const verified = r.creditScore >= 85;
    return (
      <Fragment key={r.id}>
        <tr data-selected={isOpen} className="cursor-pointer" onClick={() => openRow(r.id)}>
          <td className="w-8 pr-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${viewed.has(r.id) ? "bg-transparent" : "bg-primary"}`} />
              <input
                type="checkbox"
                aria-label={`Select ${r.ref}`}
                className="h-3.5 w-3.5"
                checked={checked.includes(r.id)}
                onChange={(e) => setChecked((c) => (e.target.checked ? [...c, r.id] : c.filter((x) => x !== r.id)))}
              />
            </div>
          </td>
          <td className="tnum text-primary">
            <Time value={r.postedAt} format="age" />
          </td>
          <td className="tnum text-right">
            {r.rate != null ? (
              <>
                <div className="font-medium">{money(r.rate)}</div>
                <div className="text-[11px] text-muted">{rpmFmt(r.rpm)}*/mi</div>
              </>
            ) : (
              <span className="text-muted">–</span>
            )}
          </td>
          <td className="w-6 px-0 text-center">{verified && <Check size={15} className="inline text-primary" strokeWidth={2.6} aria-label="Verified broker" />}</td>
          <td className="tnum font-medium text-primary">{r.miles}</td>
          <td className="max-w-[150px] truncate font-medium" title={`${r.originCity}, ${r.originState}`}>
            {r.originCity}, {r.originState}
          </td>
          <td className="tnum text-muted">({r.dho})</td>
          <td className="px-0 text-primary">
            <ArrowRight size={14} />
          </td>
          <td className="max-w-[150px] truncate font-medium" title={`${r.destCity}, ${r.destState}`}>
            {r.destCity}, {r.destState}
          </td>
          <td className="tnum text-muted">{r.dhd != null ? `(${r.dhd})` : ""}</td>
          <td className="tnum">{shortDay(r.pickupDate)}</td>
          <td className="leading-[1.3]">
            <div className="flex items-center gap-2">
              <span className="w-5 font-bold">{r.equipment}</span>
              <span>{EQUIPMENT[r.equipment].name}</span>
              {r.tarps && <span className="rounded bg-primary-50 px-1 text-[10px] font-medium text-primary">TARP</span>}
              {r.oversize && <span className="rounded bg-warn-50 px-1 text-[10px] font-medium text-warn">OS/OW</span>}
            </div>
            <div className="pl-7 text-[11px] text-muted">
              {r.lengthFt} ft | {r.weight.toLocaleString("en-US")} lbs | {r.size === "FULL" ? "Full" : "Partial"}
            </div>
          </td>
          <td className="max-w-[200px] leading-[1.3]">
            <div className="truncate font-medium text-primary" title={r.brokerName}>
              {r.brokerName}
            </div>
            <div className="tnum text-[11.5px] text-muted">{r.contactPhone}</div>
          </td>
          <td className="tnum text-[12px] leading-[1.3] whitespace-nowrap">
            <div className={r.creditScore >= 90 ? "text-good" : r.creditScore >= 80 ? "text-warn" : "text-bad"}>{r.creditScore} CS</div>
            <div className="text-muted">{r.daysToPay} DTP</div>
          </td>
          <td className="text-right" onClick={(e) => e.stopPropagation()}>
            {r.status === "NEGOTIATING" ? (
              <span className="text-[11px] font-medium text-warn">IN TALKS</span>
            ) : r.rate != null ? (
              <button className="text-[12px] font-bold tracking-wide text-primary hover:underline" onClick={() => setQuickBook(r)}>
                BOOK
              </button>
            ) : (
              <span className="text-muted">–</span>
            )}
          </td>
        </tr>
        {isOpen && (
          <tr>
            <td colSpan={15} className="p-0">
              {expand(r, "row")}
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  // ---------------- phone card
  const card = (r: LoadRow) => {
    const spot = laneQuotes(r.id, r.marketRate, r.miles).spot;
    return (
      <div key={r.id} className="rounded-xl border border-line bg-panel p-4">
        <button className="w-full text-left" onClick={() => openRow(r.id)}>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-50 text-primary">
              <Truck size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium">{r.brokerName}</div>
              <div className="text-[11.5px] text-muted">
                {r.equipment} · {EQUIPMENT[r.equipment].name} · {r.lengthFt} ft · {r.weight.toLocaleString("en-US")} lbs · {r.size === "FULL" ? "Full" : "Partial"}
              </div>
            </div>
            <span className={`tnum text-right text-[11px] leading-tight ${r.creditScore >= 90 ? "text-good" : r.creditScore >= 80 ? "text-warn" : "text-bad"}`}>
              {r.creditScore} CS
              <span className="block text-muted">{r.daysToPay} DTP</span>
            </span>
          </div>
          <div className="mt-3 flex gap-3">
            <div className="flex flex-col items-center pt-1.5">
              <span className="h-2 w-2 rounded-[2px] bg-primary" />
              <span className="my-0.5 h-8 border-l border-dashed border-faint" />
              <span className="h-2 w-2 rounded-[2px] border border-primary" />
            </div>
            <div className="min-w-0 flex-1 text-[13px]">
              <div className="text-[11px] text-muted">Pick Up</div>
              <div className="font-medium">
                {r.originCity}, {r.originState} <span className="text-muted">({r.dho} mi)</span>
              </div>
              <div className="text-[11.5px] text-muted">{shortDay(r.pickupDate)}</div>
              <div className="mt-1.5 text-[11px] text-muted">Drop Off</div>
              <div className="font-medium">
                {r.destCity}, {r.destState}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              ["Trip", `${r.miles.toLocaleString("en-US")} mi`],
              ["Rate", r.rate != null ? `${money(r.rate)}` : "Call"],
              ["3D Market", money(spot.rate)],
              ["Age", <Time key="age" value={r.postedAt} format="age" />],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-md bg-surface px-3 py-2 text-center">
                <div className="text-[10.5px] tracking-wide text-muted uppercase">{k}</div>
                <div className="tnum text-[15px] font-bold">{v}</div>
              </div>
            ))}
          </div>
          {r.rate != null && <div className="mt-1 text-center text-[11px] text-muted">{rpmFmt(r.rpm)}/mi posted</div>}
        </button>
        <div className="mt-3 flex flex-col gap-2">
          {r.status === "NEGOTIATING" ? (
            <button className="btn btn-primary btn-pill h-11 w-full" onClick={() => openRow(r.id)}>
              In talks — open
            </button>
          ) : (
            <button className="btn btn-primary btn-pill h-11 w-full" disabled={r.rate == null} onClick={() => setQuickBook(r)}>
              {r.rate != null ? `Book load ${money(r.rate)}` : "No rate — call broker"}
            </button>
          )}
          <button className="btn btn-outline btn-pill h-11 w-full" onClick={() => openRow(r.id, "call")}>
            Call
          </button>
        </div>
      </div>
    );
  };

  const header = (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-panel px-4 py-2.5">
      <button className="text-muted hover:text-primary" title="Refresh results" onClick={() => start(() => router.refresh())}>
        <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
      </button>
      <div className="leading-tight">
        <div className="text-[15px] font-bold">{total.toLocaleString("en-US")} Results</div>
        <div className="text-[11.5px] text-muted">{similar.total > 0 ? `+${similar.total} Similar Results` : `${originLabel ?? "Anywhere"} → ${destLabel ?? "Anywhere"}`}</div>
      </div>
      <label className="flex items-center gap-1.5 text-[13px]">
        <span className="text-muted">Sort by</span>
        <select className="cursor-pointer bg-transparent font-medium text-primary outline-none" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      {hiddenHere > 0 && (
        <button className="text-[12px] text-primary hover:underline" onClick={() => hiddenStore.write([])}>
          {hiddenHere} hidden · show all
        </button>
      )}
      <div className="ml-auto hidden items-center gap-5 text-[12px] md:flex">
        <span className="flex items-center gap-1 font-medium tracking-wide uppercase">
          <DollarSign size={14} />
          Lane rate: {laneAvgRate != null ? `${money(Math.round(laneAvgRate / 25) * 25)} (${rpmFmt(laneAvgRpm)}/mi)` : "—"}
        </span>
        <MarketConditions />
      </div>
    </div>
  );

  const pager = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-panel px-4 py-2 text-[12.5px]">
      <span className="text-muted">{total ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(total, page * PAGE_SIZE)} of ${total.toLocaleString("en-US")}` : "No results"}</span>
      <div className="flex items-center gap-1">
        <Link aria-disabled={page <= 1} className={`btn btn-outline btn-sm ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={hrefWith({ page: page > 2 ? String(page - 1) : null })}>
          <ChevronLeft size={14} /> Prev
        </Link>
        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2)
          .map((p, i, arr) => (
            <span key={p} className="flex items-center">
              {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-faint">…</span>}
              <Link href={hrefWith({ page: p > 1 ? String(p) : null })} className={`tnum grid h-[26px] min-w-[26px] place-items-center rounded px-1 ${p === page ? "bg-primary text-white" : "hover:bg-surface"}`}>
                {p}
              </Link>
            </span>
          ))}
        <Link aria-disabled={page >= pages} className={`btn btn-outline btn-sm ${page >= pages ? "pointer-events-none opacity-40" : ""}`} href={hrefWith({ page: String(page + 1) })}>
          Next <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );

  const empty = (
    <Empty title="No loads match your search" icon={<Truck size={36} />}>
      Widen the deadhead radius, remove a filter, or search a nearby market. New loads are posted continuously.
    </Empty>
  );

  const similarToggle = (
    <label className="flex cursor-pointer items-center gap-2 text-[12px]">
      Include Similar Results
      <button
        type="button"
        role="switch"
        aria-checked={includeSimilar}
        onClick={() => similarPref.write(!includeSimilar)}
        className={`relative h-5 w-9 rounded-full transition-colors ${includeSimilar ? "bg-primary" : "bg-line-2"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${includeSimilar ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {header}
      {warnings.length > 0 && (
        <div className="border-b border-warn-line bg-warn-50 px-4 py-1.5 text-[12.5px] text-warn">
          <AlertTriangle size={13} className="mr-1 inline" /> {warnings.join(" ")}
        </div>
      )}
      {checked.length > 0 && (
        <div className="hidden items-center gap-3 border-b border-line bg-select px-4 py-1.5 text-[12.5px] md:flex">
          <b>{checked.length} selected</b>
          <button className="flex items-center gap-1 text-primary hover:underline" onClick={() => hide(checked)}>
            <EyeOff size={13} /> Hide (not interested)
          </button>
          <button className="text-muted hover:underline" onClick={() => setChecked([])}>
            Clear selection
          </button>
        </div>
      )}

      {/* desktop table */}
      <div className={`scroll-thin hidden min-h-0 flex-1 overflow-auto bg-panel transition-opacity md:block ${pending ? "opacity-60" : ""}`}>
        {visible.length === 0 && !(includeSimilar && visibleSimilar.length) ? (
          empty
        ) : (
          <table className="dt">
            <thead>
              <tr>
                <th className="w-8" />
                <th>{sortHead("Age", "newest", "newest")}</th>
                <th className="text-right">{sortHead("Rate", "rate_asc", "rate_desc")}</th>
                <th className="w-6 px-0" />
                <th>{sortHead("Trip", "miles_asc", "miles_desc")}</th>
                <th>Origin</th>
                <th>{hasOriginCity ? sortHead("DH-O", "dho_asc", "dho_asc") : "DH-O"}</th>
                <th className="px-0" />
                <th>Destination</th>
                <th>DH-D</th>
                <th>{sortHead("Pick up", "pickup_asc", "pickup_asc")}</th>
                <th>Equipment</th>
                <th>Company</th>
                <th>CS · DTP</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map(tableRow)}
              {similar.total > 0 && (
                <tr className="pointer-events-auto hover:bg-transparent">
                  <td colSpan={15} className="bg-surface py-2.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[15px] font-bold">{similar.total} Similar Results</span>
                      {similarToggle}
                    </div>
                  </td>
                </tr>
              )}
              {includeSimilar && visibleSimilar.map(tableRow)}
            </tbody>
          </table>
        )}
      </div>

      {/* phone cards */}
      <div className={`flex flex-col gap-3 p-3 md:hidden ${pending ? "opacity-60" : ""}`}>
        {visible.length === 0 && !(includeSimilar && visibleSimilar.length) ? empty : visible.map(card)}
        {similar.total > 0 && (
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="text-[14px] font-bold">{similar.total} Similar Results</span>
            {similarToggle}
          </div>
        )}
        {includeSimilar && visibleSimilar.map(card)}
      </div>

      {pager}

      {/* phone: full-screen load details */}
      {selected && (
        <div className="fixed inset-0 z-[960] flex flex-col bg-surface md:hidden">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-2">
            <button className="grid h-10 w-10 place-items-center text-ink" aria-label="Back to results" onClick={() => setSelected(null)}>
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0 truncate text-[15px] font-bold">{selRow ? `${selRow.originCity}, ${selRow.originState} → ${selRow.destCity}, ${selRow.destState}` : "Load details"}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{selRow && expand(selRow, "stack")}</div>
        </div>
      )}

      {quickBook && (
        <BookLoad
          open
          onClose={() => {
            setQuickBook(null);
            router.refresh();
            ctx.reload();
          }}
          load={{
            id: quickBook.id,
            ref: quickBook.ref,
            lane: `${quickBook.originCity}, ${quickBook.originState} → ${quickBook.destCity}, ${quickBook.destState}`,
            miles: quickBook.miles,
            weight: quickBook.weight,
            lengthFt: quickBook.lengthFt,
            equipment: quickBook.equipment,
            rate: quickBook.rate,
          }}
          agreedRate={null}
          trucks={ctx.trucks}
          drivers={ctx.drivers}
          costPerMile={ctx.costPerMile}
          onBooked={() => {
            router.refresh();
            ctx.reload();
          }}
        />
      )}
    </div>
  );
}
