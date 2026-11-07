import type { EquipCode } from "./types";
import { EQUIPMENT } from "./data/freight";

/** Which load equipment types a truck's trailer can legitimately haul. */
export const CAN_HAUL: Record<EquipCode, EquipCode[]> = {
  F: ["F"],
  SD: ["SD", "F"], // a step deck covers most flatbed freight
  CN: ["CN", "F"], // conestoga = flatbed with a rolling tarp system
  HS: ["HS"],
  V: ["V"],
  R: ["R", "V"], // reefers can run dry freight
  PO: ["PO"],
  BT: ["BT"],
};

export const canHaul = (truck: EquipCode, load: EquipCode) => CAN_HAUL[truck].includes(load);

export const equipName = (c: EquipCode | string) => EQUIPMENT[c as EquipCode]?.name ?? c;

export const OPEN_DECK: EquipCode[] = ["F", "SD", "CN", "HS"];

export const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Available",
  NEGOTIATING: "Negotiating",
  BOOKED: "Booked",
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  COVERED: "Covered",
};

/** Allowed manual status transitions on My Loads. */
export const NEXT_STATUS: Record<string, string[]> = {
  NEGOTIATING: ["AVAILABLE"], // drop it — back to the board
  BOOKED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["IN_TRANSIT", "BOOKED", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "DISPATCHED"],
  DELIVERED: [],
  CANCELLED: [],
};
