import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildRateCon } from "@/lib/services/ratecon-service";
import { errorMessage, errorStatus } from "@/lib/errors";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/loads/[id]/ratecon">) {
  const { id } = await ctx.params;
  try {
    const { bytes, filename } = await buildRateCon(id);
    const download = req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: errorStatus(e) });
  }
}
