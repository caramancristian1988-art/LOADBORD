"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { BarChart3, ClipboardList, FileText, GraduationCap, LayoutDashboard, List, Menu, Settings, Truck, X } from "lucide-react";

const TABS = [
  { href: "/loads/search", label: "Load Board", icon: List, match: ["/loads"] },
  { href: "/my-loads", label: "My Loads", icon: ClipboardList, match: ["/my-loads"] },
  { href: "/trucks", label: "My Trucks", icon: Truck, match: ["/trucks"] },
  { href: "/training", label: "Training", icon: GraduationCap, match: ["/training"] },
];

const MORE = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/rate-cons", label: "Rate Confirmations", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Tabs({ path }: { path: string }) {
  const [more, setMore] = useState(false);
  const moreActive = MORE.some((m) => path.startsWith(m.href));
  return (
    <>
      {more && (
        <div className="fixed inset-0 z-[900] bg-overlay md:hidden" onClick={() => setMore(false)}>
          <div className="slide-up absolute right-0 bottom-[calc(60px+env(safe-area-inset-bottom))] left-0 rounded-t-2xl border-t border-line bg-panel p-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="label">More</span>
              <button aria-label="Close menu" className="p-1 text-muted" onClick={() => setMore(false)}>
                <X size={18} />
              </button>
            </div>
            {MORE.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMore(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] ${path.startsWith(href) ? "bg-primary-50 text-primary" : "text-ink"}`}
              >
                <Icon size={19} /> {label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <nav className="no-print fixed right-0 bottom-0 left-0 z-[950] flex border-t border-line bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match.some((m) => path.startsWith(m));
          return (
            <Link key={href} href={href} className={`flex h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[10.5px] ${active ? "text-primary" : "text-sidebar-text/70"}`}>
              <Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}
        <button onClick={() => setMore((m) => !m)} className={`flex h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[10.5px] ${more || moreActive ? "text-primary" : "text-sidebar-text/70"}`}>
          <Menu size={21} />
          More
        </button>
      </nav>
    </>
  );
}

function ActiveTabs() {
  return <Tabs path={usePathname()} />;
}

/** Bottom tab bar for phones (the sidebar is hidden below md). */
export function MobileNav() {
  return (
    <Suspense fallback={<Tabs path="" />}>
      <ActiveTabs />
    </Suspense>
  );
}
