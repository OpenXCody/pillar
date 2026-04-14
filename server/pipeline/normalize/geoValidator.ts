/**
 * Geographic Coordinate Validation
 *
 * Validates lat/lng coordinates are within the continental US
 * and reasonable bounds.
 */

// Continental US bounding box (generous)
const US_LAT_MIN = 24.0;  // Southern tip of Florida Keys
const US_LAT_MAX = 49.5;  // Northern border
const US_LNG_MIN = -125.5; // Western coast
const US_LNG_MAX = -66.0;  // Eastern coast

// Alaska
const AK_LAT_MIN = 51.0;
const AK_LAT_MAX = 71.5;
const AK_LNG_MIN = -180.0;
const AK_LNG_MAX = -129.0;

// Hawaii
const HI_LAT_MIN = 18.5;
const HI_LAT_MAX = 22.5;
const HI_LNG_MIN = -160.5;
const HI_LNG_MAX = -154.5;

// Puerto Rico
const PR_LAT_MIN = 17.5;
const PR_LAT_MAX = 18.6;
const PR_LNG_MIN = -67.5;
const PR_LNG_MAX = -65.5;

export interface GeoValidation {
  valid: boolean;
  latitude: number | null;
  longitude: number | null;
  issue: string | null;
}

/**
 * Parse and validate coordinates.
 */
export function validateCoordinates(rawLat: string | null, rawLng: string | null): GeoValidation {
  if (!rawLat || !rawLng) {
    return { valid: false, latitude: null, longitude: null, issue: 'missing_coordinates' };
  }

  const lat = parseFloat(rawLat);
  const lng = parseFloat(rawLng);

  if (isNaN(lat) || isNaN(lng)) {
    return { valid: false, latitude: null, longitude: null, issue: 'non_numeric' };
  }

  // Basic global bounds
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { valid: false, latitude: lat, longitude: lng, issue: 'out_of_global_bounds' };
  }

  // Zero coordinates (common data quality issue)
  if (lat === 0 && lng === 0) {
    return { valid: false, latitude: null, longitude: null, issue: 'zero_coordinates' };
  }

  // Check if within US territories
  const inContinental = lat >= US_LAT_MIN && lat <= US_LAT_MAX && lng >= US_LNG_MIN && lng <= US_LNG_MAX;
  const inAlaska = lat >= AK_LAT_MIN && lat <= AK_LAT_MAX && lng >= AK_LNG_MIN && lng <= AK_LNG_MAX;
  const inHawaii = lat >= HI_LAT_MIN && lat <= HI_LAT_MAX && lng >= HI_LNG_MIN && lng <= HI_LNG_MAX;
  const inPR = lat >= PR_LAT_MIN && lat <= PR_LAT_MAX && lng >= PR_LNG_MIN && lng <= PR_LNG_MAX;

  if (!inContinental && !inAlaska && !inHawaii && !inPR) {
    return { valid: false, latitude: lat, longitude: lng, issue: 'outside_us' };
  }

  return { valid: true, latitude: lat, longitude: lng, issue: null };
}

/**
 * Calculate Haversine distance between two points in meters.
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
