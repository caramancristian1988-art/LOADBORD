import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchForm } from "@/components/board/SearchForm";
import { ResultsTable } from "@/components/board/ResultsTable";
import { ensureMarket } from "@/lib/market-service";
import { searchLoads } from "@/lib/queries/loads";
import { parseLoadSearch } from "@/lib/search-params";
import { findCity } from "@/lib/sim/geo";

export const metadata: Metadata = { title: "Search Loads" };

function FormSkeleton() {
  return (
    <div className="border-b border-line bg-white px-4 pt-4 pb-3">
      <div className="flex gap-2">
        {[200, 64, 28, 200, 64, 210, 250, 48].map((w, i) => (
          <div key={i} className="skeleton h-10" style={{ width: w }} />
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        {[130, 150, 70, 80, 120, 110, 100].map((w, i) => (
          <div key={i} className="skeleton h-[26px] rounded-full" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex-1 bg-white">
      <div className="flex items-center gap-4 border-b border-line px-4 py-3">
        <div className="skeleton h-5 w-28" />
        <div className="skeleton h-4 w-36" />
        <div className="skeleton ml-auto h-4 w-56" />
      </div>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-3">
          <div className="skeleton h-3 w-8" />
          <div className="skeleton h-8 w-16" />
          <div className="skeleton h-8 w-52" />
          <div className="skeleton h-3 w-10" />
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-4 w-7" />
          <div className="skeleton h-8 w-24" />
          <div className="skeleton h-8 w-40" />
          <div className="skeleton h-8 w-44" />
        </div>
      ))}
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/loads/search">["searchParams"] }) {
  const raw = await searchParams;
  const s = parseLoadSearch(raw);
  await ensureMarket();
  const r = await searchLoads(s);
  return (
    <ResultsTable
      rows={r.rows}
      total={r.total}
      page={r.page}
      pages={r.pages}
      laneAvgRate={r.laneAvgRate}
      laneAvgRpm={r.laneAvgRpm}
      sort={s.sort}
      originLabel={r.originLabel}
      destLabel={r.destLabel}
      hasOriginCity={!!findCity(s.origin)}
      warnings={r.warnings}
    />
  );
}

export default function SearchLoadsPage(props: PageProps<"/loads/search">) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<FormSkeleton />}>
        <SearchForm />
      </Suspense>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
