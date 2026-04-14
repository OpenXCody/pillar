/**
 * Reclaim database space by rebuilding raw_records without raw_json.
 *
 * Strategy: Export essential columns → TRUNCATE → Re-import (no raw_json).
 * TRUNCATE instantly frees all 480 MB. Re-import uses only ~150 MB.
 */
import 'dotenv/config';
import postgres from 'postgres';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const EXPORT_FILE = '/tmp/pillar_raw_records_export.json';
const BATCH_SIZE = 10000;

async function main() {
  const before = await sql`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
  console.log(`Database size before: ${before[0].size}`);

  // Step 1: Export all raw_records (without raw_json) to local file
  console.log('\nStep 1: Exporting raw_records to local file...');
  const totalCount = await sql`SELECT count(*)::int as count FROM raw_records`;
  const total = totalCount[0].count;
  console.log(`  Total records to export: ${total}`);

  let exported = 0;
  const allRecords: any[] = [];

  while (exported < total) {
    const batch = await sql`
      SELECT id, source, source_run_id, source_record_id,
        raw_name, raw_address, raw_city, raw_state, raw_zip, raw_county,
        raw_latitude, raw_longitude, raw_naics_code, raw_sic_code,
        registry_id, program_ids,
        tri_parent_company_name, tri_parent_duns, tri_facility_id,
        osha_employee_count, osha_activity_id,
        fsis_est_number, fsis_size_category,
        facility_id, fetched_at, normalized_at, matched_at
      FROM raw_records
      ORDER BY id
      OFFSET ${exported} LIMIT ${BATCH_SIZE}
    `;

    allRecords.push(...batch);
    exported += batch.length;
    console.log(`  Exported ${exported}/${total}`);
  }

  writeFileSync(EXPORT_FILE, JSON.stringify(allRecords));
  const fileSizeMB = (readFileSync(EXPORT_FILE).length / 1024 / 1024).toFixed(1);
  console.log(`  Saved to ${EXPORT_FILE} (${fileSizeMB} MB)`);

  // Step 2: Also export facility_sources (they reference raw_records)
  console.log('\nStep 2: Saving facility_sources...');
  const facSources = await sql`SELECT * FROM facility_sources`;
  const facSourcesFile = '/tmp/pillar_facility_sources_export.json';
  writeFileSync(facSourcesFile, JSON.stringify(facSources));
  console.log(`  Saved ${facSources.length} facility_source records`);

  // Step 3: TRUNCATE to instantly free space
  console.log('\nStep 3: Truncating raw_records + facility_sources...');
  await sql`TRUNCATE facility_sources CASCADE`;
  await sql`TRUNCATE raw_records CASCADE`;

  const afterTrunc = await sql`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
  console.log(`  Database size after truncate: ${afterTrunc[0].size}`);

  // Step 4: Re-import records WITHOUT raw_json
  console.log('\nStep 4: Re-importing records (no raw_json)...');
  const records = JSON.parse(readFileSync(EXPORT_FILE, 'utf8'));
  let imported = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    // Use raw SQL for fast bulk insert
    const values = batch.map((r: any) => sql`(
      ${r.id}::uuid, ${r.source}, ${r.source_run_id}::uuid, ${r.source_record_id},
      ${r.raw_name}, ${r.raw_address}, ${r.raw_city}, ${r.raw_state}, ${r.raw_zip}, ${r.raw_county},
      ${r.raw_latitude}, ${r.raw_longitude}, ${r.raw_naics_code}, ${r.raw_sic_code},
      ${r.registry_id}, ${r.program_ids},
      ${r.tri_parent_company_name}, ${r.tri_parent_duns}, ${r.tri_facility_id},
      ${r.osha_employee_count}, ${r.osha_activity_id},
      ${r.fsis_est_number}, ${r.fsis_size_category},
      NULL,
      ${r.facility_id ? r.facility_id : null}::uuid,
      ${r.fetched_at ? new Date(r.fetched_at) : null}::timestamptz,
      ${r.normalized_at ? new Date(r.normalized_at) : null}::timestamptz,
      ${r.matched_at ? new Date(r.matched_at) : null}::timestamptz
    )`);

    await sql`
      INSERT INTO raw_records (
        id, source, source_run_id, source_record_id,
        raw_name, raw_address, raw_city, raw_state, raw_zip, raw_county,
        raw_latitude, raw_longitude, raw_naics_code, raw_sic_code,
        registry_id, program_ids,
        tri_parent_company_name, tri_parent_duns, tri_facility_id,
        osha_employee_count, osha_activity_id,
        fsis_est_number, fsis_size_category,
        raw_json,
        facility_id, fetched_at, normalized_at, matched_at
      )
      VALUES ${sql.join(values, sql`, `)}
    `;

    imported += batch.length;
    console.log(`  Imported ${imported}/${records.length}`);
  }

  // Step 5: Re-import facility_sources
  console.log('\nStep 5: Re-importing facility_sources...');
  const fSources = JSON.parse(readFileSync(facSourcesFile, 'utf8'));
  if (fSources.length > 0) {
    for (let i = 0; i < fSources.length; i += BATCH_SIZE) {
      const batch = fSources.slice(i, i + BATCH_SIZE);
      const values = batch.map((r: any) => sql`(
        ${r.id}::uuid, ${r.facility_id}::uuid, ${r.raw_record_id}::uuid,
        ${r.source}, ${r.source_record_id}, ${r.fields_provided},
        ${r.linked_at ? new Date(r.linked_at) : new Date()}::timestamptz
      )`);

      await sql`
        INSERT INTO facility_sources (id, facility_id, raw_record_id, source, source_record_id, fields_provided, linked_at)
        VALUES ${sql.join(values, sql`, `)}
      `;
    }
    console.log(`  Imported ${fSources.length} facility_source records`);
  }

  const after = await sql`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
  console.log(`\nDatabase size after rebuild: ${after[0].size}`);

  // Clean up temp files
  if (existsSync(EXPORT_FILE)) unlinkSync(EXPORT_FILE);
  if (existsSync(facSourcesFile)) unlinkSync(facSourcesFile);
  console.log('Temp files cleaned up.');

  await sql.end();
}

main().catch(console.error);
