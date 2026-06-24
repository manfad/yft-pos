// Store-level presentation knobs (parity with the original PROPS).
export const SHOW_MONTH_CHART = true;

// Bootstrap company list (mirrors the seeded `companies` table, ids 1..3). Used
// for the first synchronous render before the DB list loads — see place.ts.
import type { Company } from "@yf/core";
export const COMPANIES: Company[] = [
  { id: 1, name: "Yun Fook Trading" },
  { id: 2, name: "Yun Fook Plantation" },
  { id: 3, name: "Yun Fook Resources" },
];
export const STORE_NAME = COMPANIES[0]!.name;
