/**
 * Import the 2022 NAICS-to-SIC Crosswalk into Pillar.
 *
 * Source: Census Bureau 2022-NAICS-to-SIC-Crosswalk.xlsx
 * Populates the sic_naics_crosswalk table for translating
 * older SIC codes (used by OSHA) into modern NAICS codes.
 */

import 'dotenv/config';
import { db } from '../db/index.js';
import { sicNaicsCrosswalk } from '../db/schema.js';

// We'll use a Python helper to extract XLSX data since Node XLSX libs
// aren't installed. Convert to JSON first.
import { execSync } from 'child_process';

async function importCrosswalk() {
  console.log('Importing NAICS-to-SIC Crosswalk...');

  // Extract data from XLSX using Python
  const jsonData = execSync(`python3 -c "
import openpyxl, json
wb = openpyxl.load_workbook('/Users/cody/Downloads/2022-NAICS-to-SIC-Crosswalk.xlsx')
ws = wb.active
rows = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if row[1] and row[3]:
        rows.append({
            'naicsCode': str(row[1]).strip(),
            'naicsTitle': str(row[2] or '').strip(),
            'sicCode': str(row[3]).strip().zfill(4),
            'sicDesc': str(row[4] or '').strip()
        })
print(json.dumps(rows))
"`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

  const rows: { naicsCode: string; naicsTitle: string; sicCode: string; sicDesc: string }[] = JSON.parse(jsonData);
  console.log(`  Parsed ${rows.length} crosswalk entries`);

  // Filter to valid entries (numeric codes)
  const valid = rows.filter(r =>
    /^\d+$/.test(r.naicsCode) && /^\d+$/.test(r.sicCode)
  );
  console.log(`  ${valid.length} valid entries`);

  // Count manufacturing entries (NAICS 31-33, SIC 20-39)
  const mfgEntries = valid.filter(r => {
    const naics2 = r.naicsCode.substring(0, 2);
    return naics2 === '31' || naics2 === '32' || naics2 === '33';
  });
  console.log(`  ${mfgEntries.length} manufacturing entries (NAICS 31-33)`);

  // Insert in batches
  const BATCH_SIZE = 200;
  let inserted = 0;

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE).map(r => ({
      sicCode: r.sicCode.substring(0, 4),
      sicDescription: r.sicDesc || null,
      naicsCode: r.naicsCode.substring(0, 6),
      naicsDescription: r.naicsTitle || null,
    }));

    await db.insert(sicNaicsCrosswalk).values(batch);
    inserted += batch.length;
  }

  console.log(`\nDone! Inserted ${inserted} crosswalk entries`);
  process.exit(0);
}

importCrosswalk().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
