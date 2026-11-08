import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getAnalytics, type Analytics } from "@/lib/queries/analytics";
import { Stat } from "@/components/ui";
import { money, pct, rpmFmt } from "@/lib/format";

export const metadata: Metadata = { title: "Analytics" };

function Bars<T extends { key: string }>({ rows, value, label, format, color = "#0b5ed7" }: { rows: T[]; value: (r: T) => number; label: (r: T) => string; format: (n: number) => string; color?: string }) {
  const vals = rows.map((r) => value(r));
  const max = Math.max(...vals, 1);
  if (!rows.length) return <div className="py-8 text-center text-[13px] text-muted">No data yet — book some loads.</div>;
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.key} className="flex items-center gap-3 text-[13px]">
          <span className="w-24 shrink-0 truncate sm:w-44" title={r.key}>
            {r.key}
          </span>
          <span className="relative h-3 flex-1 rounded bg-surface">
            <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${(vals[i] / max) * 100}%`, background: color }} />
          </span>
          <span className="tnum w-20 shrink-0 text-right font-medium sm:w-24">{format(vals[i])}</span>
          <span className="tnum hidden w-36 text-right text-[12px] text-muted sm:block">{label(r)}</span>
        </div>
      ))}
    </div>
  );
}

function DayChart({ days }: { days: Analytics["days"] }) {
  const max = Math.max(...days.map((d) => d.revenue), 1);
  const W = 640;
  const H = 150;
  const bw = W / days.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" role="img" aria-label="Revenue booked per day, last 14 days">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={0} x2={W} y1={H - H * g} y2={H - H * g} stroke="#eef1f5" />
      ))}
      {days.map((d, i) => {
        const h = (d.revenue / max) * (H - 8);
        return (
          <g key={d.day}>
            <rect x={i * bw + bw * 0.18} y={H - h} width={bw * 0.64} height={Math.max(h, d.revenue ? 2 : 0)} rx={3} fill="#0b5ed7">
              <title>{`${d.day}: ${money(d.revenue)} · ${d.loads} load(s)`}</title>
            </rect>
            {d.loads > 0 && (
              <text x={i * bw + bw / 2} y={H - h - 4} textAnchor="middle" fontSize="10" fill="#334155">
                {d.loads}
              </text>
            )}
            <text x={i * bw + bw / 2} y={H + 15} textAnchor="middle" fontSize="10" fill="#64748b">
              {d.day}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

async function Content() {
  await connection();
  const a = await getAnalytics();
  const t = a.totals;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total booked loads" value={t.bookedLoads} sub={`${t.deliveredLoads} delivered`} />
        <Stat label="Total revenue" value={money(t.revenue)} sub={`${money(t.deliveredRevenue)} delivered`} />
        <Stat label="Average rate per mile" value={rpmFmt(t.avgRpm)} sub={`all-in ${rpmFmt(t.allInRpm)} incl. deadhead`} />
        <Stat label="Est. profit" value={money(Math.round(t.estProfit))} sub={`at ${rpmFmt(a.costPerMile)}/mi operating cost`} tone={t.bookedLoads ? (t.estProfit > 0 ? "good" : "bad") : undefined} />
        <Stat label="Total loaded miles" value={t.loadedMiles.toLocaleString("en-US")} />
        <Stat label="Total deadhead miles" value={t.deadheadMiles.toLocaleString("en-US")} sub={`${pct(t.deadheadPct)} of all miles`} tone={t.deadheadPct != null && t.deadheadPct > 0.15 ? "warn" : undefined} />
        <Stat label="Avg revenue per load" value={money(t.avgPerLoad == null ? null : Math.round(t.avgPerLoad))} />
        <Stat label="Booked vs market" value={t.vsMarket == null ? "—" : `${Math.round(t.vsMarket * 100)}%`} sub="of the fair market rate" tone={t.vsMarket == null ? undefined : t.vsMarket >= 1 ? "good" : "warn"} />
      </div>

      <div className="card p-4">
        <h2 className="mb-2 font-bold">Revenue booked — last 14 days</h2>
        <DayChart days={a.days} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 font-bold">Revenue by truck / driver</h2>
          <Bars rows={a.byTruck} value={(r: Analytics["byTruck"][number]) => r.revenue} format={(n) => money(n)} label={(r: Analytics["byTruck"][number]) => `${r.loads} loads · ${rpmFmt(r.rpm)}/mi`} />
        </div>
        <div className="card p-4">
          <h2 className="mb-3 font-bold">RPM by equipment</h2>
          <Bars rows={a.byEquipment} value={(r: Analytics["byEquipment"][number]) => r.rpm} format={(n) => rpmFmt(n)} label={(r: Analytics["byEquipment"][number]) => `${r.loads} loads · ${money(r.revenue)}`} color="#0e9f6e" />
        </div>
        <div className="card p-4">
          <h2 className="mb-3 font-bold">Top brokers by revenue</h2>
          <Bars rows={a.byBroker} value={(r: Analytics["byBroker"][number]) => r.revenue} format={(n) => money(n)} label={(r: Analytics["byBroker"][number]) => `${r.loads} loads · ${rpmFmt(r.rpm)}/mi`} color="#6d28d9" />
        </div>
        <div className="card p-4">
          <h2 className="mb-3 font-bold">Negotiation & training</h2>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
            {[
              ["Broker contacts", `${a.negotiation.total} (${a.negotiation.calls} calls, ${a.negotiation.emails} emails)`],
              ["Deals closed", a.negotiation.won],
              ["Loads lost to other carriers", a.negotiation.lost],
              ["Success rate", pct(a.negotiation.successRate, 0)],
              ["Avg gain over initial offer", money(Math.round(a.negotiation.avgGain))],
              ["Training attempts graded", a.training.attempts],
              ["Average training score", a.training.avg == null ? "—" : `${Math.round(a.training.avg)}/100`],
              ...a.training.byDifficulty.map((d) => [`${d.difficulty.toLowerCase()} avg`, d.avg == null ? "—" : `${Math.round(d.avg)}/100 (${d.count})`]),
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between border-b border-line py-1.5 capitalize-first">
                <span className="text-muted first-letter:uppercase">{k}</span>
                <span className="tnum font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <div className="p-3 md:p-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-bold">Analytics</h1>
        <p className="text-[13px] text-muted">How your dispatching is performing: revenue, RPM, empty miles and negotiation results.</p>
      </div>
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="skeleton h-[88px]" />
            ))}
          </div>
        }
      >
        <Content />
      </Suspense>
    </div>
  );
}
