/**
 * Re-import raw_records and facility_sources from export files.
 * Part 2 of the space reclaim: data was exported, tables truncated,
 * now we re-import without raw_json.
 */
import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync, existsSync, unlinkSync } from 'fs';

const db = postgres(process.env.DATABASE_URL!, { max: 3 });
const EXPORT_FILE = '/tmp/pillar_raw_records_export.json';
const FAC_SOURCES_FILE = '/tmp/pillar_facility_sources_export.json';
const BATCH = 2000;

async function main() {
  const before = await db`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
  console.log(`Database size: ${before[0].size}`);

  // Step 1: Re-import raw_records
  console.log('\nLoading raw_records export...');
  const records: any[] = JSON.parse(readFileSync(EXPORT_FILE, 'utf8'));
  console.log(`Records to import: ${records.length}`);

  let imported = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);

    // Map each record to a row object for postgres.js bulk insert
    const rows = batch.map((r: any) => ({
      id: r.id,
      source: r.source,
      source_run_id: r.source_run_id,
      source_record_id: r.source_record_id,
      raw_name: r.raw_name,
      raw_address: r.raw_address,
      raw_city: r.raw_city,
      raw_state: r.raw_state,
      raw_zip: r.raw_zip,
      raw_county: r.raw_county,
      raw_latitude: r.raw_latitude,
      raw_longitude: r.raw_longitude,
      raw_naics_code: r.raw_naics_code,
      raw_sic_code: r.raw_sic_code,
      registry_id: r.registry_id,
      program_ids: r.program_ids,
      tri_parent_company_name: r.tri_parent_company_name,
      tri_parent_duns: r.tri_parent_duns,
      tri_facility_id: r.tri_facility_id,
      osha_employee_count: r.osha_employee_count,
      osha_activity_id: r.osha_activity_id,
      fsis_est_number: r.fsis_est_number,
      fsis_size_category: r.fsis_size_category,
      raw_json: null,
      facility_id: r.facility_id || null,
      fetched_at: r.fetched_at ? new Date(r.fetched_at) : null,
      normalized_at: r.normalized_at ? new Date(r.normalized_at) : null,
      matched_at: r.matched_at ? new Date(r.matched_at) : null,
    }));

    await db`
      INSERT INTO raw_records ${db(rows,
        'id', 'source', 'source_run_id', 'source_record_id',
        'raw_name', 'raw_address', 'raw_city', 'raw_state', 'raw_zip', 'raw_county',
        'raw_latitude', 'raw_longitude', 'raw_naics_code', 'raw_sic_code',
        'registry_id', 'program_ids',
        'tri_parent_company_name', 'tri_parent_duns', 'tri_facility_id',
        'osha_employee_count', 'osha_activity_id',
        'fsis_est_number', 'fsis_size_category',
        'raw_json', 'facility_id',
        'fetched_at', 'normalized_at', 'matched_at'
      )}
    `;

    imported += batch.length;
    if (imported % 10000 === 0 || imported >= records.length) {
      const size = await db`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
      console.log(`  Imported ${imported}/${records.length} — DB: ${size[0].size}`);
    }
  }

  // Step 2: Re-import facility_sources
  console.log('\nRe-importing facility_sources...');
  const fSources: any[] = JSON.parse(readFileSync(FAC_SOURCES_FILE, 'utf8'));

  if (fSources.length > 0) {
    for (let i = 0; i < fSources.length; i += BATCH) {
      const batch = fSources.slice(i, i + BATCH);
      const rows = batch.map((r: any) => ({
        id: r.id,
        facility_id: r.facility_id,
        raw_record_id: r.raw_record_id,
        source: r.source,
        source_record_id: r.source_record_id,
        fields_provided: r.fields_provided,
        linked_at: r.linked_at ? new Date(r.linked_at) : new Date(),
      }));

      await db`
        INSERT INTO facility_sources ${db(rows,
          'id', 'facility_id', 'raw_record_id', 'source', 'source_record_id',
          'fields_provided', 'linked_at'
        )}
      `;
    }
    console.log(`  Imported ${fSources.length} facility_source records`);
  }

  const after = await db`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
  console.log(`\nFinal database size: ${after[0].size} (was 491 MB with raw_json)`);

  // Clean up temp files
  if (existsSync(EXPORT_FILE)) unlinkSync(EXPORT_FILE);
  if (existsSync(FAC_SOURCES_FILE)) unlinkSync(FAC_SOURCES_FILE);
  console.log('Temp files cleaned up.');

  await db.end();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
