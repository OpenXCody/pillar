/**
 * NAICS Manufacturing Codes (31-33)
 * Used to filter federal data sources to manufacturing facilities only.
 */

export interface NaicsSubsector {
  code: string;
  title: string;
}

export const MANUFACTURING_SUBSECTORS: NaicsSubsector[] = [
  { code: '311', title: 'Food Manufacturing' },
  { code: '312', title: 'Beverage and Tobacco Product Manufacturing' },
  { code: '313', title: 'Textile Mills' },
  { code: '314', title: 'Textile Product Mills' },
  { code: '315', title: 'Apparel Manufacturing' },
  { code: '316', title: 'Leather and Allied Product Manufacturing' },
  { code: '321', title: 'Wood Product Manufacturing' },
  { code: '322', title: 'Paper Manufacturing' },
  { code: '323', title: 'Printing and Related Support Activities' },
  { code: '324', title: 'Petroleum and Coal Products Manufacturing' },
  { code: '325', title: 'Chemical Manufacturing' },
  { code: '326', title: 'Plastics and Rubber Products Manufacturing' },
  { code: '327', title: 'Nonmetallic Mineral Product Manufacturing' },
  { code: '331', title: 'Primary Metal Manufacturing' },
  { code: '332', title: 'Fabricated Metal Product Manufacturing' },
  { code: '333', title: 'Machinery Manufacturing' },
  { code: '334', title: 'Computer and Electronic Product Manufacturing' },
  { code: '335', title: 'Electrical Equipment, Appliance, and Component Manufacturing' },
  { code: '336', title: 'Transportation Equipment Manufacturing' },
  { code: '337', title: 'Furniture and Related Product Manufacturing' },
  { code: '339', title: 'Miscellaneous Manufacturing' },
];

export const MANUFACTURING_SECTOR_CODES = ['31', '32', '33'];

export function isManufacturingNaics(code: string | null | undefined): boolean {
  if (!code) return false;
  const prefix2 = code.substring(0, 2);
  return prefix2 === '31' || prefix2 === '32' || prefix2 === '33';
}

export function getNaicsSubsector(code: string): NaicsSubsector | null {
  if (!code || code.length < 3) return null;
  const prefix3 = code.substring(0, 3);
  return MANUFACTURING_SUBSECTORS.find(s => s.code === prefix3) || null;
}

export function getNaicsDescription(code: string): string {
  const subsector = getNaicsSubsector(code);
  return subsector?.title || `NAICS ${code}`;
}
