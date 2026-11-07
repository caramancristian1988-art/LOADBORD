"use client";

import { useSyncExternalStore } from "react";
import { age, dateTime } from "@/lib/format";

// A minute-resolution clock shared by every <Time>. The server snapshot is null, so the
// server (UTC on Vercel) and the first client render agree; the browser then fills in
// the viewer's local time — no hydration mismatch.
function subscribe(onTick: () => void) {
  const t = setInterval(onTick, 30_000);
  return () => clearInterval(t);
}
const getMinute = () => Math.floor(Date.now() / 60_000);
const getServerMinute = () => null;

export function Time({ value, format = "dateTime" }: { value: string | Date | null | undefined; format?: "dateTime" | "age" }) {
  const minute = useSyncExternalStore(subscribe, getMinute, getServerMinute);
  if (!value) return <>—</>;
  if (minute == null) return <span className="inline-block min-w-[2ch]">&nbsp;</span>;
  return <>{format === "age" ? age(value, minute * 60_000) : dateTime(value)}</>;
}
