import { NextResponse } from "next/server";
import { errorMessage, errorStatus } from "./errors";

/** Wraps a route handler body: JSON response, consistent error shape. */
export async function handle<T>(fn: () => Promise<T>) {
  try {
    const data = await fn();
    return NextResponse.json(data ?? { ok: true });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: errorStatus(e) });
  }
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
