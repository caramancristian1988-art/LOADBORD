import { body, handle } from "@/lib/route";
import { startNegotiation } from "@/lib/services/negotiation-service";

export async function POST(req: Request, ctx: RouteContext<"/api/loads/[id]/negotiate">) {
  const { id } = await ctx.params;
  const b = await body<{ channel?: string; truckId?: string | null }>(req);
  return handle(() => startNegotiation(id, b.channel === "email" ? "email" : "call", b.truckId || null));
}
