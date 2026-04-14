/**
 * Blocking Strategy
 *
 * Reduces the comparison space from O(n^2) to manageable blocks.
 * Records are grouped into blocks; only records within the same
 * block are compared against each other.
 */

import { normalizeZip, getZipPrefix } from '../normalize/addressNormalizer.js';

export interface BlockKey {
  key: string;
  type: 'state_zip' | 'state_company' | 'registry_id';
}

/**
 * Generate blocking keys for a raw record.
 * A record can belong to multiple blocks.
 */
export function generateBlockKeys(record: {
  rawState: string | null;
  rawZip: string | null;
  rawName: string | null;
  registryId: string | null;
}): BlockKey[] {
  const keys: BlockKey[] = [];

  // Block 1: State + 3-digit ZIP prefix
  if (record.rawState) {
    const state = record.rawState.toUpperCase();
    const zip = normalizeZip(record.rawZip);
    const zipPrefix = getZipPrefix(zip);
    if (zipPrefix) {
      keys.push({ key: `${state}-${zipPrefix}`, type: 'state_zip' });
    } else {
      // Fallback: state-only block (larger but still useful)
      keys.push({ key: `${state}-000`, type: 'state_zip' });
    }
  }

  // Block 2: Registry ID (exact match fast path)
  if (record.registryId) {
    keys.push({ key: `reg-${record.registryId}`, type: 'registry_id' });
  }

  return keys;
}

/**
 * Group records into blocks by their blocking keys.
 * Returns a map of block key -> array of record indices.
 */
export function buildBlocks<T extends { rawState: string | null; rawZip: string | null; rawName: string | null; registryId: string | null }>(
  records: T[]
): Map<string, number[]> {
  const blocks = new Map<string, number[]>();

  for (let i = 0; i < records.length; i++) {
    const keys = generateBlockKeys(records[i]);
    for (const { key } of keys) {
      if (!blocks.has(key)) blocks.set(key, []);
      blocks.get(key)!.push(i);
    }
  }

  return blocks;
}
