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
    <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-[#0b1626]/45 p-6 pt-[6vh]" onMouseDown={(e) => dismissable && e.target === e.currentTarget && onClose()}>
      <div className="pop flex max-h-[88vh] w-full flex-col rounded-lg bg-white shadow-2xl" style={{ maxWidth: width }} role="dialog" aria-modal>
        <div className="flex items-start gap-3 border-b border-line px-5 py-3.5">
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
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  AVAILABLE: "bg-[#eef1f5] text-ink-2",
  NEGOTIATING: "bg-warn-50 text-warn",
  BOOKED: "bg-primary-50 text-primary",
  DISPATCHED: "bg-[#ede7fb] text-violet",
  IN_TRANSIT: "bg-[#e0f2fe] text-[#0369a1]",
  DELIVERED: "bg-good-50 text-good",
  CANCELLED: "bg-bad-50 text-bad",
  COVERED: "bg-[#eef1f5] text-faint",
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
  return <div className="rounded border border-[#f1c4c4] bg-bad-50 px-3 py-2 text-[13px] text-bad">{children}</div>;
}

export function WarnNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="rounded border border-[#f2d7ad] bg-warn-50 px-3 py-2 text-[13px] text-warn">{children}</div>;
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}
