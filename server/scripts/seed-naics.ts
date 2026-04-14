/**
 * Seed NAICS manufacturing codes into the naics_codes table.
 * Run with: npm run db:seed
 */

import 'dotenv/config';
import { db } from '../db/index.js';
import { naicsCodes } from '../db/schema.js';

const MANUFACTURING_CODES = [
  // 2-digit sectors
  { code: '31', title: 'Manufacturing (31)', level: 2, parentCode: null },
  { code: '32', title: 'Manufacturing (32)', level: 2, parentCode: null },
  { code: '33', title: 'Manufacturing (33)', level: 2, parentCode: null },

  // 3-digit subsectors
  { code: '311', title: 'Food Manufacturing', level: 3, parentCode: '31' },
  { code: '312', title: 'Beverage and Tobacco Product Manufacturing', level: 3, parentCode: '31' },
  { code: '313', title: 'Textile Mills', level: 3, parentCode: '31' },
  { code: '314', title: 'Textile Product Mills', level: 3, parentCode: '31' },
  { code: '315', title: 'Apparel Manufacturing', level: 3, parentCode: '31' },
  { code: '316', title: 'Leather and Allied Product Manufacturing', level: 3, parentCode: '31' },
  { code: '321', title: 'Wood Product Manufacturing', level: 3, parentCode: '32' },
  { code: '322', title: 'Paper Manufacturing', level: 3, parentCode: '32' },
  { code: '323', title: 'Printing and Related Support Activities', level: 3, parentCode: '32' },
  { code: '324', title: 'Petroleum and Coal Products Manufacturing', level: 3, parentCode: '32' },
  { code: '325', title: 'Chemical Manufacturing', level: 3, parentCode: '32' },
  { code: '326', title: 'Plastics and Rubber Products Manufacturing', level: 3, parentCode: '32' },
  { code: '327', title: 'Nonmetallic Mineral Product Manufacturing', level: 3, parentCode: '32' },
  { code: '331', title: 'Primary Metal Manufacturing', level: 3, parentCode: '33' },
  { code: '332', title: 'Fabricated Metal Product Manufacturing', level: 3, parentCode: '33' },
  { code: '333', title: 'Machinery Manufacturing', level: 3, parentCode: '33' },
  { code: '334', title: 'Computer and Electronic Product Manufacturing', level: 3, parentCode: '33' },
  { code: '335', title: 'Electrical Equipment, Appliance, and Component Manufacturing', level: 3, parentCode: '33' },
  { code: '336', title: 'Transportation Equipment Manufacturing', level: 3, parentCode: '33' },
  { code: '337', title: 'Furniture and Related Product Manufacturing', level: 3, parentCode: '33' },
  { code: '339', title: 'Miscellaneous Manufacturing', level: 3, parentCode: '33' },

  // Select 4-digit industry groups (most common in EPA data)
  { code: '3111', title: 'Animal Food Manufacturing', level: 4, parentCode: '311' },
  { code: '3112', title: 'Grain and Oilseed Milling', level: 4, parentCode: '311' },
  { code: '3113', title: 'Sugar and Confectionery Product Manufacturing', level: 4, parentCode: '311' },
  { code: '3114', title: 'Fruit and Vegetable Preserving and Specialty Food Manufacturing', level: 4, parentCode: '311' },
  { code: '3115', title: 'Dairy Product Manufacturing', level: 4, parentCode: '311' },
  { code: '3116', title: 'Animal Slaughtering and Processing', level: 4, parentCode: '311' },
  { code: '3118', title: 'Bakeries and Tortilla Manufacturing', level: 4, parentCode: '311' },
  { code: '3119', title: 'Other Food Manufacturing', level: 4, parentCode: '311' },
  { code: '3241', title: 'Petroleum and Coal Products Manufacturing', level: 4, parentCode: '324' },
  { code: '3251', title: 'Basic Chemical Manufacturing', level: 4, parentCode: '325' },
  { code: '3252', title: 'Resin, Synthetic Rubber, and Artificial Fibers', level: 4, parentCode: '325' },
  { code: '3253', title: 'Pesticide, Fertilizer, and Other Agricultural Chemical Manufacturing', level: 4, parentCode: '325' },
  { code: '3254', title: 'Pharmaceutical and Medicine Manufacturing', level: 4, parentCode: '325' },
  { code: '3255', title: 'Paint, Coating, and Adhesive Manufacturing', level: 4, parentCode: '325' },
  { code: '3256', title: 'Soap, Cleaning Compound, and Toilet Preparation Manufacturing', level: 4, parentCode: '325' },
  { code: '3259', title: 'Other Chemical Product and Preparation Manufacturing', level: 4, parentCode: '325' },
  { code: '3261', title: 'Plastics Product Manufacturing', level: 4, parentCode: '326' },
  { code: '3262', title: 'Rubber Product Manufacturing', level: 4, parentCode: '326' },
  { code: '3311', title: 'Iron and Steel Mills and Ferroalloy Manufacturing', level: 4, parentCode: '331' },
  { code: '3312', title: 'Steel Product Manufacturing from Purchased Steel', level: 4, parentCode: '331' },
  { code: '3313', title: 'Alumina and Aluminum Production and Processing', level: 4, parentCode: '331' },
  { code: '3314', title: 'Nonferrous Metal Production and Processing', level: 4, parentCode: '331' },
  { code: '3315', title: 'Foundries', level: 4, parentCode: '331' },
  { code: '3321', title: 'Forging and Stamping', level: 4, parentCode: '332' },
  { code: '3323', title: 'Architectural and Structural Metals Manufacturing', level: 4, parentCode: '332' },
  { code: '3324', title: 'Boiler, Tank, and Shipping Container Manufacturing', level: 4, parentCode: '332' },
  { code: '3327', title: 'Machine Shops; Turned Product; and Screw, Nut, and Bolt Manufacturing', level: 4, parentCode: '332' },
  { code: '3328', title: 'Coating, Engraving, Heat Treating, and Allied Activities', level: 4, parentCode: '332' },
  { code: '3329', title: 'Other Fabricated Metal Product Manufacturing', level: 4, parentCode: '332' },
  { code: '3331', title: 'Agriculture, Construction, and Mining Machinery Manufacturing', level: 4, parentCode: '333' },
  { code: '3332', title: 'Industrial Machinery Manufacturing', level: 4, parentCode: '333' },
  { code: '3334', title: 'Ventilation, Heating, AC, and Commercial Refrigeration Equipment Manufacturing', level: 4, parentCode: '333' },
  { code: '3336', title: 'Engine, Turbine, and Power Transmission Equipment Manufacturing', level: 4, parentCode: '333' },
  { code: '3339', title: 'Other General Purpose Machinery Manufacturing', level: 4, parentCode: '333' },
  { code: '3341', title: 'Computer and Peripheral Equipment Manufacturing', level: 4, parentCode: '334' },
  { code: '3342', title: 'Communications Equipment Manufacturing', level: 4, parentCode: '334' },
  { code: '3344', title: 'Semiconductor and Other Electronic Component Manufacturing', level: 4, parentCode: '334' },
  { code: '3345', title: 'Navigational, Measuring, Electromedical, and Control Instruments', level: 4, parentCode: '334' },
  { code: '3351', title: 'Electric Lighting Equipment Manufacturing', level: 4, parentCode: '335' },
  { code: '3353', title: 'Electrical Equipment Manufacturing', level: 4, parentCode: '335' },
  { code: '3359', title: 'Other Electrical Equipment and Component Manufacturing', level: 4, parentCode: '335' },
  { code: '3361', title: 'Motor Vehicle Manufacturing', level: 4, parentCode: '336' },
  { code: '3362', title: 'Motor Vehicle Body and Trailer Manufacturing', level: 4, parentCode: '336' },
  { code: '3363', title: 'Motor Vehicle Parts Manufacturing', level: 4, parentCode: '336' },
  { code: '3364', title: 'Aerospace Product and Parts Manufacturing', level: 4, parentCode: '336' },
  { code: '3366', title: 'Ship and Boat Building', level: 4, parentCode: '336' },
  { code: '3369', title: 'Other Transportation Equipment Manufacturing', level: 4, parentCode: '336' },
  { code: '3391', title: 'Medical Equipment and Supplies Manufacturing', level: 4, parentCode: '339' },
  { code: '3399', title: 'Other Miscellaneous Manufacturing', level: 4, parentCode: '339' },
];

async function seed() {
  console.log('Seeding NAICS manufacturing codes...');

  const values = MANUFACTURING_CODES.map(c => ({
    code: c.code,
    title: c.title,
    level: c.level,
    parentCode: c.parentCode,
    isManufacturing: 1,
  }));

  // Upsert: insert or do nothing on conflict
  for (const value of values) {
    await db.insert(naicsCodes).values(value).onConflictDoNothing();
  }

  console.log(`Seeded ${values.length} NAICS codes`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
