"use client";

import { Time } from "@/components/ui/Time";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Phone, RefreshCw, X, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { createLocalStore, useLocalStore } from "@/lib/local-store";
import { CreditBadge, EquipBadge, Empty, ErrorNote } from "@/components/ui";
import { LoadDetailView } from "@/components/load/LoadDetailView";
import { money, rpmFmt, shortDay } from "@/lib/format";
import { PAGE_SIZE, SORTS, type SortKey } from "@/lib/search-params";
import type { LoadRow } from "@/lib/queries/loads";
import type { LaneBand, LoadDetailJson } from "@/lib/client-types";
import { api } from "@/lib/api-client";
import { findCity } from "@/lib/sim/geo";

/** Loads this viewer has opened (blue "new" dot disappears). */
const viewedStore = createLocalStore<string[]>("ld.viewed", []);

function DetailSkeleton() {
  return (
    <div className="space-y-3 p-5">
      <div className="skeleton h-4 w-40" />
      <div className="skeleton h-6 w-72" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
      <div className="skeleton h-52" />
      <div className="skeleton h-24" />
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
  warnings,
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
  warnings: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ load: LoadDetailJson; band: LaneBand } | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const viewedList = useLocalStore(viewedStore);
  const viewed = useMemo(() => new Set(viewedList), [viewedList]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailErr(null);
    try {
      setDetail(await api<{ load: LoadDetailJson; band: LaneBand }>(`/api/loads/${id}`));
    } catch (e) {
      setDetailErr((e as Error).message);
    }
  }, []);

  function openRow(id: string) {
    setSelected(id);
    setDetail(null);
    loadDetail(id);
    const list = viewedStore.read();
    if (!list.includes(id)) viewedStore.write([...list, id].slice(-800));
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

  const origin = findCity(params.get("o"));
  const selRow = rows.find((r) => r.id === selected);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* results header */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-white px-4 py-2.5">
        <button className="text-muted hover:text-primary" title="Refresh results" onClick={() => start(() => router.refresh())}>
          <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
        </button>
        <div className="leading-tight">
          <div className="text-[15px] font-bold">{total.toLocaleString("en-US")} Results</div>
          <div className="text-[11.5px] text-muted">
            {originLabel ?? "Anywhere"} → {destLabel ?? "Anywhere"}
          </div>
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
        <div className="ml-auto flex items-center gap-5 text-[12.5px]">
          <span className="font-medium tracking-wide uppercase">
            <span className="text-muted">$ Lane rate: </span>
            {laneAvgRate != null ? `${money(Math.round(laneAvgRate / 25) * 25)} (${rpmFmt(laneAvgRpm)}/mi)` : "—"}
          </span>
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="border-b border-[#f2d7ad] bg-warn-50 px-4 py-1.5 text-[12.5px] text-warn">
          <AlertTriangle size={13} className="mr-1 inline" /> {warnings.join(" ")}
        </div>
      )}

      <div className={`scroll-thin min-h-0 flex-1 overflow-auto bg-white transition-opacity ${pending ? "opacity-60" : ""}`}>
        {rows.length === 0 ? (
          <Empty title="No loads match your search" icon={<span className="text-4xl">🚚</span>}>
            Widen the deadhead radius, remove a filter, or search a nearby market. New loads are posted continuously.
          </Empty>
        ) : (
          <table className="dt">
            <thead>
              <tr>
                <th className="w-5" />
                <th>{sortHead("Age", "newest", "newest")}</th>
                <th className="text-right">{sortHead("Rate", "rate_asc", "rate_desc")}</th>
                <th>{sortHead("Trip", "miles_asc", "miles_desc")}</th>
                <th className="text-right">{hasOriginCity ? sortHead("DH-O", "dho_asc", "dho_asc") : "DH-O"}</th>
                <th>{sortHead("Pick up", "pickup_asc", "pickup_asc")}</th>
                <th>EQ</th>
                <th className="text-right">Weight · Length</th>
                <th>Commodity</th>
                <th>Company</th>
                <th>CS · DTP</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-selected={r.id === selected} className="cursor-pointer" onClick={() => openRow(r.id)}>
                  <td className="pr-0">{!viewed.has(r.id) && <span className="block h-2 w-2 rounded-full bg-primary" title="New" />}</td>
                  <td className="tnum text-muted"><Time value={r.postedAt} format="age" /></td>
                  <td className="tnum text-right">
                    {r.rate != null ? (
                      <>
                        <div className="font-medium">{money(r.rate)}</div>
                        <div className="text-[11.5px] text-muted">{rpmFmt(r.rpm)}*/mi</div>
                      </>
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="tnum w-10 font-medium text-primary">{r.miles}</span>
                      <div className="leading-[1.3]">
                        <div>
                          <span className="mr-1 text-faint">○</span>
                          {r.originCity}, {r.originState}
                        </div>
                        <div>
                          <span className="mr-1 text-primary">●</span>
                          {r.destCity}, {r.destState}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="tnum text-right leading-[1.3] text-muted">
                    <div>({r.dho})</div>
                    {r.dhd != null && <div>({r.dhd})</div>}
                  </td>
                  <td className="tnum whitespace-nowrap">
                    {shortDay(r.pickupDate)}
                    <span className="text-muted"> – {shortDay(r.deliveryDate)}</span>
                  </td>
                  <td>
                    <EquipBadge code={r.equipment} />
                  </td>
                  <td className="tnum text-right leading-[1.3] whitespace-nowrap">
                    <div>{r.weight.toLocaleString("en-US")} lbs</div>
                    <div className="text-[11.5px] text-muted">
                      {r.lengthFt} ft · {r.size === "FULL" ? "Full" : "Partial"}
                    </div>
                  </td>
                  <td className="max-w-[170px]">
                    <div className="truncate" title={r.commodity}>
                      {r.commodity}
                    </div>
                    <div className="flex gap-1 text-[10.5px]">
                      {r.tarps && <span className="rounded bg-primary-50 px-1 text-primary">TARP</span>}
                      {r.oversize && <span className="rounded bg-warn-50 px-1 text-warn">OS/OW</span>}
                      {r.status === "NEGOTIATING" && <span className="rounded bg-warn-50 px-1 text-warn">IN TALKS</span>}
                    </div>
                  </td>
                  <td className="max-w-[190px] leading-[1.3]">
                    <div className="truncate font-medium" title={r.brokerName}>
                      {r.brokerName}
                    </div>
                    <div className="tnum text-[11.5px] text-muted">{r.contactPhone}</div>
                  </td>
                  <td className="text-[12px]">
                    <CreditBadge cs={r.creditScore} dtp={r.daysToPay} />
                  </td>
                  <td>
                    <button
                      className="grid h-7 w-7 place-items-center rounded text-good hover:bg-good-50"
                      title="Open & call broker"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRow(r.id);
                      }}
                    >
                      <Phone size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* pagination */}
      <div className="flex items-center justify-between border-t border-line bg-white px-4 py-2 text-[12.5px]">
        <span className="text-muted">
          {total ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(total, page * PAGE_SIZE)} of ${total.toLocaleString("en-US")}` : "No results"}
        </span>
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

      {/* detail drawer */}
      {selected && (
        <>
          <div className="absolute inset-0 z-10 bg-[#0b1626]/10" onClick={() => setSelected(null)} />
          <div className="slide-in scroll-thin absolute top-0 right-0 bottom-0 z-20 w-[620px] max-w-full overflow-y-auto border-l border-line bg-white shadow-2xl">
            <div className="sticky top-0 z-[500] flex items-center justify-between border-b border-line bg-white/95 px-5 py-2 backdrop-blur">
              <span className="text-[12px] font-medium text-muted">Load details</span>
              <button className="rounded p-1 text-muted hover:bg-surface hover:text-ink" onClick={() => setSelected(null)} aria-label="Close details">
                <X size={18} />
              </button>
            </div>
            {detailErr ? (
              <div className="p-5">
                <ErrorNote>{detailErr}</ErrorNote>
              </div>
            ) : detail ? (
              <LoadDetailView
                key={detail.load.id}
                data={detail}
                compact
                dho={hasOriginCity ? selRow?.dho ?? null : null}
                searchOrigin={origin ? { lat: origin.lat, lng: origin.lon, label: `Search origin: ${origin.n}, ${origin.s}` } : null}
                onChanged={() => loadDetail(selected)}
              />
            ) : (
              <DetailSkeleton />
            )}
          </div>
        </>
      )}
    </div>
  );
}
