"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { EQUIPMENT } from "@/lib/sim/data/freight";
import { STATUS_LABEL } from "@/lib/sim/equipment";
import type { EquipCode } from "@/lib/sim/types";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 560,
  footer,
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  width?: number;
  footer?: ReactNode;
  dismissable?: boolean;
}) {
  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissable]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-stretch justify-center bg-overlay md:items-start md:overflow-y-auto md:p-6 md:pt-[6vh]"
      onMouseDown={(e) => dismissable && e.target === e.currentTarget && onClose()}
    >
      {/* phones: full screen sheet · desktop: centered dialog */}
      <div
        className="pop flex h-full w-full flex-col bg-panel shadow-2xl md:h-auto md:max-h-[88vh] md:max-w-[var(--modal-w)] md:rounded-lg"
        style={{ "--modal-w": `${width}px` } as React.CSSProperties}
        role="dialog"
        aria-modal
      >
        <div className="flex items-start gap-3 border-b border-line px-4 py-3.5 md:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-muted">{subtitle}</div>}
          </div>
          {dismissable && (
            <button onClick={onClose} className="rounded p-1 text-muted hover:bg-surface hover:text-ink" aria-label="Close">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] md:px-5">{footer}</div>}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  AVAILABLE: "bg-chip text-ink-2",
  NEGOTIATING: "bg-warn-50 text-warn",
  BOOKED: "bg-primary-50 text-primary",
  DISPATCHED: "bg-violet-50 text-violet",
  IN_TRANSIT: "bg-info-50 text-info",
  DELIVERED: "bg-good-50 text-good",
  CANCELLED: "bg-bad-50 text-bad",
  COVERED: "bg-chip text-faint",
  AVAILABLE_TRUCK: "bg-good-50 text-good",
  ON_LOAD: "bg-primary-50 text-primary",
  OUT_OF_SERVICE: "bg-bad-50 text-bad",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex h-5 items-center rounded px-1.5 text-[11px] font-medium whitespace-nowrap ${STATUS_STYLE[status] ?? "bg-surface text-muted"}`}>
      {label ?? STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function EquipBadge({ code, full = false }: { code: EquipCode | string; full?: boolean }) {
  const eq = EQUIPMENT[code as EquipCode];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={eq?.name}>
      <span className="inline-grid h-[18px] min-w-[24px] place-items-center rounded-[3px] px-1 text-[10.5px] font-bold text-white" style={{ background: eq?.color ?? "#64748b" }}>
        {code}
      </span>
      {full && <span>{eq?.name}</span>}
    </span>
  );
}

/** Credit score + days to pay, colored like a credit report */
export function CreditBadge({ cs, dtp, stacked = true }: { cs: number; dtp: number; stacked?: boolean }) {
  const color = cs >= 90 ? "text-good" : cs >= 80 ? "text-warn" : "text-bad";
  return (
    <span className={`tnum leading-tight ${stacked ? "inline-flex flex-col" : "inline-flex gap-2"}`}>
      <span className={`font-medium ${color}`}>{cs} CS</span>
      <span className="text-muted">{dtp} DTP</span>
    </span>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" | "warn" }) {
  const toneCls = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="card px-4 py-3">
      <div className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className={`tnum mt-1 text-[22px] leading-7 font-bold ${toneCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <div className="text-[15px] font-medium">{title}</div>
      {children && <div className="mt-1 max-w-md text-[13px] text-muted">{children}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="rounded border border-bad-line bg-bad-50 px-3 py-2 text-[13px] text-bad">{children}</div>;
}

export function WarnNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="rounded border border-warn-line bg-warn-50 px-3 py-2 text-[13px] text-warn">{children}</div>;
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}
