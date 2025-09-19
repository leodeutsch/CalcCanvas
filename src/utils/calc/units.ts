// utils/calc/units.ts
// Unit aliases, detection and conversions for mass, length/area/volume/speed, data, css, duration, temperature.
// Focus: clean detection + canonicalization; conversions remain simple and predictable.

import { formatNumber } from "./mathSugars";

// ----- Types -----
export type MassUnit = "kg" | "g" | "lb" | "oz";
export type TempUnit = "c" | "f" | "k";
export type DataUnit =
  | "b"
  | "kb"
  | "mb"
  | "gb"
  | "tb"
  | "kib"
  | "mib"
  | "gib"
  | "tib";
export type CssUnit = "px" | "pt" | "em";
export type DurationUnit =
  | "ms"
  | "s"
  | "sec"
  | "min"
  | "h"
  | "hr"
  | "d"
  | "day"
  | "days";

// Length canonical units (SI + imperial)
export type LengthUnit = "mm" | "cm" | "m" | "km" | "in" | "ft" | "yd" | "mi";

// Power for length-derived quantities
export type LengthPower = 1 | 2 | 3;

// Speed canonical units (common)
export type SpeedUnit = "m/s" | "km/h" | "mph" | "kn";

// ----- Mass -----
export const MASS_UNITS: readonly MassUnit[] = ["kg", "g", "lb", "oz"] as const;
export const MASS_FACTORS: Record<MassUnit, number> = {
  kg: 1,
  g: 1000,
  lb: 2.20462262,
  oz: 35.2739619,
};

// ----- Temperature -----
export const tempToK = (v: number, u: TempUnit) =>
  u === "c" ? v + 273.15 : u === "f" ? ((v - 32) * 5) / 9 + 273.15 : v;

export const kToTemp = (k: number, u: TempUnit) =>
  u === "c" ? k - 273.15 : u === "f" ? ((k - 273.15) * 9) / 5 + 32 : k;

// ----- Data (SI + binary) -----
export const DATA_FACTORS_SI: Record<
  Exclude<DataUnit, "kib" | "mib" | "gib" | "tib">,
  number
> = {
  b: 1,
  kb: 1e3,
  mb: 1e6,
  gb: 1e9,
  tb: 1e12,
};
export const DATA_FACTORS_BIN: Record<
  Extract<DataUnit, "kib" | "mib" | "gib" | "tib">,
  number
> = {
  kib: 1024,
  mib: 1024 ** 2,
  gib: 1024 ** 3,
  tib: 1024 ** 4,
};

// ----- CSS -----
export const CSS_DEFAULTS = { ppi: 96, emPx: 16 };

// ----- Duration -----
export const DURATION_TO_SECONDS: Record<DurationUnit, number> = {
  ms: 1 / 1000,
  s: 1,
  sec: 1,
  min: 60,
  h: 3600,
  hr: 3600,
  d: 86400,
  day: 86400,
  days: 86400,
};

// ----- Length base: meters -----
const LEN_TO_M: Record<LengthUnit, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
};

// Aliases & plurals to canonical length units
const LENGTH_ALIASES: Record<string, LengthUnit> = {
  millimeter: "mm",
  millimeters: "mm",
  mm: "mm",
  centimeter: "cm",
  centimetre: "cm",
  centimeters: "cm",
  centimetres: "cm",
  cm: "cm",
  meter: "m",
  metre: "m",
  meters: "m",
  metres: "m",
  m: "m",
  kilometer: "km",
  kilometre: "km",
  kilometers: "km",
  kilometres: "km",
  km: "km",
  inch: "in",
  inches: "in",
  in: "in",
  foot: "ft",
  feet: "ft",
  ft: "ft",
  yard: "yd",
  yards: "yd",
  yd: "yd",
  mile: "mi",
  miles: "mi",
  mi: "mi",
};

// Speed aliases to canonical
const SPEED_ALIASES: Record<string, SpeedUnit> = {
  "m/s": "m/s",
  mps: "m/s",
  "meter/second": "m/s",
  "meters/second": "m/s",
  "km/h": "km/h",
  kph: "km/h",
  "kilometer/hour": "km/h",
  "kilometers/hour": "km/h",
  mph: "mph",
  "mile/hour": "mph",
  "miles/hour": "mph",
  knot: "kn",
  knots: "kn",
  kn: "kn",
};

// Detects temperature unit presence in free text
export const determineTempUnit = (input: string): TempUnit | undefined => {
  const lower = input.toLowerCase();
  if (/\b\d+(\.\d+)?\s*°?\s*c\b/.test(lower)) return "c";
  if (/\b\d+(\.\d+)?\s*°?\s*f\b/.test(lower)) return "f";
  if (/\b\d+(\.\d+)?\s*°?\s*k\b/.test(lower)) return "k";
  return undefined;
};

// Data unit in free text
export const determineDataUnit = (input: string): DataUnit | undefined => {
  const m = input.toLowerCase().match(/\b(b|kb|mb|gb|tb|kib|mib|gib|tib)\b/);
  return (m?.[1] as DataUnit) || undefined;
};

// CSS unit in free text
export const determineCssUnit = (input: string): CssUnit | undefined => {
  const m = input.toLowerCase().match(/\b(px|pt|em)\b/);
  return (m?.[1] as CssUnit) || undefined;
};

// Duration detection (any token)
export const hasDurationTokens = (s: string): boolean =>
  /\b(\d+(?:\.\d+)?)\s*(ms|s|sec|min|h|hr|d|day|days)\b/i.test(s);

// Normalize duration terms to seconds arithmetic
export const normalizeDurationExpression = (s: string): string => {
  return s.replace(
    /(\d+(?:\.\d+)?)\s*(ms|s|sec|min|h|hr|d|day|days)\b/gi,
    (_m, num: string, u: string) => {
      const factor = DURATION_TO_SECONDS[u.toLowerCase() as DurationUnit] ?? 1;
      return `((${num})*${factor})`;
    }
  );
};

// Mass detection (simple)
export const determineMassUnit = (input: string): MassUnit | undefined => {
  const lower = input.toLowerCase();
  if (lower.includes("kg")) return "kg";
  if (lower.includes(" oz")) return "oz";
  if (lower.includes(" lb")) return "lb";
  if (lower.includes(" g") && !lower.includes("kg")) return "g";
  return undefined;
};

// --- Length/Area/Volume parsing ---
// Recognizes tokens like "cm", "meters", "m2", "cm^3", "cubic cm", "square meter"
const AREA_PREFIXES = ["square ", "sq "];
const VOLUME_PREFIXES = ["cubic ", "cu "];

export type LengthDetection =
  | { kind: "length"; unit: LengthUnit; power: 1 }
  | { kind: "area"; unit: LengthUnit; power: 2 }
  | { kind: "volume"; unit: LengthUnit; power: 3 }
  | undefined;

export const detectLengthLike = (raw: string): LengthDetection => {
  const s = raw.toLowerCase();

  // cubic/square prefixes
  for (const p of VOLUME_PREFIXES) {
    const m = s.match(new RegExp(`\\b${p}([a-z]+)\\b`));
    if (m) {
      const u = LENGTH_ALIASES[m[1]];
      if (u) return { kind: "volume", unit: u, power: 3 };
    }
  }
  for (const p of AREA_PREFIXES) {
    const m = s.match(new RegExp(`\\b${p}([a-z]+)\\b`));
    if (m) {
      const u = LENGTH_ALIASES[m[1]];
      if (u) return { kind: "area", unit: u, power: 2 };
    }
  }

  // suffix powers: m2, m^2, cm3, cm^3
  const mPow = s.match(/\b([a-z]+)\s*(?:\^?\s*([23]))\b/);
  if (mPow) {
    const u = LENGTH_ALIASES[mPow[1]];
    const p = mPow[2] ? (parseInt(mPow[2], 10) as 2 | 3) : undefined;
    if (u && p)
      return p === 2
        ? { kind: "area", unit: u, power: 2 }
        : { kind: "volume", unit: u, power: 3 };
  }

  // plain length aliases
  const tokens = Object.keys(LENGTH_ALIASES).join("|");
  const m = s.match(new RegExp(`\\b(${tokens})\\b`));
  if (m) {
    const u = LENGTH_ALIASES[m[1]];
    if (u) return { kind: "length", unit: u, power: 1 };
  }

  return undefined;
};

// Converts a numeric value expressed in (unit^power) to (target^power).
// For power=1 it's length, =2 area, =3 volume.
export const convertLengthPow = (
  value: number,
  unit: LengthUnit,
  target: LengthUnit,
  power: LengthPower
): number => {
  const toBase = value * Math.pow(LEN_TO_M[unit], power);
  const out = toBase / Math.pow(LEN_TO_M[target], power);
  return out;
};

// Speed detection: km/h, mph, m/s, kn (aliases)
export const detectSpeedUnit = (raw: string): SpeedUnit | undefined => {
  const s = raw.toLowerCase();
  // explicit forms
  if (/\bkm\/h\b|\bkph\b/.test(s)) return "km/h";
  if (/\bm\/s\b|\bmps\b/.test(s)) return "m/s";
  if (/\bmph\b/.test(s)) return "mph";
  if (/\bknots?\b|\bkn\b/.test(s)) return "kn";
  return undefined;
};

// Converts speed between canonical units
export const convertSpeed = (
  value: number,
  from: SpeedUnit,
  to: SpeedUnit
): number => {
  // base m/s
  const toBase = (v: number, u: SpeedUnit) =>
    u === "m/s"
      ? v
      : u === "km/h"
      ? v / 3.6
      : u === "mph"
      ? v * 0.44704
      : v * 0.514444; // kn
  const fromBase = (ms: number, u: SpeedUnit) =>
    u === "m/s"
      ? ms
      : u === "km/h"
      ? ms * 3.6
      : u === "mph"
      ? ms / 0.44704
      : ms / 0.514444;
  return fromBase(toBase(value, from), to);
};

// Simple helpers to format results for different unit kinds
export const fmtUnitVal = (value: number, unit: string, digits = 2) => ({
  value,
  formatted: formatNumber(value, digits),
  unit,
});
