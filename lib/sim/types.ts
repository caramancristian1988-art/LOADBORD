export type EquipCode = "F" | "SD" | "CN" | "HS" | "V" | "R" | "PO" | "BT";
export type PersonalityKey = "corporate" | "flexible" | "friendly" | "lowballer" | "firm" | "hustler";

export interface City {
  n: string;
  s: string;
  lat: number;
  lon: number;
  zip: string;
  /** general freight volume weight */
  w: number;
  /** open-deck / industrial freight weight */
  od: number;
}

export interface BrokerSeed {
  name: string;
  hq: [string, string];
  /** credit score 0-100 */
  cs: number;
  /** average days to pay */
  dtp: number;
  p: PersonalityKey;
  yrs: number;
  /** quick pay fee % */
  qp: number;
}

export interface EquipmentSpec {
  code: EquipCode;
  name: string;
  openDeck: boolean;
  len: number;
  maxWt: number;
  /** legal cargo height in inches for this trailer */
  legalH: number;
  /** typical market RPM band */
  rpm: [number, number];
  color: string;
}

export interface CommoditySpec {
  name: string;
  eq: EquipCode[];
  wt: [number, number];
  pcs: [number, number];
  dims: { l: [number, number]; w: [number, number]; h: [number, number] };
  /** probability tarps are required */
  tarp?: number;
  tarpSize?: string[];
  /** boolean or probability */
  chains?: boolean | number;
  straps?: boolean | number;
  osChance?: number;
  osLen?: [number, number];
  osWidth?: [number, number];
  origin?: "od" | "w";
  heavy?: boolean;
  oil?: boolean;
  produce?: boolean;
  /** reefer temperature range °F */
  temp?: [number, number];
  notes: string[];
}
