import 'dotenv/config';
import { runEnrichment } from '../server/pipeline/enrichment.js';

async function main() {
  console.log('Starting enrichment pipeline...');
  const result = await runEnrichment();
  console.log('\nEnrichment complete:', JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(e => { console.error('Enrichment failed:', e); process.exit(1); });
