import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, GraduationCap, Phone, Search, Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { ensureMarket } from "@/lib/market-service";
import { EquipBadge, Stat, StatusBadge } from "@/components/ui";
import { money, rpmFmt, shortDay } from "@/lib/format";
import { equipName, OPEN_DECK } from "@/lib/sim/equipment";
import { toQuery } from "@/lib/search-params";
import { EQUIPMENT } from "@/lib/sim/data/freight";
import type { EquipCode } from "@/lib/sim/types";

export const metadata: Metadata = { title: "Dashboard" };

function Skel({ h = 96 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h }} />;
}

async function Kpis() {
  await connection();
  await ensureMarket();
  const [available, active, delivered, negotiating, settings] = await Promise.all([
    prisma.load.count({ where: { status: "AVAILABLE" } }),
    prisma.load.findMany({ where: { status: { in: ["BOOKED", "DISPATCHED", "IN_TRANSIT"] } }, select: { bookedRate: true, miles: true } }),
    prisma.load.findMany({ where: { status: "DELIVERED" }, select: { bookedRate: true, miles: true, bookedDeadhead: true } }),
    prisma.negotiation.count({ where: { status: { in: ["OPEN", "ON_HOLD", "AGREED"] }, load: { status: "NEGOTIATING" } } }),
    prisma.settings.findUnique({ where: { key: "app" } }),
  ]);
  const all = [...active, ...delivered];
  const revenue = all.reduce((a, l) => a + (l.bookedRate ?? 0), 0);
  const miles = all.reduce((a, l) => a + l.miles, 0);
  const avgRpm = miles ? revenue / miles : null;
  return (
    <div className="grid grid-cols-5 gap-3">
      <Stat label="Loads on board" value={available.toLocaleString("en-US")} sub="live, refreshed as you work" />
      <Stat label="In negotiation" value={negotiating} sub="open calls & agreed rates" tone={negotiating ? "warn" : undefined} />
      <Stat label="Active loads" value={active.length} sub="booked · dispatched · in transit" />
      <Stat label="Booked revenue" value={money(revenue)} sub={`${all.length} loads total`} />
      <Stat
        label="Avg RPM"
        value={rpmFmt(avgRpm)}
        sub={`target ${rpmFmt(settings?.targetRpm)}`}
        tone={avgRpm == null ? undefined : avgRpm >= (settings?.targetRpm ?? 2.5) ? "good" : "bad"}
      />
    </div>
  );
}

async function Fleet() {
  await connection();
  const trucks = await prisma.truck.findMany({ include: { driver: true }, orderBy: { number: "asc" } });
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-bold">Fleet status</h2>
        <Link href="/trucks" className="text-[12.5px] text-primary hover:underline">
          Manage trucks
        </Link>
      </div>
      {trucks.length === 0 ? (
        <div className="p-6 text-center text-[13px] text-muted">
          No trucks.{" "}
          <Link href="/trucks" className="text-primary hover:underline">
            Add one
          </Link>
        </div>
      ) : (
        <table className="dt">
          <tbody>
            {trucks.map((t) => {
              const avail = t.availableDate.toISOString().slice(0, 10);
              const pf = avail > todayIso ? avail : todayIso;
              const q = toQuery({ origin: `${t.city}, ${t.state}`, dho: 150, equipment: t.equipment === "SD" ? ["SD", "F"] : t.equipment === "CN" ? ["CN", "F"] : [t.equipment], pickupFrom: pf, weightMax: t.maxWeight });
              return (
                <tr key={t.id}>
                  <td className="w-16 font-bold">#{t.number}</td>
                  <td>
                    <EquipBadge code={t.equipment} full />
                  </td>
                  <td>
                    {t.city}, {t.state}
                  </td>
                  <td className="text-muted">{t.driver?.name ?? "no driver"}</td>
                  <td className="tnum text-muted">avail {shortDay(t.availableDate)}</td>
                  <td>
                    <StatusBadge status={t.status === "AVAILABLE" ? "AVAILABLE_TRUCK" : t.status} label={t.status === "AVAILABLE" ? "Empty" : t.status === "ON_LOAD" ? "On load" : "Out of service"} />
                  </td>
                  <td className="text-right">
                    {t.status !== "OUT_OF_SERVICE" && (
                      <Link href={`/loads/search?${q}`} className="btn btn-outline btn-sm">
                        <Search size={13} /> Find loads
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

async function Activity() {
  await connection();
  const [loads, negs] = await Promise.all([
    prisma.load.findMany({ where: { status: { in: ["BOOKED", "DISPATCHED", "IN_TRANSIT"] } }, orderBy: { pickupDate: "asc" }, take: 6, include: { truck: { select: { number: true } } } }),
    prisma.negotiation.findMany({ where: { status: { in: ["OPEN", "ON_HOLD", "AGREED"] }, load: { status: "NEGOTIATING" } }, orderBy: { updatedAt: "desc" }, take: 5, include: { load: { select: { id: true, ref: true, originCity: true, destCity: true, brokerName: true } } } }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-bold">Active loads</h2>
          <Link href="/my-loads" className="text-[12.5px] text-primary hover:underline">
            My Loads
          </Link>
        </div>
        {loads.length === 0 ? (
          <div className="p-5 text-center text-[13px] text-muted">Nothing booked yet. Find a load and call the broker.</div>
        ) : (
          <ul className="divide-y divide-line">
            {loads.map((l) => (
              <li key={l.id}>
                <Link href={`/loads/${l.id}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-hover">
                  <span className="font-mono text-[12px] text-muted">{l.ref}</span>
                  <span className="flex-1 truncate">
                    {l.originCity}, {l.originState} <ArrowRight size={12} className="inline text-muted" /> {l.destCity}, {l.destState}
                  </span>
                  <span className="tnum">{money(l.bookedRate)}</span>
                  <span className="text-muted">#{l.truck?.number ?? "—"}</span>
                  <StatusBadge status={l.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card">
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-bold">Open negotiations</h2>
        </div>
        {negs.length === 0 ? (
          <div className="p-5 text-center text-[13px] text-muted">No open calls.</div>
        ) : (
          <ul className="divide-y divide-line">
            {negs.map((n) => (
              <li key={n.id}>
                <Link href={`/loads/${n.load.id}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-hover">
                  <Phone size={13} className="text-good" />
                  <span className="font-mono text-[12px] text-muted">{n.load.ref}</span>
                  <span className="flex-1 truncate">
                    {n.load.originCity} → {n.load.destCity} · {n.load.brokerName}
                  </span>
                  <span className={n.status === "AGREED" ? "font-bold text-good" : "text-warn"}>{n.status === "AGREED" ? `agreed ${money(n.agreedRate)}` : `broker at ${money(n.brokerOffer)}`}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

async function Market() {
  await connection();
  const rows = await prisma.load.groupBy({ by: ["equipment"], where: { status: "AVAILABLE" }, _count: { _all: true }, _avg: { rpm: true, rate: true, miles: true } });
  const order: EquipCode[] = ["F", "SD", "CN", "HS", "V", "R", "PO", "BT"];
  const sorted = order.map((e) => rows.find((r) => r.equipment === e)).filter((r): r is NonNullable<typeof r> => !!r);
  const maxRpm = Math.max(...sorted.map((r) => r._avg.rpm ?? 0), 1);
  return (
    <div className="card">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-bold">Market snapshot</h2>
        <p className="text-[12px] text-muted">Average posted RPM on the board by equipment</p>
      </div>
      <div className="space-y-2.5 p-4">
        {sorted.map((r) => (
          <Link key={r.equipment} href={`/loads/search?eq=${r.equipment}&sort=rpm_desc`} className="group flex items-center gap-3 text-[13px]">
            <EquipBadge code={r.equipment} />
            <span className="w-24 shrink-0 truncate text-ink-2 group-hover:text-primary">
              {equipName(r.equipment)}
              {OPEN_DECK.includes(r.equipment) && <span className="ml-1 text-[10px] text-muted">OD</span>}
            </span>
            <span className="relative h-2.5 flex-1 rounded-full bg-surface">
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${((r._avg.rpm ?? 0) / maxRpm) * 100}%`, background: EQUIPMENT[r.equipment].color }} />
            </span>
            <span className="tnum w-14 text-right font-medium">{rpmFmt(r._avg.rpm)}</span>
            <span className="tnum w-20 text-right whitespace-nowrap text-muted">{r._count._all} loads</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

async function TrainingCard() {
  await connection();
  const [active, done] = await Promise.all([
    prisma.trainingAttempt.findFirst({ where: { status: "ACTIVE" } }),
    prisma.trainingAttempt.findMany({ where: { status: "COMPLETED" }, select: { score: true }, orderBy: { completedAt: "desc" }, take: 20 }),
  ]);
  const avg = done.length ? Math.round(done.reduce((a, d) => a + (d.score ?? 0), 0) / done.length) : null;
  return (
    <div className="card border-[#d9c7f7] bg-[#faf8ff] p-4">
      <div className="flex items-center gap-2 font-bold text-[#3b1d78]">
        <GraduationCap size={17} /> Training
      </div>
      {active ? (
        <p className="mt-1 text-[13px]">
          <b>{active.title}:</b> {active.brief}
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-ink-2">Practice with graded dispatch scenarios — beginner to advanced.</p>
      )}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[12.5px] text-muted">{avg != null ? `${done.length} graded · avg ${avg}/100` : "No attempts yet"}</span>
        <Link href="/training" className="btn btn-sm bg-violet text-white hover:bg-[#5b21b6]">
          {active ? "Continue" : "Start a scenario"}
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[20px] font-bold">Dispatch dashboard</h1>
          <p className="text-[13px] text-muted">Your trucks, your loads and the market at a glance.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/trucks" className="btn btn-outline">
            <Truck size={15} /> My trucks
          </Link>
          <Link href="/loads/search?eq=F,SD,CN" className="btn btn-primary">
            <Search size={15} /> Search open deck loads
          </Link>
        </div>
      </div>
      <Suspense fallback={<div className="grid grid-cols-5 gap-3">{Array.from({ length: 5 }, (_, i) => <Skel key={i} h={88} />)}</div>}>
        <Kpis />
      </Suspense>
      <div className="grid grid-cols-[1.4fr_1fr] gap-4">
        <div className="flex flex-col gap-4">
          <Suspense fallback={<Skel h={220} />}>
            <Fleet />
          </Suspense>
          <Suspense fallback={<Skel h={260} />}>
            <Market />
          </Suspense>
        </div>
        <div className="flex flex-col gap-4">
          <Suspense fallback={<Skel h={110} />}>
            <TrainingCard />
          </Suspense>
          <Suspense fallback={<Skel h={300} />}>
            <Activity />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
