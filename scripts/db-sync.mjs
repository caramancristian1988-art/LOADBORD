// Runs during `npm run build`: syncs collections/indexes to the configured MongoDB
// (e.g. Atlas on Vercel). Skipped for the local dev database or when DATABASE_URL is missing.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.warn("[db-sync] DATABASE_URL is not set — skipping index sync. The app needs it at runtime (set it in your hosting env vars).");
  process.exit(0);
}
if (/127\.0\.0\.1|localhost/.test(url)) {
  console.log("[db-sync] local database — skipping (npm run dev syncs it).");
  process.exit(0);
}
const require = createRequire(import.meta.url);
const r = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--skip-generate"], { stdio: "inherit" });
if (r.status !== 0) {
  console.error("[db-sync] prisma db push failed — check DATABASE_URL and that your Atlas cluster allows connections from this host (Network Access → 0.0.0.0/0 for Vercel).");
  process.exit(r.status ?? 1);
}
