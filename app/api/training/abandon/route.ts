import { body, handle } from "@/lib/route";
import { abandonAttempt } from "@/lib/services/training-service";

export async function POST(req: Request) {
  const b = await body<{ id?: string }>(req);
  return handle(() => abandonAttempt(String(b.id ?? "")));
}
