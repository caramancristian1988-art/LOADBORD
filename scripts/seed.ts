// Regenerates the whole simulated market: brokers, 650 loads, starter fleet.
// Usage: npm run db:seed
import { PrismaClient } from "@prisma/client";
import { resetMarket } from "../lib/market-service";

const db = new PrismaClient();
const t0 = Date.now();
resetMarket(db)
  .then(async () => {
    const [brokers, loads, trucks] = await Promise.all([db.broker.count(), db.load.count(), db.truck.count()]);
    console.log(`Seeded ${brokers} brokers, ${loads} loads, ${trucks} trucks in ${Date.now() - t0} ms`);
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
