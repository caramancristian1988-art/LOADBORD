import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { TrainingPanel } from "@/components/training/TrainingPanel";

export const metadata: Metadata = { title: "Training" };

async function Content() {
  await connection();
  const [active, history] = await Promise.all([
    prisma.trainingAttempt.findFirst({ where: { status: "ACTIVE" }, orderBy: { startedAt: "desc" } }),
    prisma.trainingAttempt.findMany({
      where: { status: { in: ["COMPLETED", "ABANDONED"] } },
      orderBy: { startedAt: "desc" },
      take: 30,
      include: { load: { select: { id: true, ref: true, originCity: true, originState: true, destCity: true, destState: true } } },
    }),
  ]);
  return <TrainingPanel data={JSON.parse(JSON.stringify({ active, history }))} />;
}

export default function TrainingPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] p-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-bold">Training mode</h1>
        <p className="text-[13px] text-muted">
          Practical dispatch scenarios built from the live board. Find the right load, negotiate, book — then get graded on load fit, rate, RPM, deadhead and negotiation.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-48" />
            ))}
          </div>
        }
      >
        <Content />
      </Suspense>
    </div>
  );
}
