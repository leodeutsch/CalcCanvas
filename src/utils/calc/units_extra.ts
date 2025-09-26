/** -------- Volume (líquidos) -------- */
// base: litro (L)
export type VolumeLiquidUnit = "mL" | "L" | "gal";
export const VOLUME_LIQUID_UNITS: VolumeLiquidUnit[] = ["mL", "L", "gal"];
// fatores para L
const VOL_LIQ_FACTORS: Record<VolumeLiquidUnit, number> = {
  mL: 1 / 1000,
  L: 1,
  gal: 3.785411784, // US liquid gallon
};

export const detectVolumeLiquidUnit = (s: string): VolumeLiquidUnit | null => {
  const m = s.match(/\b(ml|mL|l|L|gal)\b/);
  if (!m) return null;
  const u = m[1];
  if (/^ml$/i.test(u)) return "mL";
  if (/^l$/i.test(u)) return "L";
  return "gal";
};

export const convertVolumeLiquid = (
  value: number,
  from: VolumeLiquidUnit,
  to: VolumeLiquidUnit
) => {
  const inL = value * VOL_LIQ_FACTORS[from];
  return inL / VOL_LIQ_FACTORS[to];
};

/** -------- Energia -------- */
// base: joule (J)
export type EnergyUnit = "J" | "kJ" | "cal" | "kcal" | "kWh";
export const ENERGY_UNITS: EnergyUnit[] = ["J", "kJ", "cal", "kcal", "kWh"];
const ENERGY_FACTORS: Record<EnergyUnit, number> = {
  J: 1,
  kJ: 1e3,
  cal: 4.184, // 1 cal (IT) = 4.184 J
  kcal: 4184, // 1 kcal = 4184 J
  kWh: 3.6e6, // 1 kWh = 3.6e6 J
};

export const detectEnergyUnit = (s: string): EnergyUnit | null => {
  const m = s.match(/\b(k?J|k?cal|kWh|cal|J)\b/i);
  if (!m) return null;
  const u = m[0];
  if (/^kwh$/i.test(u)) return "kWh";
  if (/^kj$/i.test(u)) return "kJ";
  if (/^kcal$/i.test(u)) return "kcal";
  if (/^cal$/i.test(u)) return "cal";
  return "J";
};

export const convertEnergy = (
  value: number,
  from: EnergyUnit,
  to: EnergyUnit
) => {
  const inJ = value * ENERGY_FACTORS[from];
  return inJ / ENERGY_FACTORS[to];
};

/** -------- Potência -------- */
// base: watt (W)
export type PowerUnit = "W" | "kW" | "hp";
export const POWER_UNITS: PowerUnit[] = ["W", "kW", "hp"];
const POWER_FACTORS: Record<PowerUnit, number> = {
  W: 1,
  kW: 1e3,
  hp: 745.6998715822702, // horsepower (metric ≈ 735.5, SAE ≈ 745.7; usamos SAE (W))
};

export const detectPowerUnit = (s: string): PowerUnit | null => {
  const m = s.match(/\b(W|kW|kw|HP|hp)\b/);
  if (!m) return null;
  const u = m[0];
  if (/^kw$/i.test(u)) return "kW";
  if (/^hp$/i.test(u)) return "hp";
  return "W";
};

export const convertPower = (value: number, from: PowerUnit, to: PowerUnit) => {
  const inW = value * POWER_FACTORS[from];
  return inW / POWER_FACTORS[to];
};

/** -------- Pressão -------- */
// base: pascal (Pa)
export type PressureUnit = "Pa" | "kPa" | "bar" | "psi";
export const PRESSURE_UNITS: PressureUnit[] = ["Pa", "kPa", "bar", "psi"];
const PRESSURE_FACTORS: Record<PressureUnit, number> = {
  Pa: 1,
  kPa: 1e3,
  bar: 1e5, // 1 bar = 100 kPa
  psi: 6894.757293, // 1 psi ≈ 6894.757 Pa
};

export const detectPressureUnit = (s: string): PressureUnit | null => {
  const m = s.match(/\b(Pa|kPa|bar|psi)\b/);
  return m ? (m[0] as PressureUnit) : null;
};

export const convertPressure = (
  value: number,
  from: PressureUnit,
  to: PressureUnit
) => {
  const inPa = value * PRESSURE_FACTORS[from];
  return inPa / PRESSURE_FACTORS[to];
};

/** -------- helpers para chips -------- */
export const mapNumberList = <U extends string>(
  units: U[],
  current: U,
  fmt: (v: number, fd?: number) => string,
  valueInBase: number,
  fromUnit: U,
  convert: (val: number, f: U, t: U) => number,
  precision: (u: U, v: number) => number
) => {
  return units
    .filter((u) => u !== current)
    .map((u) => {
      const v = convert(valueInBase, fromUnit, u);
      return { unit: u, display: `${fmt(v, precision(u, v))} ${u}` };
    });
};

// políticas simples de casas decimais
export const energyPrecision = (u: EnergyUnit, v: number) =>
  u === "J" ? (v < 10 ? 3 : 2) : 2;
export const powerPrecision = (_u: PowerUnit, _v: number) => 2;
export const pressPrecision = (u: PressureUnit, v: number) =>
  u === "Pa" ? (v < 10 ? 3 : 2) : 3;
export const volLiqPrecision = (u: VolumeLiquidUnit, _v: number) =>
  u === "mL" ? 0 : 3;
