import { body, handle } from "@/lib/route";
import { assignLoad } from "@/lib/services/dispatch-service";

export async function POST(req: Request, ctx: RouteContext<"/api/loads/[id]/assign">) {
  const { id } = await ctx.params;
  const b = await body<{ truckId?: string; driverId?: string | null }>(req);
  return handle(() => assignLoad(id, String(b.truckId ?? ""), b.driverId));
}
