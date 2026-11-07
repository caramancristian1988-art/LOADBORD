import { body, handle } from "@/lib/route";
import { createDriver } from "@/lib/services/fleet-service";

export async function POST(req: Request) {
  const b = await body(req);
  return handle(() => createDriver(b));
}
