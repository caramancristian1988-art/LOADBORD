// `npm run dev`: starts the local MongoDB (when DATABASE_URL points at it),
// syncs Prisma indexes, then runs `next dev`. Ctrl+C stops both.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { startLocalMongo, LOCAL_PORT } from "./local-mongo.mjs";

const require = createRequire(import.meta.url);

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const m = readFileSync(".env", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
    return m?.[1] ?? "";
  } catch {
    return "";
  }
}

const url = databaseUrl();
let stopMongo = null;
if (!url || url.includes(`:${LOCAL_PORT}/`)) {
  stopMongo = await startLocalMongo();
}

const prismaBin = require.resolve("prisma/build/index.js");
const push = spawnSync(process.execPath, [prismaBin, "db", "push", "--skip-generate"], { stdio: "inherit" });
if (push.status !== 0) console.warn("[dev] prisma db push failed — continuing");

const nextBin = require.resolve("next/dist/bin/next");
const next = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], { stdio: "inherit" });

const shutdown = async (code = 0) => {
  next.kill();
  if (stopMongo) await stopMongo();
  process.exit(code);
};
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
next.on("exit", (code) => shutdown(code ?? 0));
