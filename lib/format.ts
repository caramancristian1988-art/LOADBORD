// Formatting helpers shared by server and client components.
// Dates for stops are stored as UTC midnight of the local calendar day,
// so they are always formatted in UTC to avoid shifting a day.

export const money = (n: number | null | undefined, cents = false) =>
  n == null || Number.isNaN(n)
    ? "—"
    : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

export const rpmFmt = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : "$" + Number(n).toFixed(2);

export const num = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("en-US"));

export const lbs = (n: number | null | undefined) => (n == null ? "—" : `${Number(n).toLocaleString("en-US")} lbs`);

export const pct = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(digits)}%`;

export function toDate(d: Date | string | number): Date {
  return d instanceof Date ? d : new Date(d);
}

/** "5/11" */
export function shortDay(d: Date | string | null | undefined) {
  if (!d) return "—";
  const x = toDate(d);
  return `${x.getUTCMonth() + 1}/${x.getUTCDate()}`;
}

/** "Tue, May 11, 2027" */
export function longDay(d: Date | string | null | undefined) {
  if (!d) return "—";
  return toDate(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "2026-11-07" in UTC (for stop dates) */
export function isoDay(d: Date | string) {
  return toDate(d).toISOString().slice(0, 10);
}

/** Local calendar day "YYYY-MM-DD" for "now" */
export function todayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** UTC-midnight Date for a "YYYY-MM-DD" string */
export function dayFromIso(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function addDaysIso(iso: string, n: number) {
  const d = dayFromIso(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** DAT-style age: "2m", "47m", "3h", "2d" */
export function age(postedAt: Date | string, now = Date.now()) {
  const mins = Math.max(0, Math.floor((now - toDate(postedAt).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

export function clock(d: Date | string) {
  return toDate(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function dateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return toDate(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function feetInches(inches: number) {
  const ft = Math.floor(inches / 12);
  const inch = Math.round(inches % 12);
  return inch ? `${ft}' ${inch}"` : `${ft}'`;
}
