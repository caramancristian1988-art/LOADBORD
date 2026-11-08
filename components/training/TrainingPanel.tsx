"use client";

import { Time } from "@/components/ui/Time";
import { CheckCircle2, ChevronDown, Flag, GraduationCap, Lightbulb, Play, Search, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote, Empty } from "@/components/ui";
import { api } from "@/lib/api-client";
import { dateTime, money, rpmFmt, shortDay } from "@/lib/format";
import { TEMPLATES, DIFFICULTY_LABEL, type DifficultyKey } from "@/lib/sim/training";
import { equipName } from "@/lib/sim/equipment";
import { toQuery } from "@/lib/search-params";
import type { EquipCode } from "@/lib/sim/types";

type Criteria = {
  equipment: EquipCode[];
  startCity: string | null;
  startState: string | null;
  maxDeadhead: number | null;
  destCity: string | null;
  destState: string | null;
  destRadius: number | null;
  minRpm: number | null;
  minNegotiationGain: number | null;
  maxWeight: number | null;
  pickupBy: string | null;
};
type Check = { key: string; label: string; passed: boolean; detail: string; points: number; max: number };
type Attempt = {
  id: string;
  scenarioKey: string;
  title: string;
  brief: string;
  difficulty: DifficultyKey;
  status: string;
  criteria: Criteria;
  hints: string[];
  score: number | null;
  checks: Check[];
  summary: string | null;
  startedAt: string;
  completedAt: string | null;
  load?: { id: string; ref: string; originCity: string; originState: string; destCity: string; destState: string } | null;
};

const LEVELS: { key: DifficultyKey; blurb: string; color: string }[] = [
  { key: "BEGINNER", blurb: "Find the right equipment on the right lane. Learn the board.", color: "#15803d" },
  { key: "INTERMEDIATE", blurb: "Hit RPM targets, judge deadhead and negotiate real money.", color: "#b45309" },
  { key: "ADVANCED", blurb: "Weight limits, oversize, reloads and tough brokers — all at once.", color: "#c02626" },
];

function criteriaList(c: Criteria) {
  const out: string[] = [];
  if (c.equipment?.length) out.push(`Equipment: ${c.equipment.map(equipName).join(", ")}`);
  if (c.startCity) out.push(`Truck at ${c.startCity}, ${c.startState}${c.maxDeadhead ? ` · max deadhead ${c.maxDeadhead} mi` : ""}`);
  if (c.destCity) out.push(`Deliver within ${c.destRadius} mi of ${c.destCity}, ${c.destState}`);
  if (c.minRpm) out.push(`Minimum RPM ${rpmFmt(c.minRpm)}`);
  if (c.maxWeight) out.push(`Max weight ${c.maxWeight.toLocaleString("en-US")} lbs`);
  if (c.minNegotiationGain) out.push(`Negotiate +${money(c.minNegotiationGain)} over the initial offer`);
  if (c.pickupBy) out.push(`Pick up by ${shortDay(c.pickupBy)}`);
  return out;
}

function boardLink(c: Criteria) {
  return `/loads/search?${toQuery({
    origin: c.startCity ? `${c.startCity}, ${c.startState}` : undefined,
    dho: c.maxDeadhead ?? 150,
    dest: c.destCity ? `${c.destCity}, ${c.destState}` : undefined,
    dhd: c.destRadius ?? 150,
    equipment: c.equipment,
  }).toString()}`;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 85 ? "#15803d" : score >= 65 ? "#b45309" : "#c02626";
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#e2e6ec" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${(score / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle" fontSize="16" fontWeight="700" fill={color}>
        {score}
      </text>
    </svg>
  );
}

export function TrainingPanel({ data }: { data: { active: Attempt | null; history: Attempt[] } }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [open, setOpen] = useState<string | null>(data.history[0]?.status === "COMPLETED" ? data.history[0].id : null);
  const { active, history } = data;

  async function start(difficulty: DifficultyKey, key?: string) {
    setBusy(key ?? difficulty);
    setError(null);
    try {
      await api("/api/training/start", { body: { difficulty, key } });
      setHints(0);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function abandon() {
    if (!active) return;
    setBusy("abandon");
    try {
      await api("/api/training/abandon", { body: { id: active.id } });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const completed = history.filter((h) => h.status === "COMPLETED");
  const avg = completed.length ? Math.round(completed.reduce((a, h) => a + (h.score ?? 0), 0) / completed.length) : null;

  return (
    <div className="flex flex-col gap-5">
      <ErrorNote>{error}</ErrorNote>

      {active && (
        <div className="card overflow-hidden border-violet-line">
          <div className="flex items-center gap-2 bg-violet-50 px-5 py-2.5 text-[12px] font-bold tracking-wide text-violet-ink uppercase">
            <GraduationCap size={15} /> Active scenario · {DIFFICULTY_LABEL[active.difficulty]}
            <span className="ml-auto font-normal normal-case">started <Time value={active.startedAt} /></span>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_300px] md:gap-6 md:p-5">
            <div>
              <div className="text-[17px] font-bold">{active.title}</div>
              <p className="mt-1 text-[14px] leading-relaxed">{active.brief}</p>
              <ul className="mt-3 space-y-1 text-[13px]">
                {criteriaList(active.criteria).map((c) => (
                  <li key={c} className="flex items-center gap-2">
                    <Flag size={13} className="text-violet" /> {c}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <Link href={boardLink(active.criteria)} className="btn btn-primary">
                  <Search size={15} /> Open load board for this scenario
                </Link>
                <button className="btn btn-outline" disabled={busy === "abandon"} onClick={abandon}>
                  Abandon
                </button>
              </div>
            </div>
            <div className="rounded-lg bg-surface p-4">
              <div className="mb-2 flex items-center gap-2 text-[12px] font-bold tracking-wide text-muted uppercase">
                <Lightbulb size={14} /> Hints
              </div>
              {active.hints.slice(0, hints).map((h) => (
                <p key={h} className="mb-2 text-[13px]">
                  {h}
                </p>
              ))}
              {hints < active.hints.length ? (
                <button className="btn btn-ghost btn-sm" onClick={() => setHints((n) => n + 1)}>
                  Show hint {hints + 1} of {active.hints.length}
                </button>
              ) : (
                <p className="text-[12px] text-muted">No more hints.</p>
              )}
              <p className="mt-3 border-t border-line pt-3 text-[12px] text-muted">
                When you&apos;ve found your load: book it (graded automatically) or use <b>Submit this load for evaluation</b> in the load details.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {LEVELS.map((lvl) => (
          <div key={lvl.key} className="card flex flex-col p-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: lvl.color }} />
              <span className="text-[15px] font-bold">{DIFFICULTY_LABEL[lvl.key]}</span>
            </div>
            <p className="mt-1 text-[12.5px] text-muted">{lvl.blurb}</p>
            <ul className="mt-3 flex-1 space-y-1">
              {TEMPLATES.filter((t) => t.difficulty === lvl.key).map((t) => (
                <li key={t.key}>
                  <button className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[13px] hover:bg-hover disabled:opacity-50" disabled={!!busy} onClick={() => start(lvl.key, t.key)}>
                    {t.title}
                    <Play size={12} className="text-primary" />
                  </button>
                </li>
              ))}
            </ul>
            <button className="btn btn-primary mt-3" disabled={!!busy} onClick={() => start(lvl.key)}>
              {busy === lvl.key ? "Building scenario…" : `Random ${DIFFICULTY_LABEL[lvl.key].toLowerCase()} scenario`}
            </button>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-bold">Results</h2>
          {avg != null && (
            <span className="text-[13px] text-muted">
              {completed.length} graded · average <b className="text-ink">{avg}/100</b>
            </span>
          )}
        </div>
        <div className="card divide-y divide-line">
          {history.length === 0 ? (
            <Empty title="No attempts yet" icon={<GraduationCap size={34} />}>
              Pick a scenario above to start.
            </Empty>
          ) : (
            history.map((h) => (
              <div key={h.id}>
                <button className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-hover" onClick={() => setOpen(open === h.id ? null : h.id)}>
                  {h.status === "COMPLETED" && h.score != null ? <ScoreRing score={h.score} /> : <div className="grid h-16 w-16 place-items-center text-[11px] text-muted">abandoned</div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[14px] font-bold">
                      {h.title} <span className="rounded bg-surface px-1.5 text-[11px] font-medium text-muted">{DIFFICULTY_LABEL[h.difficulty]}</span>
                    </div>
                    <div className="truncate text-[12.5px] text-muted">{h.brief}</div>
                    {h.summary && <div className="mt-0.5 text-[12.5px]">{h.summary}</div>}
                  </div>
                  <div className="text-right text-[12px] text-muted">
                    {h.load && (
                      <div className="font-mono text-ink">
                        {h.load.ref} · {h.load.originCity} → {h.load.destCity}
                      </div>
                    )}
                    <Time value={h.completedAt ?? h.startedAt} />
                  </div>
                  <ChevronDown size={16} className={`text-muted transition-transform ${open === h.id ? "rotate-180" : ""}`} />
                </button>
                {open === h.id && h.checks.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 bg-surface/60 px-4 pt-1 pb-4 md:grid-cols-2">
                    {h.checks.map((c) => (
                      <div key={c.key} className="flex gap-2.5 rounded-md border border-line bg-panel p-3">
                        {c.passed ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-good" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-bad" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between text-[13px] font-bold">
                            {c.label}
                            <span className="tnum text-muted">
                              {c.points}/{c.max}
                            </span>
                          </div>
                          <div className="text-[12.5px] text-ink-2">{c.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
