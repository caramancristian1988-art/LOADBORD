# LoadDesk — Dispatcher Training Load Board

A load board simulator for practicing US truck dispatching (with a focus on open deck: Flatbed, Step Deck, Conestoga).
It mirrors the workflow of a professional load board: search loads, analyze rates and RPM, call brokers and negotiate,
book, generate rate confirmations, dispatch your trucks, and get graded in Training Mode.

All companies, people, phone numbers and loads are **fictional** (phone numbers use the reserved 555-01xx range).

## Features

- **Load board** — 650+ generated loads across 46 states, refreshed continuously. Filters: origin/destination city or
  state with DH-O / DH-D radius, equipment, pickup and delivery dates, min/max rate, min RPM, max weight, length,
  full/partial, tarps, oversize, broker name, credit score, search-back age. Sorting by age, rate, RPM, trip, deadhead,
  pickup. Server-side pagination over indexed MongoDB queries; exact road-mile deadhead computed in the aggregation.
- **Load details** — addresses, appointment windows, cargo and dimensions, securement (tarps/chains/straps), oversize and
  permits, loaded/deadhead/all-in miles, market rate vs posted, broker credit, contacts, special instructions, route map.
- **Broker negotiation simulator** — call or email the broker. Six broker personalities, hidden maximum rate, patience,
  "let me check with my customer", "I have another carrier", final offers, losing the load if you push too hard.
  Free-text chat with intent detection ("can you do 2,400?", "is it tarped?").
- **Booking** — agreed-rate enforcement, truck/driver selection with equipment, weight and availability checks,
  deadhead and profit preview, **Rate Confirmation PDF**.
- **My Trucks** — trucks and drivers CRUD, location and availability, assign booked loads, "find loads" for a truck.
- **My Loads** — Available (contacted), Negotiating, Booked, Dispatched, In Transit, Delivered, Cancelled.
- **Analytics** — revenue, RPM, loaded vs deadhead miles, profit, by truck / equipment / broker, negotiation stats.
- **Training mode** — beginner, intermediate and advanced scenarios built from loads actually on the board, graded on
  load fit, rate vs market, RPM, deadhead, negotiation and profitability.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · MongoDB · Prisma 6 · Leaflet · pdf-lib

## Getting started

```bash
npm install
cp .env.example .env
npm run dev          # starts local MongoDB (port 27027), syncs indexes, runs Next.js
```

Open http://localhost:3000 (use `npm run dev -- -p 3100` for another port). The market is generated automatically on
first visit. To regenerate it manually: `npm run db:seed`, or **Settings → Reset market** in the app.

To use MongoDB Atlas instead of the local database, set `DATABASE_URL` in `.env` and run `npm run db:push` once.
The local database keeps its files in `~/.loaddesk/mongo-data` (outside the project, so the dev file watcher ignores it).
Don't run `next build` while `next dev` is running in the same folder.

## Deploy to Vercel

The bundled local MongoDB only works on your machine — production needs MongoDB Atlas (the free M0 tier is enough).

1. In [MongoDB Atlas](https://cloud.mongodb.com) create a free cluster, a database user, and under **Network Access**
   allow `0.0.0.0/0` (Vercel has no fixed IPs).
2. Copy the connection string (Connect → Drivers) and add the database name, e.g.
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/loadboard?retryWrites=true&w=majority`.
3. In Vercel → Project → **Settings → Environment Variables** add `DATABASE_URL` with that value (Production + Preview).
4. Redeploy. The build syncs the indexes (`scripts/db-sync.mjs`); the market is generated on the first page visit.

| Script | What it does |
| --- | --- |
| `npm run dev` | Local MongoDB + Prisma index sync + Next.js dev server |
| `npm run db:local` | Only the local MongoDB replica set |
| `npm run db:push` | Create collections and indexes from `prisma/schema.prisma` |
| `npm run db:seed` | Wipe and regenerate brokers, loads and the starter fleet |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build |

## Project layout

```
app/(app)/          pages: dashboard, loads/search, loads/[id], my-loads, trucks, rate-cons, training, analytics, settings
app/api/            JSON route handlers (negotiation, booking, status, fleet, training, rate con PDF)
components/         board (search + results), load (detail, call, book, map), dispatch, fleet, training, ui
lib/sim/            simulation: seed data, rate model, load generator, negotiation engine, training scenarios
lib/services/       server-side business logic
lib/queries/        read models (search aggregation, analytics, my loads)
prisma/schema.prisma
docs/SPEC.md        the original product specification
```
