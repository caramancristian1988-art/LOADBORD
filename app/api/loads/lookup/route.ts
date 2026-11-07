import type { NextRequest } from "next/server";
import { handle } from "@/lib/route";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const ref = req.nextUrl.searchParams.get("ref")?.toUpperCase() ?? "";
    const load = await prisma.load.findUnique({ where: { ref }, select: { id: true } });
    if (!load) throw new AppError("Load not found", 404);
    return load;
  });
}
