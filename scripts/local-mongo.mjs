// Starts a persistent single-node MongoDB replica set for local development.
// Prisma's MongoDB connector needs a replica set (it uses transactions), and this
// machine has no MongoDB/Docker installed, so we use mongodb-memory-server's binary
// with an on-disk dbPath. Data survives restarts in ./.mongo-data.
//
// Point DATABASE_URL at a real cluster (e.g. MongoDB Atlas) to skip this entirely.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";

export const LOCAL_PORT = 27027;
export const LOCAL_URL = `mongodb://127.0.0.1:${LOCAL_PORT}/loadboard?replicaSet=rs0&directConnection=true`;

function portInUse(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: "127.0.0.1" });
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("error", () => resolve(false));
  });
}

/** Returns a stop() function, or null when a local instance is already running. */
export async function startLocalMongo() {
  if (await portInUse(LOCAL_PORT)) {
    console.log(`[mongo] already running on :${LOCAL_PORT}`);
    return null;
  }
  // Keep data OUTSIDE the project: writes inside it trigger the dev file watcher (endless reloads).
  const dbPath = process.env.LOCAL_MONGO_DIR || path.join(os.homedir(), ".loaddesk", "mongo-data");
  mkdirSync(dbPath, { recursive: true });
  const rs = await MongoMemoryReplSet.create({
    replSet: { name: "rs0", count: 1, storageEngine: "wiredTiger" },
    instanceOpts: [{ port: LOCAL_PORT, dbPath }],
  });
  console.log(`[mongo] local replica set ready on :${LOCAL_PORT} (data: ${dbPath})`);
  return async () => { await rs.stop({ doCleanup: false }); };
}

// Run standalone: `node scripts/local-mongo.mjs`
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("local-mongo.mjs")) {
  const stop = await startLocalMongo();
  if (stop) {
    const shutdown = async () => { await stop(); process.exit(0); };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    console.log("[mongo] press Ctrl+C to stop");
  }
}
