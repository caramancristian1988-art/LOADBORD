import { handle } from "@/lib/route";
import { getLoadDetail, laneBand } from "@/lib/queries/loads";
import { AppError } from "@/lib/errors";

export async function GET(_req: Request, ctx: RouteContext<"/api/loads/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const load = await getLoadDetail(id);
    if (!load) throw new AppError("Load not found", 404);
    const band = await laneBand(load.equipment, load.originState, load.destState);
    return { load, band };
  });
}
