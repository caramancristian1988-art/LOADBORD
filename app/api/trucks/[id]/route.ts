import { body, handle } from "@/lib/route";
import { deleteTruck, updateTruck } from "@/lib/services/fleet-service";

export async function PUT(req: Request, ctx: RouteContext<"/api/trucks/[id]">) {
  const { id } = await ctx.params;
  const b = await body(req);
  return handle(() => updateTruck(id, b));
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/trucks/[id]">) {
  const { id } = await ctx.params;
  return handle(() => deleteTruck(id));
}
