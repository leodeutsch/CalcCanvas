export type DimKind =
  | "mass"
  | "length"
  | "area"
  | "volume"
  | "volume_liquid"
  | "energy"
  | "power"
  | "pressure"
  | "data"
  | "temperature"
  | "speed"
  | "angle"
  | "duration"
  | "dimensionless";

export type TypedVar = {
  /** Valor em unidade base SI (ex.: kg, m, L, J, W, Pa, ...). */
  valueSI: number;
  /** Unidade preferida do usuário (para UI); opcional. */
  prettyUnit?: string;
  /** Dimensão (heurística). */
  dim?: DimKind;
  /** Comentário opcional (depois do '#'). */
  comment?: string;
  /** Timestamp de atualização. */
  updatedAt?: number;
};

type VarValue = number | string | TypedVar;

type SheetScope = Map<string, VarValue>;
const SHEETS = new Map<string, SheetScope>();

/** Garante o map do sheet. */
const scope = (sheetId?: string): SheetScope => {
  const key = sheetId || "__default__";
  let s = SHEETS.get(key);
  if (!s) {
    s = new Map();
    SHEETS.set(key, s);
  }
  return s;
};

/** Seta uma variável (já tipada ou não). */
export const setVar = (
  name: string,
  value: VarValue,
  opts?: { sheetId?: string }
) => {
  scope(opts?.sheetId).set(name, value);
};

/** Lê uma variável do sheet (ou default). */
export const getVar = (
  name: string,
  opts?: { sheetId?: string }
): VarValue | undefined => {
  return scope(opts?.sheetId).get(name);
};

/** Retorna todas as variáveis de um sheet como objeto plano. */
export const getAllVars = (opts?: {
  sheetId?: string;
}): Record<string, VarValue> => {
  const out: Record<string, VarValue> = {};
  for (const [k, v] of scope(opts?.sheetId)) out[k] = v;
  return out;
};

/**
 * Faz parsing de uma linha de atribuição simples:
 *   "apple = 300 g  # feira"
 *   "price = 12.50  # BRL"
 * Retorna { name, value, typed? } ou null se não reconhecer.
 */
import { parseQuantityLiteral } from "./quantity";

export const parseAssignmentLine = (
  line: string
): { name: string; value: VarValue } | null => {
  const m = line.match(
    /^\s*([A-Za-z_][A-Za-z0-9_\- ]*)\s*=\s*(.+?)\s*(?:#(.*))?$/
  );
  if (!m) return null;
  const rawName = m[1].trim();
  const rhs = m[2].trim();
  const comment = m[3]?.trim();

  // tenta número puro
  const num = Number(rhs.replace(/\s+/g, ""));
  if (Number.isFinite(num)) {
    const typed: TypedVar = {
      valueSI: num,
      dim: "dimensionless",
      comment,
      updatedAt: Date.now(),
    };
    return { name: rawName, value: typed };
  }

  // tenta literal com unidade (kg, g, L, mL, kJ, kWh, W, kW, hp, Pa, kPa, bar, psi, m, cm...)
  const q = parseQuantityLiteral(rhs);
  if (q) {
    const typed: TypedVar = {
      valueSI: q.valueSI,
      dim: q.dim as any,
      prettyUnit: q.prettyUnit,
      comment,
      updatedAt: Date.now(),
    };
    return { name: rawName, value: typed };
  }

  // fallback: armazena string (retrocompat)
  return { name: rawName, value: rhs };
};

/** Azulejo rápido para 'import vars from "SheetX"' (retorna cópia imutável). */
export const exportVarsFromSheet = (
  sheetId: string
): Record<string, VarValue> => {
  const s = SHEETS.get(sheetId);
  const out: Record<string, VarValue> = {};
  if (!s) return out;
  for (const [k, v] of s) out[k] = v;
  return out;
};
