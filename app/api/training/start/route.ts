import type { Difficulty } from "@prisma/client";
import { body, handle } from "@/lib/route";
import { startScenario } from "@/lib/services/training-service";
import { AppError } from "@/lib/errors";

export async function POST(req: Request) {
  const b = await body<{ difficulty?: string; key?: string }>(req);
  return handle(async () => {
    if (!["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(b.difficulty ?? "")) throw new AppError("Pick a difficulty", 422);
    return startScenario(b.difficulty as Difficulty, b.key || undefined);
  });
}
