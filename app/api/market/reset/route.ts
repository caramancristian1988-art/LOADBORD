import { body, handle } from "@/lib/route";
import { resetMarket } from "@/lib/market-service";

export async function POST(req: Request) {
  const b = await body<{ keepFleet?: boolean }>(req);
  return handle(async () => {
    await resetMarket(undefined, { keepFleet: b.keepFleet !== false });
    return { ok: true };
  });
}
