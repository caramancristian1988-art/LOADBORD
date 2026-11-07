import type { LoadStatus } from "@prisma/client";
import { body, handle } from "@/lib/route";
import { updateLoadStatus } from "@/lib/services/dispatch-service";

export async function POST(req: Request, ctx: RouteContext<"/api/loads/[id]/status">) {
  const { id } = await ctx.params;
  const b = await body<{ status?: LoadStatus; note?: string }>(req);
  return handle(() => updateLoadStatus(id, b.status as LoadStatus, b.note?.slice(0, 200)));
}
