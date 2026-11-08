import { Suspense } from "react";
import Link from "next/link";
import { Bell, ChevronDown, GraduationCap } from "lucide-react";
import { connection } from "next/server";
import { Sidebar } from "@/components/shell/Sidebar";
import { MobileNav } from "@/components/shell/MobileNav";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { prisma } from "@/lib/db";
import { ensureMarket } from "@/lib/market-service";

async function Account() {
  await connection();
  await ensureMarket();
  const s = await prisma.settings.findUnique({ where: { key: "app" } });
  const initials = (s?.dispatcherName ?? "D")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <Link href="/settings" className="flex items-center gap-2.5 rounded px-1 py-1 hover:bg-surface md:px-2">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-50 text-[11px] font-bold text-primary">{initials}</span>
      <span className="hidden leading-tight md:block">
        <span className="block text-[12.5px] font-medium">{s?.dispatcherName ?? "Dispatcher"}</span>
        <span className="block text-[11px] text-muted">{s?.carrierName ?? ""}</span>
      </span>
      <ChevronDown size={14} className="hidden text-faint md:block" />
    </Link>
  );
}

async function Notifications() {
  await connection();
  const [negotiating, toDispatch] = await Promise.all([
    prisma.negotiation.count({ where: { status: { in: ["OPEN", "ON_HOLD", "AGREED"] }, load: { status: "NEGOTIATING" } } }),
    prisma.load.count({ where: { status: "BOOKED" } }),
  ]);
  const n = negotiating + toDispatch;
  return (
    <Link href="/my-loads" className="relative grid h-8 w-8 place-items-center rounded hover:bg-surface" title={`${negotiating} open negotiation(s), ${toDispatch} booked load(s) to dispatch`}>
      <Bell size={17} className="text-ink-2" />
      {n > 0 && <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">{n}</span>}
    </Link>
  );
}

async function TrainingBanner() {
  await connection();
  const a = await prisma.trainingAttempt.findFirst({ where: { status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
  if (!a) return null;
  return (
    <Link href="/training" className="no-print flex items-center gap-3 border-b border-violet-line bg-violet-50 px-4 py-2 text-[12.5px] text-violet-ink md:px-5">
      <GraduationCap size={16} className="shrink-0" />
      <span className="shrink-0 font-bold tracking-wide uppercase">{a.difficulty.toLowerCase()}</span>
      <span className="min-w-0 truncate">{a.brief}</span>
      <span className="ml-auto hidden shrink-0 font-medium text-violet md:inline">Open scenario</span>
    </Link>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        footer={
          <div className="px-4 py-3 text-[11px] text-sidebar-text/60">
            Training simulator · fictional data
          </div>
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 md:gap-4 md:px-5">
          <Link href="/loads/search" className="flex items-center gap-2 md:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-[13px] font-bold text-white">LD</span>
            <span className="text-[15px] font-bold">LoadDesk</span>
          </Link>
          <div className="hidden md:block">
            <GlobalSearch />
          </div>
          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <Suspense fallback={<div className="h-8 w-8" />}>
              <Notifications />
            </Suspense>
            <Suspense fallback={<div className="skeleton h-7 w-7 md:w-40" />}>
              <Account />
            </Suspense>
          </div>
        </header>
        <Suspense fallback={null}>
          <TrainingBanner />
        </Suspense>
        <main className="scroll-thin flex min-h-0 flex-1 flex-col overflow-auto pb-safe">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
