// Evaluation pipeline with: live variables (incl. mass strings), more units,
// simple dimensional sanity, NL sugars, range support, precision policy, and a small function whitelist.

import * as math from "mathjs";
import type { MarketDataState } from "../hooks/useMarketData";
import { EXCHANGE_CACHE_TTL } from "../services/marketData";
import type {
  CalculationResult,
  CalculationResultType,
  ResultConversion,
} from "../types";

import {
  AngleUnit,
  convertAngle,
  convertLengthPow,
  convertSpeed,
  CSS_DEFAULTS,
  CssUnit,
  DATA_FACTORS_BIN,
  DATA_FACTORS_SI,
  DataUnit,
  detectAngleUnit,
  detectLengthLike,
  detectSpeedUnit,
  determineCssUnit,
  determineDataUnit,
  determineMassUnit,
  determineTempUnit,
  hasDurationTokens,
  kToTemp,
  LengthDetection,
  MASS_FACTORS,
  MASS_UNITS,
  normalizeDurationExpression,
  parseMassLike,
  tempToK,
  TempUnit,
} from "./calc/units";

import { formatNumber } from "./calc/mathSugars";
import {
  applyNLPSugars,
  detectSimpleRange,
  normalizeFractions,
} from "./calc/nlpSugars";

/** ---------- Coins / currency ---------- */
const COIN_SYMBOLS = ["BTC", "ETH", "SOL", "DOGE"] as const;

/** ---------- Currency symbols normalization ---------- */
const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  US$: "USD",
  R$: "BRL",
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₣": "CHF",
  "₿": "BTC",
};

interface EvaluateResult {
  result?: CalculationResult;
  error?: string;
}

/** Gather supported fiat codes from MarketData (uppercased, 3 letters). */
const getCurrencyCodes = (md: MarketDataState): string[] => {
  const set = new Set<string>([
    md.baseCurrency.toUpperCase(),
    ...Object.keys(md.exchangeRates || {}).map((c) => c.toUpperCase()),
    ...Object.keys(md.ratesToBase || {}).map((c) => c.toUpperCase()),
  ]);
  return [...set].filter((c) => /^[A-Z]{3}$/.test(c));
};

const standardizeCurrencySymbols = (input: string): string => {
  let updated = input;
  Object.entries(CURRENCY_SYMBOL_MAP).forEach(([symbol, code]) => {
    const regex = new RegExp(symbol.replace(/[$]/g, "\\$"), "gi");
    updated = updated.replace(regex, ` ${code} `);
  });
  return updated;
};

/** Multiplication insertion between numbers/closing parens and dynamic tokens. */
const ensureExplicitMultiplication = (
  input: string,
  tokens: string[]
): string => {
  if (tokens.length === 0) return input;
  const tokenPattern = tokens.join("|");
  const beforeRegex = new RegExp(`(\\d|\\))\\s*(${tokenPattern})`, "gi");
  const afterRegex = new RegExp(`(${tokenPattern})\\s*(\\d|\\()`, "gi");
  let normalized = input.replace(beforeRegex, (_m, l, t) => `${l} * ${t}`);
  normalized = normalized.replace(afterRegex, (_m, t, r) => `${t} * ${r}`);
  return normalized;
};

/** Core formatter policy by kind. */
const formatByKind = (
  kind: CalculationResultType,
  value: number,
  unit?: string
) => {
  const precision =
    kind === "currency"
      ? 2
      : kind === "mass"
      ? unit === "g" || unit === "oz"
        ? 1
        : 2
      : kind === "temperature"
      ? 2
      : kind === "css"
      ? unit === "px"
        ? 0
        : 2
      : kind === "data"
      ? unit === "b"
        ? 0
        : value < 10
        ? 3
        : 2
      : kind === "speed"
      ? 2
      : kind === "length"
      ? 3
      : kind === "area"
      ? 6
      : kind === "volume"
      ? 6
      : kind === "angle"
      ? 3
      : kind === "duration"
      ? 3
      : 3;

  return {
    formatted: formatNumber(value, precision),
    precision,
  };
};

/** Replace English operator words and keep only allowed function tokens. */
const sanitizeForMath = (input: string): string => {
  const allowedFns = ["round", "ceil", "floor", "min", "max"]; // clamp expands to min/max
  const allow = allowedFns.join("|");

  // Replace basic English connectors with operators
  let s = input
    .replace(/\btimes?\b/gi, " * ")
    .replace(/\bplus\b/gi, " + ")
    .replace(/\bminus\b/gi, " - ")
    .replace(/\bdivided?\s*by\b/gi, " / ");

  // Expand clamp(x,a,b) -> min(max(x,a), b)
  s = s.replace(
    /\bclamp\s*\(([^,]+),\s*([^,]+),\s*([^)]+)\)/gi,
    "min(max(($1),($2)),($3))"
  );

  // Strip any identifiers that are not in the allowed function list
  // We keep letters only when followed by '(' and they are allowed function names.
  s = s.replace(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, (m, fn) =>
    new RegExp(`^(${allow})$`, "i").test(fn) ? m : "("
  );

  // Remove any stray letters left (units should be replaced earlier)
  s = s.replace(/[A-Za-z_]+/g, " ");

  // Keep digits, parentheses, commas and + - * / . ^ spaces
  s = s.replace(/[^0-9+\-*/^()., ]/g, " ");

  // Collapse spaces
  return s.replace(/\s+/g, " ").trim();
};

/** Simple dimension sanity for + | - when mixed kinds (heuristic). */
const hasAddSubtract = (s: string) => /(^|[^*\/])\s[+\-]\s/.test(" " + s + " ");

const buildCurrencyConversions = (
  valueInBase: number,
  baseCurrency: string,
  marketData: MarketDataState,
  exclude: string[] = [],
  isApprox = false
): ResultConversion[] => {
  const allCodes = getCurrencyCodes(marketData);
  const currencies = allCodes.filter(
    (code) => code !== baseCurrency.toUpperCase() && !exclude.includes(code)
  );
  const out: ResultConversion[] = [];

  for (const code of currencies) {
    const v = marketData.convertFromBase(valueInBase, code);
    if (v != null) {
      out.push({
        unit: code,
        display: `${isApprox ? "~ " : ""}${formatNumber(v, 2)} ${code}`,
      });
    }
  }

  for (const sym of COIN_SYMBOLS) {
    const amt = marketData.getCoinAmountFromBase(valueInBase, sym);
    if (amt != null) {
      out.push({
        unit: sym,
        display: `${formatNumber(amt, amt < 1 ? 6 : 3)} ${sym}`,
      });
    }
  }
  return out;
};

/** Date flow (unchanged, uses your datetime utils) */
import {
  applyDateOperations,
  formatDateResult,
  isDateExpression,
  parseDateExpression,
  parseDateOperations,
} from "./datetime";

const evaluateDates = (input: string): EvaluateResult | null => {
  const parsed = parseDateExpression(input);
  if (!parsed) return null;
  const operations = parseDateOperations(input);
  const resultDate = applyDateOperations(parsed.date, operations);
  return {
    result: {
      value: resultDate.getTime(),
      formatted: formatDateResult(resultDate),
      type: "date",
    },
  };
};

/** Scale suffixes like 2k, 3m */
const applyScaleSuffixes = (input: string): string =>
  input.replace(
    /\b(\d+(?:\.\d+)?)([kKmMbBtT])\b/g,
    (_m, n: string, suf: string) => {
      const v = parseFloat(n);
      const f =
        suf === "k" || suf === "K"
          ? 1e3
          : suf === "m" || suf === "M"
          ? 1e6
          : suf === "b" || suf === "B"
          ? 1e9
          : 1e12;
      return String(v * f);
    }
  );

const normalizeRadixLiterals = (s: string): string =>
  s
    .replace(/\b0x[0-9a-fA-F]+\b/g, (m) => String(parseInt(m, 16)))
    .replace(/\b0o[0-7]+\b/g, (m) => String(parseInt(m, 8)))
    .replace(/\b0b[01]+\b/g, (m) => String(parseInt(m, 2)));

const applyPercentPhrases = (s: string): string => {
  let out = s;
  out = out.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*of\s*\(([^)]+)\)/gi,
    (_m, p, a) => `((${a}) * (${p}/100))`
  );
  out = out.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*of\s+([^\s][^+\-*/()]+(?:\([^)]*\))?)/gi,
    (_m, p, a) => `((${a}) * (${p}/100))`
  );
  out = out.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*on\s*\(([^)]+)\)/gi,
    (_m, p, a) => `((${a}) + ((${a}) * (${p}/100)))`
  );
  out = out.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*on\s+([^\s][^+\-*/()]+(?:\([^)]*\))?)/gi,
    (_m, p, a) => `((${a}) + ((${a}) * (${p}/100)))`
  );
  out = out.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*off\s*\(([^)]+)\)/gi,
    (_m, p, a) => `((${a}) - ((${a}) * (${p}/100)))`
  );
  out = out.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*off\s+([^\s][^+\-*/()]+(?:\([^)]*\))?)/gi,
    (_m, p, a) => `((${a}) - ((${a}) * (${p}/100)))`
  );
  return out;
};

type InClause = {
  expression: string;
  targetMass?: (typeof MASS_UNITS)[number];
  targetCurrency?: string;
  targetTemp?: TempUnit;
  targetData?: DataUnit;
  targetCss?: CssUnit;
  targetLength?: string; // canonical length unit
  targetSpeed?: string;
  targetAngle?: AngleUnit;
  targetDuration?: string; // "s", "min", "h"...
};

const parseInClause = (input: string): InClause => {
  const m = input.match(/\s+(?:in|to)\s+([A-Za-z°/]{1,8})\s*$/i);
  if (!m) return { expression: input };
  const raw = m[1];
  const u = raw.toLowerCase();
  const out: InClause = { expression: input.slice(0, m.index).trim() };

  if (["kg", "g", "lb", "oz"].includes(u))
    out.targetMass = u as (typeof MASS_UNITS)[number];
  if (/^[A-Za-z]{3}$/.test(raw)) out.targetCurrency = raw.toUpperCase();
  if (["c", "°c", "f", "°f", "k", "°k"].includes(u))
    out.targetTemp = u.replace("°", "") as TempUnit;
  if (["b", "kb", "mb", "gb", "tb", "kib", "mib", "gib", "tib"].includes(u))
    out.targetData = u as DataUnit;
  if (["px", "pt", "em"].includes(u)) out.targetCss = u as CssUnit;

  // length/speed/angle/duration (we keep as raw; evaluator maps after detection)
  if (/\b(mm|cm|m|km|in|ft|yd|mi)(\^?[23])?\b/.test(u)) out.targetLength = u;
  if (/\b(m\/s|km\/h|kph|mph|kn)\b/.test(u)) out.targetSpeed = u;
  if (/\b(deg|rad|turn|degrees|radians|turns)\b/.test(u))
    out.targetAngle = u as AngleUnit;
  if (/\b(ms|s|sec|min|h|hr|d|day|days)\b/.test(u)) out.targetDuration = u;

  return out;
};

const ensureImplicitAroundParens = (s: string): string =>
  s
    .replace(/\)\s*\(/g, ")*(")
    .replace(/(\d)\s*\(/g, "$1*(")
    .replace(/\)\s*(\d)/g, ")*$1");

/** Context variables support */
export type EvalContext = {
  previousValues: number[];
  variables?: Record<string, number | string>;
};

const singularize = (id: string) => {
  const x = id.toLowerCase();
  if (x.endsWith("ies")) return x.slice(0, -3) + "y";
  if (x.endsWith("ses")) return x.slice(0, -2);
  if (x.endsWith("s") && !x.endsWith("ss")) return x.slice(0, -1);
  return x;
};

const applyContextTokens = (input: string, ctx?: EvalContext): string => {
  if (!ctx) return input;
  const prev = ctx.previousValues.at(-1);
  const sum = ctx.previousValues.reduce(
    (a, b) => a + (Number.isFinite(b) ? b : 0),
    0
  );
  const avg =
    ctx.previousValues.length > 0 ? sum / ctx.previousValues.length : 0;
  let s = input;
  s = s.replace(/\bprev\b/gi, prev != null ? String(prev) : "0");
  s = s.replace(/\bsum\b/gi, String(sum));
  s = s.replace(/\bavg\b/gi, String(avg));
  s = s.replace(/#(\d+)\b/g, (_m, nStr: string) => {
    const n = parseInt(nStr, 10);
    const idx = n - 1;
    const v = Number.isFinite(ctx.previousValues[idx]!)
      ? ctx.previousValues[idx]!
      : 0;
    return String(v);
  });
  return s;
};

const applyBarePercent = (input: string): string =>
  input.replace(/(\d+(?:\.\d+)?)\s*%/g, (_m, n) => `((${n})/100)`);

const applyVariables = (
  input: string,
  vars?: Record<string, number | string>
): string => {
  if (!vars) return input;
  let s = input;

  for (const [rawName, rawValue] of Object.entries(vars)) {
    const nameLower = rawName.toLowerCase();
    if (/^(in|to|of|on|off|sum|avg|prev)$/i.test(nameLower)) continue;
    if (/^[A-Z]{3}$/.test(nameLower)) continue;

    /** allow string variables with simple mass literal (e.g., "300 g") */
    let replaceValue: number | null = null;
    if (typeof rawValue === "number") replaceValue = rawValue;
    else {
      const massKg = parseMassLike(rawValue);
      if (massKg != null) replaceValue = massKg;
    }
    if (replaceValue == null) continue;

    const base = singularize(nameLower).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `\\b(${base}|${base}s|${base}es|${base.replace(/y$/, "ies")})\\b`,
      "gi"
    );
    s = s.replace(re, String(replaceValue));
  }
  return s;
};

/** Currency/crypto dynamic tokens */
const resolveDynamicTokens = (
  input: string,
  marketData: MarketDataState,
  usedCurrencies: Set<string>
): string => {
  let updated = input;
  const currencyCodes = getCurrencyCodes(marketData);
  const tokens = [...currencyCodes, ...COIN_SYMBOLS] as string[];

  updated = ensureExplicitMultiplication(updated, tokens);

  const tokenRegex = new RegExp(`\\b(${tokens.join("|")})\\b`, "gi");
  updated = updated.replace(tokenRegex, (match) => {
    const token = match.toUpperCase();
    if (currencyCodes.includes(token)) {
      const rate = marketData.getCurrencyRate(token);
      if (rate != null) {
        usedCurrencies.add(token);
        return rate.toString();
      }
    }
    if ((COIN_SYMBOLS as readonly string[]).includes(token as any)) {
      const price = marketData.getCoinPriceBySymbol(token as any);
      if (price != null) {
        usedCurrencies.add(marketData.baseCurrency);
        return price.toString();
      }
    }
    return match;
  });

  return updated;
};

// ---------- Main evaluate ----------
export const evaluateInput = (
  rawInput: string,
  marketData: MarketDataState,
  ctx?: EvalContext
): EvaluateResult => {
  const input = rawInput ?? "";
  if (!input.trim()) return {};

  // Dates first
  if (isDateExpression(input)) {
    const dateResult = evaluateDates(input);
    if (dateResult) return dateResult;
  }

  // Pre-normalization pipeline
  const withFractions = normalizeFractions(input);
  const withNL = applyNLPSugars(withFractions);
  const withRadix = normalizeRadixLiterals(withNL);
  const withScales = applyScaleSuffixes(withRadix);
  const withConstants = withScales
    .replace(/\bpi\b/gi, String(Math.PI))
    .replace(/\be\b/gi, String(Math.E));
  const withNumSeps = withConstants
    .replace(/(\d)[_,](?=\d)/g, "$1")
    .replace(/(\d),(?=\d{3}\b)/g, "$1");
  const withPercentSemantics = applyPercentPhrases(withNumSeps);

  // Durations inline normalization (turn "2h 30m" arithmetic into seconds)
  const withDurations = hasDurationTokens(withPercentSemantics)
    ? normalizeDurationExpression(withPercentSemantics)
    : withPercentSemantics;

  const inInfo = parseInClause(withDurations);
  const standardized = standardizeCurrencySymbols(inInfo.expression);

  // Trailing "= USD?" still supported
  const queryMatch = standardized.match(/=\s*([a-z]{3})\??$/i);
  const targetCurrencyQuery = queryMatch
    ? queryMatch[1].toUpperCase()
    : undefined;
  const targetCurrency = (
    inInfo.targetCurrency ?? targetCurrencyQuery
  )?.toUpperCase();

  const expressionSource = queryMatch
    ? standardized.replace(/=\s*([a-z]{3})\??$/i, "").trim()
    : standardized;

  // Vars / context / bare %
  const withVars = applyVariables(expressionSource, ctx?.variables);
  const withContextTokens = applyContextTokens(withVars, ctx);
  const withBarePercent = applyBarePercent(withContextTokens);

  // Heuristics for dimension/kind detection
  const massUnitFromText = determineMassUnit(withBarePercent);
  const tempUnitFromText = determineTempUnit(withBarePercent);
  const dataUnitFromText = determineDataUnit(withBarePercent);
  const cssUnitFromText = determineCssUnit(withBarePercent);
  const lengthLike: LengthDetection = detectLengthLike(withBarePercent);
  const speedUnit = detectSpeedUnit(withBarePercent);
  const angleUnit = detectAngleUnit(withBarePercent);

  // Dynamic tokens (fx/crypto)
  const usedCurrencies = new Set<string>();
  let withDynamicTokens = resolveDynamicTokens(
    withBarePercent,
    marketData,
    usedCurrencies
  );

  // Explicit mult around parens and functions
  const withParensMult = ensureImplicitAroundParens(withDynamicTokens);
  const mathExpression = sanitizeForMath(withParensMult);
  if (!mathExpression) return {};

  // Simple incompatible +/− check (mass vs length/area/volume)
  if (hasAddSubtract(mathExpression) && massUnitFromText && lengthLike) {
    return { error: "Incompatible units for addition/subtraction." };
  }

  // Evaluate with mathjs (whitelisted)
  let rawResult: number;
  try {
    rawResult = math.evaluate(mathExpression);
    if (typeof rawResult !== "number" || !Number.isFinite(rawResult)) {
      return { error: "Invalid calculation" };
    }
  } catch {
    return { error: "Invalid calculation" };
  }

  let result: CalculationResult;
  let type: CalculationResultType = "number";

  // MASS
  if (massUnitFromText || inInfo.targetMass) {
    type = "mass";
    const initial = (massUnitFromText ?? "kg") as (typeof MASS_UNITS)[number];
    const final = (inInfo.targetMass ?? initial) as (typeof MASS_UNITS)[number];

    // convert rawResult interpreted as 'initial' to 'final'
    const kg = rawResult / (MASS_FACTORS[initial] ?? 1);
    const out = kg * (MASS_FACTORS[final] ?? 1);

    const { formatted, precision } = formatByKind(type, out, final);
    result = {
      value: out,
      formatted,
      unit: final,
      type,
      conversions: MASS_UNITS.filter((u) => u !== final).map((u) => {
        const v = kg * (MASS_FACTORS[u] ?? 1);
        const p = u === "g" || u === "oz" ? 1 : 2;
        return { unit: u, display: `${formatNumber(v, p)} ${u}` };
      }),
      metadata: { precisionApplied: precision, kind: "mass" },
    };

    // TEMPERATURE
  } else if (tempUnitFromText || inInfo.targetTemp) {
    type = "temperature";
    const initial = (tempUnitFromText ?? "c") as TempUnit;
    const final = (inInfo.targetTemp ?? initial) as TempUnit;
    const k = tempToK(rawResult, initial);
    const out = kToTemp(k, final);
    const { formatted, precision } = formatByKind(
      type,
      out,
      final.toUpperCase()
    );
    result = {
      value: out,
      formatted,
      unit: final.toUpperCase(),
      type,
      conversions: (["c", "f", "k"] as TempUnit[])
        .filter((t) => t !== final)
        .map((t) => {
          const v = kToTemp(k, t);
          return {
            unit: t.toUpperCase(),
            display: `${formatNumber(v, 2)} ${t.toUpperCase()}`,
          };
        }),
      metadata: { precisionApplied: precision, kind: "temperature" },
    };

    // DATA
  } else if (dataUnitFromText || inInfo.targetData) {
    type = "data";
    const initial = (dataUnitFromText ?? "mb") as DataUnit;
    const final = (inInfo.targetData ?? initial) as DataUnit;
    const toBits = (v: number, u: DataUnit) =>
      (DATA_FACTORS_SI as any)[u] != null
        ? v * (DATA_FACTORS_SI as any)[u]
        : v * (DATA_FACTORS_BIN as any)[u];
    const fromBits = (bits: number, u: DataUnit) =>
      (DATA_FACTORS_SI as any)[u] != null
        ? bits / (DATA_FACTORS_SI as any)[u]
        : bits / (DATA_FACTORS_BIN as any)[u];
    const bits = toBits(rawResult, initial);
    const out = fromBits(bits, final);
    const { formatted, precision } = formatByKind(
      type,
      out,
      final.toUpperCase()
    );
    result = {
      value: out,
      formatted,
      unit: final.toUpperCase(),
      type,
      conversions: (
        ["b", "kb", "mb", "gb", "tb", "kib", "mib", "gib", "tib"] as DataUnit[]
      )
        .filter((t) => t !== final)
        .map((t) => {
          const v = fromBits(bits, t);
          const prec = t === "b" ? 0 : v < 10 ? 3 : 2;
          return {
            unit: t.toUpperCase(),
            display: `${formatNumber(v, prec)} ${t.toUpperCase()}`,
          };
        }),
      metadata: { precisionApplied: precision, kind: "data" },
    };

    // CSS
  } else if (cssUnitFromText || inInfo.targetCss) {
    type = "css";
    const initial = (cssUnitFromText ?? "px") as CssUnit;
    const final = (inInfo.targetCss ?? initial) as CssUnit;
    const toPx = (v: number, u: CssUnit) =>
      u === "px"
        ? v
        : u === "pt"
        ? v * (CSS_DEFAULTS.ppi / 72)
        : v * CSS_DEFAULTS.emPx;
    const fromPx = (px: number, u: CssUnit) =>
      u === "px"
        ? px
        : u === "pt"
        ? px / (CSS_DEFAULTS.ppi / 72)
        : px / CSS_DEFAULTS.emPx;
    const out = fromPx(toPx(rawResult, initial), final);
    const { formatted, precision } = formatByKind(type, out, final);
    result = {
      value: out,
      formatted,
      unit: final,
      type,
      conversions: (["px", "pt", "em"] as CssUnit[])
        .filter((t) => t !== final)
        .map((t) => {
          const v = fromPx(toPx(rawResult, initial), t);
          const prec = t === "px" ? 0 : 2;
          return { unit: t, display: `${formatNumber(v, prec)} ${t}` };
        }),
      metadata: { precisionApplied: precision, kind: "css" },
    };

    // LENGTH / AREA / VOLUME
  } else if (lengthLike || inInfo.targetLength) {
    const det =
      lengthLike ??
      ({ kind: "length", unit: "m", power: 1 } as LengthDetection);
    if (!det) return { error: "Invalid length expression" };
    type = det.kind as CalculationResultType;

    // parse target (if present)
    let targetUnit = det.unit;
    if (inInfo.targetLength) {
      const m = inInfo.targetLength.match(/\b(mm|cm|m|km|in|ft|yd|mi)\b/);
      if (m) targetUnit = m[1] as any;
    }

    const out = convertLengthPow(rawResult, det.unit, targetUnit, det.power);
    const { formatted, precision } = formatByKind(type, out, targetUnit);
    const conversionsUnits: any[] = [
      "mm",
      "cm",
      "m",
      "km",
      "in",
      "ft",
      "yd",
      "mi",
    ];
    result = {
      value: out,
      formatted,
      unit: targetUnit,
      type,
      conversions: conversionsUnits
        .filter((u) => u !== targetUnit)
        .map((u) => {
          const v = convertLengthPow(rawResult, det.unit, u as any, det.power);
          const p = det.power === 1 ? 3 : 6;
          return {
            unit: u + (det.power === 1 ? "" : det.power === 2 ? "²" : "³"),
            display: `${formatNumber(v, p)} ${u}${
              det.power === 1 ? "" : det.power === 2 ? "²" : "³"
            }`,
          };
        }),
      metadata: { precisionApplied: precision, kind: det.kind },
    };

    // SPEED
  } else if (speedUnit || inInfo.targetSpeed) {
    type = "speed";
    const initial = (speedUnit ?? "m/s") as any;
    let final = initial as any;
    if (inInfo.targetSpeed) {
      final = /kph/i.test(inInfo.targetSpeed) ? "km/h" : inInfo.targetSpeed;
    }
    const out = convertSpeed(rawResult, initial, final);
    const { formatted, precision } = formatByKind(type, out, final);
    const units: any[] = ["m/s", "km/h", "mph", "kn"];
    result = {
      value: out,
      formatted,
      unit: final,
      type,
      conversions: units
        .filter((u) => u !== final)
        .map((u) => ({
          unit: u,
          display: `${formatNumber(convertSpeed(out, final, u), 2)} ${u}`,
        })),
      metadata: { precisionApplied: precision, kind: "speed" },
    };

    // ANGLE
  } else if (angleUnit || inInfo.targetAngle) {
    type = "angle";
    const initial = (angleUnit ?? "deg") as AngleUnit;
    const final = (inInfo.targetAngle ?? initial) as AngleUnit;
    const out = convertAngle(rawResult, initial, final);
    const { formatted, precision } = formatByKind(type, out, final);
    const units: AngleUnit[] = ["deg", "rad", "turn"];
    result = {
      value: out,
      formatted,
      unit: final,
      type,
      conversions: units
        .filter((u) => u !== final)
        .map((u) => ({
          unit: u,
          display: `${formatNumber(convertAngle(out, final, u), 3)} ${u}`,
        })),
      metadata: { precisionApplied: precision, kind: "angle" },
    };

    // CURRENCY
  } else if (usedCurrencies.size > 0 || targetCurrency) {
    type = "currency";
    const isFxApprox =
      !marketData.lastUpdated ||
      Date.now() - marketData.lastUpdated > EXCHANGE_CACHE_TTL;
    const desired =
      targetCurrency &&
      marketData.convertFromBase(rawResult, targetCurrency) != null
        ? targetCurrency
        : marketData.baseCurrency;

    const desiredValue =
      desired === marketData.baseCurrency
        ? rawResult
        : marketData.convertFromBase(rawResult, desired) ?? rawResult;

    const { formatted, precision } = formatByKind(type, desiredValue, desired);
    result = {
      value: desiredValue,
      formatted,
      unit: desired,
      type,
      conversions: buildCurrencyConversions(
        rawResult,
        marketData.baseCurrency,
        marketData,
        desired ? [desired] : [],
        isFxApprox
      ),
      metadata: { precisionApplied: precision, kind: "currency" },
    };

    // DURATION (as seconds base; only if tokens present)
  } else if (hasDurationTokens(withBarePercent) || inInfo.targetDuration) {
    type = "duration";
    const seconds = rawResult; // already normalized to seconds
    const final = inInfo.targetDuration?.toLowerCase() ?? "s";
    const toUnit = (sec: number, u: string) =>
      u === "ms"
        ? sec * 1000
        : u === "min"
        ? sec / 60
        : u === "h" || u === "hr"
        ? sec / 3600
        : u === "d" || u === "day" || u === "days"
        ? sec / 86400
        : sec;

    const out = toUnit(seconds, final);
    const { formatted, precision } = formatByKind(type, out, final);
    const targets = ["ms", "s", "min", "h", "d"];
    result = {
      value: out,
      formatted,
      unit: final,
      type,
      conversions: targets
        .filter((u) => u !== final)
        .map((u) => ({
          unit: u,
          display: `${formatNumber(toUnit(seconds, u), 3)} ${u}`,
        })),
      metadata: { precisionApplied: precision, kind: "duration" },
    };

    // PLAIN NUMBER
  } else {
    const { formatted, precision } = formatByKind("number", rawResult);
    result = {
      value: rawResult,
      formatted,
      type: "number",
      metadata: { precisionApplied: precision, kind: "dimensionless" },
    };
  }

  // Optional: range detection (metadata only; UI unchanged)
  const range = detectSimpleRange(input);
  if (range && result) {
    result.metadata = {
      ...(result.metadata || {}),
      range: {
        min: range.min,
        max: range.max,
        unit: range.unit ?? result.unit,
      },
    };
  }

  return { result };
};
