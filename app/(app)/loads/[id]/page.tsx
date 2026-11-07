import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getLoadDetail, laneBand } from "@/lib/queries/loads";
import { LoadDetailView } from "@/components/load/LoadDetailView";

async function Detail({ params }: { params: PageProps<"/loads/[id]">["params"] }) {
  const { id } = await params;
  const load = await getLoadDetail(id);
  if (!load) notFound();
  const band = await laneBand(load.equipment, load.originState, load.destState);
  return (
    <div className="card overflow-hidden">
      <LoadDetailView data={JSON.parse(JSON.stringify({ load, band }))} />
    </div>
  );
}

export default function LoadPage(props: PageProps<"/loads/[id]">) {
  return (
    <div className="mx-auto w-full max-w-[1100px] p-5">
      <Link href="/loads/search" className="mb-3 inline-flex items-center gap-1 text-[13px] text-primary hover:underline">
        <ChevronLeft size={14} /> Back to load board
      </Link>
      <Suspense
        fallback={
          <div className="card space-y-3 p-5">
            <div className="skeleton h-5 w-48" />
            <div className="skeleton h-7 w-96" />
            <div className="skeleton h-20" />
            <div className="skeleton h-72" />
          </div>
        }
      >
        <Detail params={props.params} />
      </Suspense>
    </div>
  );
}
