"use client";

import { useId, useMemo, useRef, useState } from "react";
import { CITIES, US_STATES } from "@/lib/sim/data/cities";

type Option = { label: string; sub?: string };

/** City/state autocomplete over the simulator's market list. Accepts "City, ST" or a 2-letter state. */
export function CityInput({
  value,
  onChange,
  placeholder,
  label,
  className = "",
  allowState = true,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
  allowState?: boolean;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);

  const options = useMemo<Option[]>(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const out: Option[] = [];
    if (allowState) {
      for (const s of US_STATES) if (s.toLowerCase() === q || (q.length === 2 && s.toLowerCase().startsWith(q))) out.push({ label: s, sub: "Entire state" });
    }
    const [cityPart, statePart] = q.split(",").map((p) => p.trim());
    for (const c of CITIES) {
      const name = c.n.toLowerCase();
      if (name.startsWith(cityPart) && (!statePart || c.s.toLowerCase().startsWith(statePart))) out.push({ label: `${c.n}, ${c.s}` });
    }
    if (out.length < 8) {
      for (const c of CITIES) {
        const name = c.n.toLowerCase();
        if (!name.startsWith(cityPart) && name.includes(cityPart)) out.push({ label: `${c.n}, ${c.s}` });
      }
    }
    return out.slice(0, 9);
  }, [value, allowState]);

  const exact = options.some((o) => o.label.toLowerCase() === value.trim().toLowerCase());

  function pick(o: Option) {
    onChange(o.label);
    setOpen(false);
  }

  return (
    <div
      ref={box}
      className={`field ${className}`}
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || !options.length || exact) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((h) => Math.min(options.length - 1, h + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => Math.max(0, h - 1));
          } else if (e.key === "Enter" || e.key === "Tab") {
            if (options[hi]) {
              if (e.key === "Enter") e.preventDefault();
              pick(options[hi]);
            }
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && options.length > 0 && !exact && (
        <ul className="absolute top-[42px] right-0 left-0 z-50 max-h-72 overflow-auto rounded border border-line bg-white py-1 shadow-lg">
          {options.map((o, i) => (
            <li key={o.label}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                onMouseEnter={() => setHi(i)}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] ${i === hi ? "bg-hover" : ""}`}
              >
                <span>{o.label}</span>
                {o.sub && <span className="text-[11px] text-muted">{o.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
