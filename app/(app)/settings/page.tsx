import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMarket } from "@/lib/market-service";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const metadata: Metadata = { title: "Settings" };

async function Content() {
  await connection();
  await ensureMarket();
  const [s, loads, brokers] = await Promise.all([prisma.settings.findUnique({ where: { key: "app" } }), prisma.load.count(), prisma.broker.count()]);
  if (!s) return null;
  const { id: _id, key: _key, loadSeq: _seq, ...rest } = s;
  void _id;
  void _key;
  void _seq;
  return <SettingsForm initial={JSON.parse(JSON.stringify(rest))} stats={{ loads, brokers }} />;
}

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-[900px] p-3 md:p-5">
      <h1 className="mb-1 text-[20px] font-bold">Settings</h1>
      <p className="mb-4 text-[13px] text-muted">Your carrier profile appears on rate confirmations. Operating cost drives profit checks and training grades.</p>
      <Suspense fallback={<div className="skeleton h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}
