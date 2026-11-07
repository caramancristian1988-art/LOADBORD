import { body, handle } from "@/lib/route";
import { updateSettings } from "@/lib/services/fleet-service";

export async function PUT(req: Request) {
  const b = await body(req);
  return handle(() => updateSettings(b));
}
