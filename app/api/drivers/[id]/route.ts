import { body, handle } from "@/lib/route";
import { deleteDriver, updateDriver } from "@/lib/services/fleet-service";

export async function PUT(req: Request, ctx: RouteContext<"/api/drivers/[id]">) {
  const { id } = await ctx.params;
  const b = await body(req);
  return handle(() => updateDriver(id, b));
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/drivers/[id]">) {
  const { id } = await ctx.params;
  return handle(() => deleteDriver(id));
}
