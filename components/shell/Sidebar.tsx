"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, GraduationCap, LayoutDashboard, PackageSearch, Settings, Truck, ClipboardList, FileText } from "lucide-react";
import { Suspense, type ReactNode } from "react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/loads/search", label: "Search Loads", icon: PackageSearch },
  { href: "/my-loads", label: "My Loads", icon: ClipboardList },
  { href: "/trucks", label: "My Trucks", icon: Truck },
  { href: "/rate-cons", label: "Rate Confirmations", icon: FileText },
  { href: "/training", label: "Training", icon: GraduationCap },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`) || (href === "/loads/search" && path.startsWith("/loads/"));

function NavLinks({ path }: { path: string }) {
  return (
    <nav className="flex flex-col">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-3 border-l-[3px] px-4 py-2.5 text-[13px] font-medium transition-colors ${
            isActive(path, href) ? "border-primary bg-sidebar-2 text-white" : "border-transparent hover:bg-sidebar-2/60 hover:text-white"
          }`}
        >
          <Icon size={16} strokeWidth={2} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function SettingsLink({ path }: { path: string }) {
  return (
    <Link
      href="/settings"
      className={`flex items-center gap-3 border-l-[3px] px-4 py-2.5 text-[13px] font-medium ${path.startsWith("/settings") ? "border-primary bg-sidebar-2 text-white" : "border-transparent hover:bg-sidebar-2/60 hover:text-white"}`}
    >
      <Settings size={16} /> Settings
    </Link>
  );
}

// usePathname is request data: read it inside Suspense so the shell can prerender.
function ActiveNav() {
  return <NavLinks path={usePathname()} />;
}
function ActiveSettings() {
  return <SettingsLink path={usePathname()} />;
}

export function Sidebar({ footer }: { footer: ReactNode }) {
  return (
    <aside className="flex w-[200px] shrink-0 flex-col bg-sidebar text-sidebar-text">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-4 pt-4 pb-5">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-[15px] font-bold tracking-tight text-white">LD</span>
        <span className="leading-tight">
          <span className="block text-[15px] font-bold tracking-tight text-white">LoadDesk</span>
          <span className="block text-[10.5px] uppercase tracking-[0.12em] text-sidebar-text/70">Dispatch Trainer</span>
        </span>
      </Link>
      <Suspense fallback={<NavLinks path="" />}>
        <ActiveNav />
      </Suspense>
      <div className="mt-auto border-t border-white/10">
        <Suspense fallback={<SettingsLink path="" />}>
          <ActiveSettings />
        </Suspense>
        {footer}
      </div>
    </aside>
  );
}
