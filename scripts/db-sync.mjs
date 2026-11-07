// Runs during `npm run build`: syncs collections/indexes to the configured MongoDB
// (e.g. Atlas on Vercel). Skipped for the local dev database or when DATABASE_URL is missing.
// A failed sync never blocks the deploy — indexes only need to be created once.
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
const r = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--skip-generate"], { stdio: "inherit", timeout: 90_000 });
if (r.status !== 0) {
  console.warn(
    "[db-sync] WARNING: could not sync indexes — continuing the build.\n" +
      "  If you see 'received fatal alert' / 'Server selection timeout': in MongoDB Atlas open Network Access and allow 0.0.0.0/0 (Vercel has no fixed IPs).\n" +
      "  If you see P1013: DATABASE_URL is malformed.",
  );
}
