import type { NextRequest } from "next/server";
import { handle } from "@/lib/route";
import { previewFit } from "@/lib/services/dispatch-service";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/loads/[id]/fit">) {
  const { id } = await ctx.params;
  return handle(() => previewFit(id, req.nextUrl.searchParams.get("truckId") ?? ""));
}
