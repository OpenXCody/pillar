# PILLAR

US Manufacturing Facility Data Acquisition Platform — companion to Archangel.

## Purpose

Pillar captures every manufacturing factory in the United States by pulling facility-level records from federal data sources, normalizing names/addresses, deduplicating across sources, and producing clean "golden records" ready for Archangel import.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **State**: Zustand (UI), TanStack Query (server)
- **Backend**: Express.js, TypeScript, Drizzle ORM
- **Database**: PostgreSQL (Neon)
- **Design**: Same dark grayscale theme as Archangel (Oxanium font)

## Data Sources

| Source | Coverage | Key Data | Access |
|--------|----------|----------|--------|
| EPA ECHO | 200K-400K+ regulated facilities | Name, address, lat/lng, NAICS, Registry ID | Bulk CSV, free |
| EPA TRI | ~19K manufacturing | Parent company name, NAICS | REST API, free |
| OSHA (V2) | 100K+ establishments | Employee counts, SIC codes | Bulk CSV, free key |
| USDA FSIS (V2) | ~6,800 food plants | Plant names, activities | CSV, free |

## Project Structure

```
pillar/
├── client/src/           # React dashboard
│   ├── pages/            # Overview, Sources, Facilities, Review, Export
│   ├── components/       # layout/, ui/, facilities/, review/, sources/
│   └── lib/api.ts        # Typed API client
├── server/               # Express API
│   ├── routes/           # facilities, sources, review, export, stats, pipeline
│   ├── pipeline/         # Data acquisition engine
│   │   ├── fetch/        # echoConnector, triConnector
│   │   ├── normalize/    # nameNormalizer, addressNormalizer, geoValidator, naicsLookup
│   │   ├── match/        # matcher, blockingStrategy, scoringRules
│   │   └── merge/        # merger, fieldPriority
│   └── db/               # schema.ts, index.ts
└── shared/               # types.ts, companyNormalization.ts, states.ts, naics.ts
```

## Pipeline Flow

```
FETCH -> NORMALIZE -> MATCH -> MERGE -> EXPORT
```

1. **Fetch**: Download from EPA ECHO (bulk CSV) or TRI (REST API)
2. **Normalize**: Clean names, addresses, validate coordinates, NAICS codes
3. **Match**: Block by state+ZIP, composite score (name+geo+address+NAICS), auto-match >=90
4. **Merge**: Create golden records using field priority rules, resolve companies
5. **Export**: Generate Archangel-compatible CSV

## Key Tables

- `raw_records` - As-fetched data from each source
- `facilities` - Golden records (deduplicated)
- `companies` - Resolved parent companies
- `facility_sources` - Which source provided which fields
- `match_candidates` - Potential duplicates for review
- `source_runs` - Pipeline execution history

## Commands

```bash
npm run dev          # Start dev server (client:5174, server:3001)
npm run db:push      # Push schema to DB
npm run db:seed      # Seed NAICS reference codes
npm run db:studio    # Open Drizzle Studio
```

## API Endpoints

- `GET /api/stats/overview` — Dashboard KPIs
- `GET /api/facilities` — Paginated golden records
- `GET /api/sources` — Source status and record counts
- `POST /api/sources/:source/fetch` — Trigger pipeline for a source
- `GET /api/review` — Match candidates queue
- `POST /api/review/:id/confirm` — Confirm a match
- `GET /api/pipeline/status` — Current pipeline state
