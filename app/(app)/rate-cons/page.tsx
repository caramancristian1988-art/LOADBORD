import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { Empty, StatusBadge } from "@/components/ui";
import { longDay, money } from "@/lib/format";

export const metadata: Metadata = { title: "Rate Confirmations" };

async function Content({ searchParams }: { searchParams: PageProps<"/rate-cons">["searchParams"] }) {
  const sp = await searchParams;
  const loads = await prisma.load.findMany({
    where: { rateConNo: { not: null } },
    orderBy: { bookedAt: "desc" },
    select: { id: true, ref: true, rateConNo: true, status: true, bookedRate: true, bookedAt: true, originCity: true, originState: true, destCity: true, destState: true, brokerName: true },
    take: 200,
  });
  if (!loads.length) {
    return (
      <div className="card">
        <Empty title="No rate confirmations yet" icon={<FileText size={36} />}>
          A rate confirmation is generated every time you book a load.{" "}
          <Link href="/loads/search" className="text-primary hover:underline">
            Find a load
          </Link>
        </Empty>
      </div>
    );
  }
  const selectedId = typeof sp.id === "string" ? sp.id : loads[0].id;
  const selected = loads.find((l) => l.id === selectedId) ?? loads[0];
  return (
    <div className="grid min-h-0 grid-cols-1 gap-4 md:grid-cols-[320px_1fr] lg:grid-cols-[380px_1fr]">
      <div className="card scroll-thin max-h-[calc(100vh-170px)] overflow-y-auto">
        <ul className="divide-y divide-line">
          {loads.map((l) => (
            <li key={l.id}>
              <Link href={`/rate-cons?id=${l.id}`} className={`block px-4 py-3 hover:bg-hover ${l.id === selected.id ? "bg-select" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12.5px] font-medium">{l.rateConNo}</span>
                  <StatusBadge status={l.status} />
                </div>
                <div className="mt-0.5 text-[13px]">
                  {l.originCity}, {l.originState} → {l.destCity}, {l.destState}
                </div>
                <div className="flex justify-between text-[12px] text-muted">
                  <span>
                    {l.ref} · {l.brokerName}
                  </span>
                  <span className="tnum font-medium text-ink">{money(l.bookedRate)}</span>
                </div>
                <div className="text-[11.5px] text-muted">{longDay(l.bookedAt)}</div>
              </Link>
              <a className="btn btn-outline btn-pill mx-4 mb-3 flex h-9 md:hidden" href={`/api/loads/${l.id}/ratecon`} target="_blank" rel="noreferrer">
                <FileText size={14} /> Open PDF
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="card hidden flex-col overflow-hidden md:flex">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <div className="text-[13px]">
            <b>{selected.rateConNo}</b> · {selected.ref} · {selected.brokerName}
          </div>
          <div className="flex gap-2">
            <a className="btn btn-outline btn-sm" href={`/api/loads/${selected.id}/ratecon?download=1`}>
              <Download size={13} /> Download PDF
            </a>
            <Link className="btn btn-ghost btn-sm" href={`/loads/${selected.id}`}>
              Open load
            </Link>
          </div>
        </div>
        <iframe key={selected.id} title={`Rate confirmation ${selected.rateConNo}`} src={`/api/loads/${selected.id}/ratecon`} className="h-[calc(100vh-215px)] w-full bg-[#525659]" />
      </div>
    </div>
  );
}

export default function RateConsPage(props: PageProps<"/rate-cons">) {
  return (
    <div className="p-3 md:p-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-bold">Rate Confirmations</h1>
        <p className="text-[13px] text-muted">Every booked load gets a broker rate confirmation. Review, print or download them here.</p>
      </div>
      <Suspense fallback={<div className="skeleton h-[60vh]" />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
