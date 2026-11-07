import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getMyLoadCounts, getMyLoadRows, MY_TABS, type MyTab } from "@/lib/queries/my-loads";
import { MyLoadsTable } from "@/components/dispatch/MyLoadsTable";
import { STATUS_LABEL } from "@/lib/sim/equipment";

export const metadata: Metadata = { title: "My Loads" };

function TableSkeleton() {
  return (
    <div className="card m-5 p-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="mb-3 flex gap-4">
          <div className="skeleton h-8 w-20" />
          <div className="skeleton h-8 w-56" />
          <div className="skeleton h-8 w-24" />
          <div className="skeleton h-8 w-32" />
          <div className="skeleton h-8 flex-1" />
        </div>
      ))}
    </div>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/my-loads">["searchParams"] }) {
  const sp = await searchParams;
  const raw = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab)?.toUpperCase();
  const { counts, contacted } = await getMyLoadCounts();
  // default to the first tab that has something to do
  const tab: MyTab = (MY_TABS as readonly string[]).includes(raw ?? "")
    ? (raw as MyTab)
    : ((["NEGOTIATING", "BOOKED", "DISPATCHED", "IN_TRANSIT"] as const).find((t) => counts[t] > 0) ?? "BOOKED");
  const rows = await getMyLoadRows(tab, contacted);
  const activeRevenue = rows.reduce((a, r) => a + (r.bookedRate ?? 0), 0);
  return (
    <>
      <div className="flex gap-1 border-b border-line bg-white px-5">
        {MY_TABS.map((t) => (
          <Link
            key={t}
            href={`/my-loads?tab=${t}`}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium ${t === tab ? "border-primary text-primary" : "border-transparent text-ink-2 hover:text-ink"}`}
          >
            {t === "AVAILABLE" ? "Available (contacted)" : STATUS_LABEL[t]}
            <span className={`tnum rounded-full px-1.5 text-[11px] ${t === tab ? "bg-primary text-white" : "bg-surface text-muted"}`}>{counts[t]}</span>
          </Link>
        ))}
      </div>
      <div className="p-5">
        <MyLoadsTable tab={tab} rows={JSON.parse(JSON.stringify(rows))} totalRevenue={activeRevenue} />
      </div>
    </>
  );
}

export default function MyLoadsPage(props: PageProps<"/my-loads">) {
  return (
    <div className="flex flex-col">
      <div className="flex items-end justify-between bg-white px-5 pt-4 pb-3">
        <div>
          <h1 className="text-[20px] font-bold">My Loads</h1>
          <p className="text-[13px] text-muted">Track every load from first call to delivery. Update statuses, assign trucks and drivers.</p>
        </div>
        <Link href="/loads/search" className="btn btn-primary">
          Find loads
        </Link>
      </div>
      <Suspense fallback={<TableSkeleton />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
