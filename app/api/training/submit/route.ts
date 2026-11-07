import { body, handle } from "@/lib/route";
import { getActiveAttempt, gradeAttempt } from "@/lib/services/training-service";
import { AppError } from "@/lib/errors";

export async function POST(req: Request) {
  const b = await body<{ loadId?: string; verdict?: boolean | null }>(req);
  return handle(async () => {
    const attempt = await getActiveAttempt();
    if (!attempt) throw new AppError("No active training scenario. Start one on the Training page.", 409);
    return gradeAttempt(attempt.id, String(b.loadId ?? ""), typeof b.verdict === "boolean" ? b.verdict : null);
  });
}
