import * as math from "mathjs";
import type { MarketDataState } from "../hooks/useMarketData";
import { EXCHANGE_CACHE_TTL } from "../services/marketData";
import type {
  CalculationResult,
  CalculationResultType,
  ResultConversion,
} from "../types";
import {
  applyDateOperations,
  formatDateResult,
  isDateExpression,
  parseDateExpression,
  parseDateOperations,
} from "./datetime";

/** ---------- Units & strong types ---------- */
const MASS_UNITS = ["kg", "g", "lb", "oz"] as const;
type MassUnit = (typeof MASS_UNITS)[number];

const COIN_SYMBOLS = ["BTC", "ETH", "SOL", "DOGE"] as const;
type CoinSymbol = (typeof COIN_SYMBOLS)[number];

type TempUnit = "c" | "f" | "k";
type DataUnit = "b" | "kb" | "mb" | "gb" | "tb" | "kib" | "mib" | "gib" | "tib";
type CssUnit = "px" | "pt" | "em";

/** ---------- Constants ---------- */
const MASS_CONVERSION_FACTORS: Record<MassUnit, number> = {
  kg: 1,
  g: 1000,
  lb: 2.20462262,
  oz: 35.2739619,
};

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

/** ---------- Result envelope ---------- */
interface EvaluateResult {
  result?: CalculationResult;
  error?: string;
}

/** ---------- Helpers ---------- */
const getCurrencyCodes = (md: MarketDataState): string[] => {
  const set = new Set<string>([
    md.baseCurrency.toUpperCase(),
    ...Object.keys(md.exchangeRates || {}).map((c) => c.toUpperCase()),
    ...Object.keys(md.ratesToBase || {}).map((c) => c.toUpperCase()),
  ]);
  // Remove obvious non-ISO keys, just in case
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

const ensureExplicitMultiplication = (
  input: string,
  dynamicTokens: string[]
): string => {
  if (dynamicTokens.length === 0) return input;
  const tokenPattern = dynamicTokens.join("|");
  const beforeRegex = new RegExp(`(\\d|\\))\\s*(${tokenPattern})`, "gi");
  const afterRegex = new RegExp(`(${tokenPattern})\\s*(\\d|\\()`, "gi");

  let normalized = input.replace(
    beforeRegex,
    (_m, left, token) => `${left} * ${token}`
  );
  normalized = normalized.replace(
    afterRegex,
    (_m, token, right) => `${token} * ${right}`
  );
  return normalized;
};

const formatNumber = (value: number, fractionDigits = 2) => {
  try {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return value.toFixed(fractionDigits);
  }
};

/** ---------- Conversions & formatters ---------- */
const buildMassConversions = (
  value: number,
  unit: MassUnit
): ResultConversion[] => {
  const baseInKg = value / (MASS_CONVERSION_FACTORS[unit] ?? 1);
  return MASS_UNITS.map((targetUnit) => {
    const convertedValue = baseInKg * MASS_CONVERSION_FACTORS[targetUnit];
    const precision = targetUnit === "g" || targetUnit === "oz" ? 1 : 2;
    return {
      unit: targetUnit,
      display: `${formatNumber(convertedValue, precision)} ${targetUnit}`,
    };
  }).filter((c) => c.unit !== unit);
};

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

  const conversions: ResultConversion[] = [];
  for (const currency of currencies) {
    const converted = marketData.convertFromBase(valueInBase, currency);
    if (converted != null) {
      const prefix = isApprox ? "~ " : "";
      conversions.push({
        unit: currency,
        display: `${prefix}${formatNumber(converted, 2)} ${currency}`,
      });
    }
  }

  // Include crypto amounts for reference
  for (const symbol of COIN_SYMBOLS) {
    const amount = marketData.getCoinAmountFromBase(valueInBase, symbol);
    if (amount != null) {
      const precision = amount < 1 ? 6 : 3;
      conversions.push({
        unit: symbol,
        display: `${formatNumber(amount, precision)} ${symbol}`,
      });
    }
  }

  return conversions;
};

const formatMassResult = (value: number, unit: MassUnit): CalculationResult => {
  const precision = unit === "g" || unit === "oz" ? 1 : 2;
  return {
    value,
    formatted: formatNumber(value, precision),
    unit,
    type: "mass",
  };
};

const formatCurrencyResult = (
  value: number,
  currency: string,
  approx = false
): CalculationResult => ({
  value,
  formatted: `${approx ? "~ " : ""}${formatNumber(value, 2)}`,
  unit: currency,
  type: "currency",
});

const formatGenericResult = (value: number): CalculationResult => ({
  value,
  formatted: formatNumber(value, 3).replace(/\.0+$/, ""),
  type: "number",
});

const determineMassUnit = (input: string): MassUnit | undefined => {
  const lower = input.toLowerCase();
  if (lower.includes("kg")) return "kg";
  if (lower.includes(" oz")) return "oz";
  if (lower.includes(" lb")) return "lb";
  if (lower.includes(" g") && !lower.includes("kg")) return "g";
  return undefined;
};

const sanitizeForMath = (input: string): string =>
  input
    .toLowerCase()
    .replace(/\s*(apples?|items?|pieces?|units?|bananas?)\s*/g, " ")
    .replace(/\s*each\s*/g, " ")
    .replace(/\s*times?\s*/g, " * ")
    .replace(/\s*plus\s*/g, " + ")
    .replace(/\s*minus\s*/g, " - ")
    .replace(/\s*divided?\s*by\s*/g, " / ")
    .replace(/[^0-9+\-*/.() ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** ---------- Dynamic tokens ---------- */
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
    if ((COIN_SYMBOLS as readonly string[]).includes(token)) {
      const price = marketData.getCoinPriceBySymbol(token);
      if (price != null) {
        usedCurrencies.add(marketData.baseCurrency);
        return price.toString();
      }
    }
    return match;
  });

  return updated;
};

/** ---------- Date flow ---------- */
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

/** ---------- Numi-like sugar (same as você já tinha) ---------- */
const applyScaleSuffixes = (input: string): string =>
  input.replace(
    /\b(\d+(?:\.\d+)?)([kKmMbBtT])\b/g,
    (_m, num: string, suf: string) => {
      const n = parseFloat(num);
      const factor =
        suf === "k" || suf === "K"
          ? 1e3
          : suf === "m" || suf === "M"
          ? 1e6
          : suf === "b" || suf === "B"
          ? 1e9
          : 1e12;
      return String(n * factor);
    }
  );

const normalizeRadixLiterals = (input: string): string =>
  input
    .replace(/\b0x[0-9a-fA-F]+\b/g, (m) => String(parseInt(m, 16)))
    .replace(/\b0o[0-7]+\b/g, (m) => String(parseInt(m, 8)))
    .replace(/\b0b[01]+\b/g, (m) => String(parseInt(m, 2)));

const applyPercentPhrases = (input: string): string => {
  let s = input;
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*of\s*\(([^)]+)\)/gi,
    (_m, p, a) => `((${a}) * (${p}/100))`
  );
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*of\s+([^\s][^+\-*/()]+(?:\([^)]*\))?)/gi,
    (_m, p, a) => `((${a}) * (${p}/100))`
  );
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*on\s*\(([^)]+)\)/gi,
    (_m, p, a) => `((${a}) + ((${a}) * (${p}/100)))`
  );
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*on\s+([^\s][^+\-*/()]+(?:\([^)]*\))?)/gi,
    (_m, p, a) => `((${a}) + ((${a}) * (${p}/100)))`
  );
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*off\s*\(([^)]+)\)/gi,
    (_m, p, a) => `((${a}) - ((${a}) * (${p}/100)))`
  );
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*off\s+([^\s][^+\-*/()]+(?:\([^)]*\))?)/gi,
    (_m, p, a) => `((${a}) - ((${a}) * (${p}/100)))`
  );
  return s;
};

type InClause = {
  expression: string;
  targetMass?: MassUnit;
  targetCurrency?: string;
  targetTemp?: TempUnit;
  targetData?: DataUnit;
  targetCss?: CssUnit;
};

const parseInClause = (input: string): InClause => {
  const m = input.match(/\s+(?:in|to)\s+([A-Za-z°]{1,4})\s*$/i);
  if (!m) return { expression: input };
  const raw = m[1];
  const unit = raw.toLowerCase();
  const out: InClause = { expression: input.slice(0, m.index).trim() };

  if (["kg", "g", "lb", "oz"].includes(unit)) out.targetMass = unit as MassUnit;

  if (/^[A-Za-z]{3}$/.test(raw)) out.targetCurrency = raw.toUpperCase();

  if (["c", "°c", "f", "°f", "k", "°k"].includes(unit)) {
    out.targetTemp = unit.replace("°", "") as TempUnit;
  }

  if (
    ["b", "kb", "mb", "gb", "tb", "kib", "mib", "gib", "tib"].includes(unit)
  ) {
    out.targetData = unit as DataUnit;
  }

  if (["px", "pt", "em"].includes(unit)) out.targetCss = unit as CssUnit;

  return out;
};

const ensureImplicitAroundParens = (s: string): string =>
  s
    .replace(/\)\s*\(/g, ")*(")
    .replace(/(\d)\s*\(/g, "$1*(")
    .replace(/\)\s*(\d)/g, ")*$1");

/** ---------- Temperature / Data / CSS helpers (iguais aos seus) ---------- */
const determineTempUnit = (input: string): TempUnit | undefined => {
  const lower = input.toLowerCase();
  if (/\b\d+(\.\d+)?\s*°?\s*c\b/.test(lower)) return "c";
  if (/\b\d+(\.\d+)?\s*°?\s*f\b/.test(lower)) return "f";
  if (/\b\d+(\.\d+)?\s*°?\s*k\b/.test(lower)) return "k";
  return undefined;
};
const tempToK = (v: number, u: TempUnit) =>
  u === "c" ? v + 273.15 : u === "f" ? ((v - 32) * 5) / 9 + 273.15 : v;
const kToTemp = (k: number, u: TempUnit) =>
  u === "c" ? k - 273.15 : u === "f" ? ((k - 273.15) * 9) / 5 + 32 : k;
const formatTemperatureResult = (
  value: number,
  u: TempUnit
): CalculationResult => ({
  value,
  formatted: formatNumber(value, 2),
  unit: u.toUpperCase(),
  type: "temperature",
});
const buildTemperatureConversions = (
  value: number,
  unit: TempUnit
): ResultConversion[] => {
  const k = tempToK(value, unit);
  const targets: TempUnit[] = ["c", "f", "k"];
  return targets
    .filter((t) => t !== unit)
    .map((t) => {
      const v = kToTemp(k, t);
      return {
        unit: t.toUpperCase(),
        display: `${formatNumber(v, 2)} ${t.toUpperCase()}`,
      };
    });
};

const DATA_FACTORS_SI: Record<
  Exclude<DataUnit, "kib" | "mib" | "gib" | "tib">,
  number
> = {
  b: 1,
  kb: 1e3,
  mb: 1e6,
  gb: 1e9,
  tb: 1e12,
};
const DATA_FACTORS_BIN: Record<
  Extract<DataUnit, "kib" | "mib" | "gib" | "tib">,
  number
> = {
  kib: 1024,
  mib: 1024 ** 2,
  gib: 1024 ** 3,
  tib: 1024 ** 4,
};
const determineDataUnit = (input: string): DataUnit | undefined => {
  const m = input.toLowerCase().match(/\b(b|kb|mb|gb|tb|kib|mib|gib|tib)\b/);
  return (m?.[1] as DataUnit) || undefined;
};
const formatDataResult = (
  value: number,
  unit: DataUnit
): CalculationResult => ({
  value,
  formatted: formatNumber(value, 3).replace(/\.0+$/, ""),
  unit: unit.toUpperCase(),
  type: "data",
});
const buildDataConversions = (
  value: number,
  unit: DataUnit
): ResultConversion[] => {
  const toBits = (v: number, u: DataUnit) =>
    (DATA_FACTORS_SI as Record<string, number>)[u] != null
      ? v * (DATA_FACTORS_SI as Record<string, number>)[u]
      : v * (DATA_FACTORS_BIN as Record<string, number>)[u];
  const fromBits = (bits: number, u: DataUnit) =>
    (DATA_FACTORS_SI as Record<string, number>)[u] != null
      ? bits / (DATA_FACTORS_SI as Record<string, number>)[u]
      : bits / (DATA_FACTORS_BIN as Record<string, number>)[u];

  const bits = toBits(value, unit);
  const targets: DataUnit[] = [
    "b",
    "kb",
    "mb",
    "gb",
    "tb",
    "kib",
    "mib",
    "gib",
    "tib",
  ];
  return targets
    .filter((t) => t !== unit)
    .map((t) => {
      const v = fromBits(bits, t);
      const prec = t === "b" ? 0 : v < 10 ? 3 : 2;
      return {
        unit: t.toUpperCase(),
        display: `${formatNumber(v, prec)} ${t.toUpperCase()}`,
      };
    });
};

const CSS_DEFAULTS = { ppi: 96, emPx: 16 };
const determineCssUnit = (input: string): CssUnit | undefined => {
  const m = input.toLowerCase().match(/\b(px|pt|em)\b/);
  return (m?.[1] as CssUnit) || undefined;
};
const convertCss = (value: number, from: CssUnit, to: CssUnit) => {
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
  return fromPx(toPx(value, from), to);
};
const formatCssResult = (value: number, unit: CssUnit): CalculationResult => ({
  value,
  formatted: formatNumber(value, unit === "px" ? 0 : 2),
  unit,
  type: "css",
});
const buildCssConversions = (
  value: number,
  unit: CssUnit
): ResultConversion[] => {
  const targets: CssUnit[] = ["px", "pt", "em"];
  return targets
    .filter((t) => t !== unit)
    .map((t) => {
      const v = convertCss(value, unit, t);
      const prec = t === "px" ? 0 : 2;
      return { unit: t, display: `${formatNumber(v, prec)} ${t}` };
    });
};

/** ---------- Percent / constants / variables ---------- */
export type EvalContext = {
  previousValues: number[];
  variables?: Record<string, number>;
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
  vars?: Record<string, number>
): string => {
  if (!vars) return input;
  let s = input;
  for (const [nameLower, value] of Object.entries(vars)) {
    if (/^(in|to|of|on|off|sum|avg|prev)$/i.test(nameLower)) continue;
    if (/^[A-Z]{3}$/.test(nameLower)) continue;
    const re = new RegExp(`\\b${nameLower}\\b`, "gi");
    s = s.replace(re, String(value));
  }
  return s;
};
const applyConstants = (input: string): string =>
  input.replace(/\bpi\b/gi, String(Math.PI)).replace(/\be\b/gi, String(Math.E));
const normalizeNumberSeparators = (input: string): string =>
  input.replace(/(\d)[_,](?=\d)/g, "$1").replace(/(\d),(?=\d{3}\b)/g, "$1");

/** ---------- Main evaluator ---------- */
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

  // Pre-math pipeline
  const withRadix = normalizeRadixLiterals(input);
  const withScales = applyScaleSuffixes(withRadix);
  const withConstants = applyConstants(withScales);
  const withNumSeps = normalizeNumberSeparators(withConstants);
  const withPercentSemantics = applyPercentPhrases(withNumSeps);

  const inInfo = parseInClause(withPercentSemantics);
  const standardized = standardizeCurrencySymbols(inInfo.expression);

  // Trailing "= USD?" (if "in XXX" is present, it wins)
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

  // Hints
  const massUnitFromText = determineMassUnit(withBarePercent);
  const tempUnitFromText = determineTempUnit(withBarePercent);
  const dataUnitFromText = determineDataUnit(withBarePercent);
  const cssUnitFromText = determineCssUnit(withBarePercent);

  // Dynamic tokens
  const usedCurrencies = new Set<string>();
  const withDynamicTokens = resolveDynamicTokens(
    withBarePercent,
    marketData,
    usedCurrencies
  );

  const withParensMult = ensureImplicitAroundParens(withDynamicTokens);
  const mathExpression = sanitizeForMath(withParensMult);
  if (!mathExpression) return {};

  try {
    const rawResult = math.evaluate(mathExpression);
    if (typeof rawResult !== "number" || !Number.isFinite(rawResult)) {
      return { error: "Invalid calculation" };
    }

    let result: CalculationResult;
    let resultType: CalculationResultType = "number";

    // MASS
    if (massUnitFromText || inInfo.targetMass) {
      const initialUnit = (massUnitFromText ?? "kg") as MassUnit;
      resultType = "mass";
      let v = rawResult;
      const finalUnit = (inInfo.targetMass ?? initialUnit) as MassUnit;
      if (finalUnit !== initialUnit) {
        const kg = v / (MASS_CONVERSION_FACTORS[initialUnit] ?? 1);
        v = kg * (MASS_CONVERSION_FACTORS[finalUnit] ?? 1);
      }
      const base = formatMassResult(v, finalUnit);
      base.conversions = buildMassConversions(
        Number(base.value),
        base.unit as MassUnit
      );
      result = base;

      // TEMPERATURE
    } else if (tempUnitFromText || inInfo.targetTemp) {
      const initial = (tempUnitFromText ?? "c") as TempUnit;
      const final = (inInfo.targetTemp ?? initial) as TempUnit;
      resultType = "temperature";
      const k = tempToK(rawResult, initial);
      const out = kToTemp(k, final);
      const base = formatTemperatureResult(out, final);
      base.conversions = buildTemperatureConversions(out, final);
      result = base;

      // DATA
    } else if (dataUnitFromText || inInfo.targetData) {
      const initial = (dataUnitFromText ?? "mb") as DataUnit;
      const final = (inInfo.targetData ?? initial) as DataUnit;
      resultType = "data";
      const toBits = (v: number, u: DataUnit) =>
        (DATA_FACTORS_SI as Record<string, number>)[u] != null
          ? v * (DATA_FACTORS_SI as Record<string, number>)[u]
          : v * (DATA_FACTORS_BIN as Record<string, number>)[u];
      const fromBits = (bits: number, u: DataUnit) =>
        (DATA_FACTORS_SI as Record<string, number>)[u] != null
          ? bits / (DATA_FACTORS_SI as Record<string, number>)[u]
          : bits / (DATA_FACTORS_BIN as Record<string, number>)[u];
      const bits = toBits(rawResult, initial);
      const out = fromBits(bits, final);
      const base = formatDataResult(out, final);
      base.conversions = buildDataConversions(out, final);
      result = base;

      // CSS
    } else if (cssUnitFromText || inInfo.targetCss) {
      const initial = (cssUnitFromText ?? "px") as CssUnit;
      const final = (inInfo.targetCss ?? initial) as CssUnit;
      resultType = "css";
      const out = convertCss(rawResult, initial, final);
      const base = formatCssResult(out, final);
      base.conversions = buildCssConversions(out, final);
      result = base;

      // CURRENCY
    } else if (usedCurrencies.size > 0 || targetCurrency) {
      resultType = "currency";

      const isFxApprox =
        !marketData.lastUpdated ||
        Date.now() - marketData.lastUpdated > EXCHANGE_CACHE_TTL;

      const desiredCurrency =
        targetCurrency &&
        marketData.convertFromBase(rawResult, targetCurrency) != null
          ? targetCurrency
          : marketData.baseCurrency;

      const desiredValue =
        desiredCurrency === marketData.baseCurrency
          ? rawResult
          : marketData.convertFromBase(rawResult, desiredCurrency) ?? rawResult;

      const base = formatCurrencyResult(
        desiredValue,
        desiredCurrency,
        isFxApprox
      );
      base.conversions = buildCurrencyConversions(
        rawResult,
        marketData.baseCurrency,
        marketData,
        desiredCurrency ? [desiredCurrency] : [],
        isFxApprox
      );
      result = base;

      // PLAIN NUMBER
    } else {
      result = formatGenericResult(rawResult);
    }

    return { result: { ...result, type: resultType } };
  } catch {
    return { error: "Invalid calculation" };
  }
};
