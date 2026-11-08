import { body, handle } from "@/lib/route";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

/** Saves the dispatcher's private note on a load ("ADD NOTE"). Empty text clears it. */
export async function POST(req: Request, ctx: RouteContext<"/api/loads/[id]/note">) {
  const { id } = await ctx.params;
  const b = await body<{ note?: string }>(req);
  return handle(async () => {
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new AppError("Load not found", 404);
    const note = (b.note ?? "").trim().slice(0, 1000) || null;
    const load = await prisma.load.update({ where: { id }, data: { dispatcherNote: note }, select: { id: true, dispatcherNote: true } });
    return load;
  });
}
