import { body, handle } from "@/lib/route";
import { actOnNegotiation, getNegotiation } from "@/lib/services/negotiation-service";
import { parseFreeText, type DispatcherAction, type QuestionTopic } from "@/lib/sim/negotiation";
import { AppError } from "@/lib/errors";

const TOPICS: QuestionTopic[] = ["available", "weight", "dims", "tarps", "pickup", "delivery", "detention", "quickpay", "commodity", "stops", "rate"];

export async function GET(_req: Request, ctx: RouteContext<"/api/negotiations/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const n = await getNegotiation(id);
    if (!n) throw new AppError("Conversation not found", 404);
    return n;
  });
}

export async function POST(req: Request, ctx: RouteContext<"/api/negotiations/[id]">) {
  const { id } = await ctx.params;
  const b = await body<{ type?: string; amount?: number; topic?: string; text?: string }>(req);
  return handle(async () => {
    let action: DispatcherAction;
    switch (b.type) {
      case "offer": {
        const amount = Number(b.amount);
        if (!Number.isFinite(amount) || amount < 100 || amount > 50000) throw new AppError("Enter a rate between $100 and $50,000.", 422);
        action = { type: "offer", amount, text: b.text };
        break;
      }
      case "accept":
        action = { type: "accept" };
        break;
      case "ask":
        if (!TOPICS.includes(b.topic as QuestionTopic)) throw new AppError("Unknown question", 422);
        action = { type: "ask", topic: b.topic as QuestionTopic, text: b.text };
        break;
      case "text": {
        const text = b.text?.trim().slice(0, 400);
        if (!text) throw new AppError("Type a message", 422);
        const parsed = parseFreeText(text);
        // keep what the dispatcher typed as the chat line
        action = parsed.type === "accept" ? parsed : parsed.type === "resume" || parsed.type === "hangup" ? parsed : { ...parsed, text };
        break;
      }
      case "resume":
        action = { type: "resume" };
        break;
      case "hangup":
        action = { type: "hangup" };
        break;
      default:
        throw new AppError("Unknown action", 422);
    }
    return actOnNegotiation(id, action);
  });
}
