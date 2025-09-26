import { convertLengthPow, detectLengthLike, parseMassLike } from "./units";
import {
  convertEnergy,
  convertPower,
  convertPressure,
  convertVolumeLiquid,
  detectEnergyUnit,
  detectPowerUnit,
  detectPressureUnit,
  detectVolumeLiquidUnit,
} from "./units_extra";

export type ParsedQuantity = {
  valueSI: number; // valor em unidade base SI do domínio
  dim:
    | "mass"
    | "length"
    | "area"
    | "volume"
    | "volume_liquid"
    | "energy"
    | "power"
    | "pressure";
  prettyUnit?: string; // unidade original canonicalizada (p/ UI)
};

/** Tenta parsear massa via função existente (suporta "300 g", "2.5 kg", "10 oz"). */
const tryMass = (s: string): ParsedQuantity | null => {
  const kg = parseMassLike(s);
  if (kg == null) return null;
  // base SI: kg
  // prettyUnit: se possível extrair a unidade textual:
  const m = s.match(/\b(kg|g|lb|oz)\b/i);
  const prettyUnit = m ? m[1].toLowerCase() : "kg";
  return { valueSI: kg, dim: "mass", prettyUnit };
};

/** Comprimento/área/volume (geométrico) — usa seu detector já existente. */
const tryLengthAreaVolume = (s: string): ParsedQuantity | null => {
  const det = detectLengthLike(s);
  if (!det) return null;
  // detectLengthLike não converte; extraímos número e unidade:
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*(mm|cm|m|km|in|ft|yd|mi)\b/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  const unit = m[2] as any;
  const out = convertLengthPow(value, unit, det.unit, det.power); // normaliza na unidade canonicalizada do det
  // Base SI do seu engine para length-like já é "m^power"
  return {
    valueSI: convertLengthPow(value, unit, "m" as any, det.power),
    dim: det.kind as any,
    prettyUnit: unit,
  };
};

/** Volume líquido (L/mL/gal) — base: L */
const tryVolumeLiquid = (s: string): ParsedQuantity | null => {
  const u = detectVolumeLiquidUnit(s);
  if (!u) return null;
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*(mL|ml|L|l|gal)\b/);
  if (!m) return null;
  const val = parseFloat(m[1]);
  const unit = (/^ml$/i.test(m[2]) ? "mL" : /^l$/i.test(m[2]) ? "L" : "gal") as
    | "mL"
    | "L"
    | "gal";
  const inL = convertVolumeLiquid(val, unit, "L");
  return { valueSI: inL, dim: "volume_liquid", prettyUnit: unit };
};

/** Energia — base: J */
const tryEnergy = (s: string): ParsedQuantity | null => {
  const u = detectEnergyUnit(s);
  if (!u) return null;
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*(kWh|kJ|J|kcal|cal)\b/i);
  if (!m) return null;
  const val = parseFloat(m[1]);
  const unit = m[2] as any;
  const inJ = convertEnergy(val, unit, "J" as any);
  return { valueSI: inJ, dim: "energy", prettyUnit: unit };
};

/** Potência — base: W */
const tryPower = (s: string): ParsedQuantity | null => {
  const u = detectPowerUnit(s);
  if (!u) return null;
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*(kW|W|hp)\b/i);
  if (!m) return null;
  const val = parseFloat(m[1]);
  const unit = m[2] as any;
  const inW = convertPower(val, unit, "W" as any);
  return { valueSI: inW, dim: "power", prettyUnit: unit };
};

/** Pressão — base: Pa */
const tryPressure = (s: string): ParsedQuantity | null => {
  const u = detectPressureUnit(s);
  if (!u) return null;
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*(Pa|kPa|bar|psi)\b/);
  if (!m) return null;
  const val = parseFloat(m[1]);
  const unit = m[2] as any;
  const inPa = convertPressure(val, unit, "Pa" as any);
  return { valueSI: inPa, dim: "pressure", prettyUnit: unit };
};

/** Entrada: string como "300 g", "2 L", "500 kJ", etc. */
export const parseQuantityLiteral = (s: string): ParsedQuantity | null => {
  return (
    tryMass(s) ||
    tryVolumeLiquid(s) ||
    tryEnergy(s) ||
    tryPower(s) ||
    tryPressure(s) ||
    tryLengthAreaVolume(s) ||
    null
  );
};
