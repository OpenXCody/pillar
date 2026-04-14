/**
 * Field Priority Rules
 *
 * When multiple sources provide the same field, these rules
 * determine which source's value wins.
 */

import type { DataSource } from '@shared/types.js';

type FieldName = 'name' | 'address' | 'city' | 'state' | 'zip' | 'county' |
  'latitude' | 'longitude' | 'companyName' | 'naicsCode' | 'employeeCount';

/**
 * Source priority per field (first = highest priority).
 * TRI wins for companyName because it has explicit PARENT_CO_NAME.
 * ECHO wins for most other fields because it has the broadest, most validated data.
 * OSHA wins for employeeCount because it's the only source with this data.
 */
const FIELD_PRIORITY: Record<FieldName, DataSource[]> = {
  name:          ['epa_echo', 'epa_tri', 'osha', 'usda_fsis', 'manual'],
  address:       ['epa_echo', 'epa_tri', 'osha', 'usda_fsis'],
  city:          ['epa_echo', 'epa_tri', 'osha', 'usda_fsis'],
  state:         ['epa_echo', 'epa_tri', 'osha', 'usda_fsis'],
  zip:           ['epa_echo', 'epa_tri', 'osha', 'usda_fsis'],
  county:        ['epa_echo', 'epa_tri', 'osha', 'usda_fsis'],
  latitude:      ['epa_echo', 'epa_tri', 'osha'],
  longitude:     ['epa_echo', 'epa_tri', 'osha'],
  companyName:   ['epa_tri', 'manual', 'epa_echo', 'osha'],
  naicsCode:     ['epa_echo', 'epa_tri', 'osha', 'usda_fsis'],
  employeeCount: ['osha'],
};

/**
 * Select the best value for a field from multiple source records.
 * Returns the value from the highest-priority source that has a non-null value.
 */
export function selectBestValue<T>(
  field: FieldName,
  candidates: { source: DataSource; value: T | null | undefined }[],
): { value: T | null; source: DataSource | null } {
  const priority = FIELD_PRIORITY[field];

  for (const preferredSource of priority) {
    const match = candidates.find(c => c.source === preferredSource && c.value != null && c.value !== '');
    if (match) {
      return { value: match.value!, source: match.source };
    }
  }

  // Fallback: take any non-null value
  const any = candidates.find(c => c.value != null && c.value !== '');
  return any ? { value: any.value!, source: any.source } : { value: null, source: null };
}

export { FIELD_PRIORITY };
