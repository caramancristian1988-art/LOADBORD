import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getLoadDetail, laneBand } from "@/lib/queries/loads";
import { LoadDetailView } from "@/components/load/LoadDetailView";

async function Detail({ params, searchParams }: { params: PageProps<"/loads/[id]">["params"]; searchParams: PageProps<"/loads/[id]">["searchParams"] }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const load = await getLoadDetail(id);
  if (!load) notFound();
  const band = await laneBand(load.equipment, load.originState, load.destState);
  return <LoadDetailView data={JSON.parse(JSON.stringify({ load, band }))} print={sp.print === "1"} />;
}

export default function LoadPage(props: PageProps<"/loads/[id]">) {
  return (
    <div className="mx-auto w-full max-w-[1400px] p-3 md:p-5">
      <Suspense
        fallback={
          <div className="space-y-3">
            <div className="skeleton h-7 w-80 max-w-full" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
              <div className="skeleton h-96" />
              <div className="skeleton h-72" />
            </div>
          </div>
        }
      >
        <Detail params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
