/**
 * SEC Ticker Enrichment
 *
 * Downloads SEC's company_tickers_exchange.json (single request, ~500KB)
 * and matches against our existing companies to add ticker symbols.
 *
 * Run: npx tsx server/scripts/enrich-sec-tickers.ts
 */

import { db } from '../db/index.js';
import { companies } from '../db/schema.js';
import { sql } from 'drizzle-orm';
import { normalizeCompanyName, cleanCompanyName } from '../../shared/companyNormalization.js';

const SEC_TICKERS_URL = 'https://www.sec.gov/files/company_tickers_exchange.json';
const USER_AGENT = 'Pillar-Data-Pipeline/1.0 (contact@o-10.com)';

interface TickerExchangeData {
  fields: string[];
  data: [number, string, string, string][]; // [cik, name, ticker, exchange]
}

async function main() {
  console.log('\n=== SEC Ticker Enrichment ===\n');

  // Step 1: Download tickers list
  console.log('Downloading SEC tickers list...');
  const res = await fetch(SEC_TICKERS_URL, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`SEC API error: ${res.status}`);

  const raw = await res.json() as TickerExchangeData;
  console.log(`  Downloaded ${raw.data.length} tickers`);

  // Step 2: Build normalized name → ticker map
  const tickerMap = new Map<string, { cik: number; ticker: string; exchange: string; rawName: string }>();

  for (const [cik, name, ticker, exchange] of raw.data) {
    if (!name || !ticker) continue;

    // Normalize the SEC company name
    const normalized = normalizeCompanyName(name);
    const cleaned = cleanCompanyName(name);

    // Store under both normalized and cleaned forms
    if (normalized && !tickerMap.has(normalized)) {
      tickerMap.set(normalized, { cik, ticker, exchange, rawName: name });
    }
    if (cleaned && cleaned !== normalized && !tickerMap.has(cleaned)) {
      tickerMap.set(cleaned, { cik, ticker, exchange, rawName: name });
    }

    // Also store under the original name (uppercased, stripped)
    const stripped = name.replace(/[,.]|\s+(INC|CORP|CO|LTD|LLC|LP|PLC|NV|SA|AG|SE|HOLDINGS?)\.?$/gi, '').trim();
    if (stripped && !tickerMap.has(stripped)) {
      tickerMap.set(stripped, { cik, ticker, exchange, rawName: name });
    }
  }
  console.log(`  Built ${tickerMap.size} name variants for matching`);

  // Step 3: Load all companies and try to match
  console.log('\nMatching against existing companies...');
  const allCompanies = await db.select({ id: companies.id, name: companies.name }).from(companies);
  console.log(`  ${allCompanies.length} companies to check`);

  let matched = 0;
  const updates: { id: string; ticker: string; cik: string; exchange: string }[] = [];

  for (const co of allCompanies) {
    // Try exact match on company name
    let match = tickerMap.get(co.name);

    // Try normalized
    if (!match) {
      const normalized = normalizeCompanyName(co.name);
      if (normalized) match = tickerMap.get(normalized);
    }

    // Try cleaned
    if (!match) {
      const cleaned = cleanCompanyName(co.name);
      if (cleaned) match = tickerMap.get(cleaned);
    }

    // Try uppercase stripped
    if (!match) {
      const upper = co.name.toUpperCase().replace(/[,.]|\s+(INC|CORP|CO|LTD|LLC|LP)\.?$/gi, '').trim();
      match = tickerMap.get(upper);
    }

    if (match) {
      updates.push({
        id: co.id,
        ticker: match.ticker,
        cik: String(match.cik).padStart(10, '0'),
        exchange: match.exchange,
      });
      matched++;
    }
  }

  console.log(`  Matched ${matched} companies to SEC tickers`);

  // Step 4: Update companies with ticker info
  // Store in dunsNumber field (repurposed) or nameVariants for now
  // We'll use nameVariants JSON to store SEC data
  if (updates.length > 0) {
    console.log('\nUpdating companies with ticker data...');

    for (let i = 0; i < updates.length; i += 200) {
      const batch = updates.slice(i, i + 200);
      for (const u of batch) {
        const secData = JSON.stringify({ ticker: u.ticker, cik: u.cik, exchange: u.exchange });
        await db.execute(sql`
          UPDATE companies SET
            name_variants = COALESCE(name_variants, '{}')::jsonb || ${secData}::jsonb,
            duns_number = COALESCE(duns_number, ${u.cik}),
            updated_at = NOW()
          WHERE id = ${u.id}::uuid
        `);
      }

      if ((i + 200) % 1000 === 0 || i + 200 >= updates.length) {
        console.log(`  Updated ${Math.min(i + 200, updates.length)} / ${updates.length}`);
      }
    }
  }

  // Summary
  const sample = updates.slice(0, 15);
  console.log('\nSample matches:');
  for (const u of sample) {
    const co = allCompanies.find(c => c.id === u.id);
    console.log(`  ${co?.name} → ${u.ticker} (${u.exchange})`);
  }

  console.log(`\n=== Complete: ${matched} companies enriched with SEC tickers ===\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('SEC enrichment failed:', err);
  process.exit(1);
});
