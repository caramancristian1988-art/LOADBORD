import { body, handle } from "@/lib/route";
import { bookLoad } from "@/lib/services/dispatch-service";

export async function POST(req: Request, ctx: RouteContext<"/api/loads/[id]/book">) {
  const { id } = await ctx.params;
  const b = await body<{ rate?: number; truckId?: string; driverId?: string | null }>(req);
  return handle(async () => {
    const { load, training } = await bookLoad({ loadId: id, rate: Number(b.rate), truckId: String(b.truckId ?? ""), driverId: b.driverId });
    return { id: load.id, ref: load.ref, rateConNo: load.rateConNo, training };
  });
}
