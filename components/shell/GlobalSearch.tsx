"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { findCity } from "@/lib/sim/geo";

/** Top-bar quick search: a load number ("104233" / "LD-104233") or a city ("Dallas, TX"). */
export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    setErr(null);
    const num = v.match(/^(?:ld-?)?(\d{5,7})$/i);
    if (num) {
      const res = await fetch(`/api/loads/lookup?ref=LD-${num[1]}`);
      if (res.ok) {
        const { id } = await res.json();
        router.push(`/loads/${id}`);
        setQ("");
      } else setErr("Load not found");
      return;
    }
    const city = findCity(v);
    if (city) {
      router.push(`/loads/search?o=${encodeURIComponent(`${city.n}, ${city.s}`)}`);
      setQ("");
      return;
    }
    if (/^[a-z]{2}$/i.test(v)) {
      router.push(`/loads/search?os=${v.toUpperCase()}`);
      setQ("");
      return;
    }
    setErr('Try "LD-104233", "Dallas, TX" or "TX"');
  }

  return (
    <form onSubmit={go} className="relative w-[340px]">
      <Search size={15} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setErr(null);
        }}
        placeholder="Load # or city (e.g. LD-104233, Dallas, TX)"
        className="h-8 w-full rounded border border-line bg-surface pr-3 pl-8 text-[13px] outline-none focus:border-primary focus:bg-white"
      />
      {err && <div className="absolute top-9 left-0 z-50 rounded bg-ink px-2 py-1 text-xs text-white shadow">{err}</div>}
    </form>
  );
}
