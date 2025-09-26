// Evaluation pipeline with: live variables (incl. mass strings), more units,
// dimension-aware soft checks, NL sugars (for/each/@/por, ranges & lists),
// date phrases, locale override (sheet/opcional), guard rails, memo, plugins,
// precision policy, and a small function whitelist.

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
  tempToK,
  TempUnit,
} from "./calc/units";

import {
  convertEnergy,
  convertPower,
  convertPressure,
  convertVolumeLiquid,
  detectEnergyUnit,
  detectPowerUnit,
  detectPressureUnit,
  detectVolumeLiquidUnit,
  ENERGY_UNITS,
  energyPrecision,
  POWER_UNITS,
  powerPrecision,
  pressPrecision,
  PRESSURE_UNITS,
  volLiqPrecision,
  VOLUME_LIQUID_UNITS,
} from "./calc/units_extra";

import { formatNumber, sanitizeForMathWithFns } from "./calc/mathSugars";

import {
  applyNLPSugars,
  detectSimpleRange,
  normalizeFractions,
  normalizeRangeAndListFns,
} from "./calc/nlpSugars";

import { normalizeUnitAndCurrencyAliases } from "./calc/aliases";
import { analyzeDimensions } from "./calc/dimensions";
import {
  buildSuggestions,
  evaluatePartials,
  findUnknownTokens,
} from "./calc/recovery";

import {
  applyDateOperations,
  evalBetweenExpression,
  formatDateResult,
  isBetweenExpression,
  parseDateExpression,
  parseDateOperations,
} from "./datetime";

import { checkExpressionGuards } from "./calc/limits";
import { makeLRU } from "./calc/memo";
import { runAfterEvaluate, runBeforeParse } from "./calc/plugins";
import { parseQuantityLiteral } from "./calc/quantity";
import { TypedVar } from "./calc/varStore";
import { getLocaleForEval } from "./locale/policy";

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

export interface EvaluateResult {
  result?: CalculationResult;
  error?: string;
  recovery?: {
    suggestions: string[];
    partial: Array<{ expr: string; value: number }>;
    unknownTokens: string[];
    normalizedExpression?: string;
  };
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

/** ---------- Deal semantics (for/each/@/por + infer per-unit) ---------- */
type DealMeta = {
  qty: number;
  label?: string; // "bag", "kg" etc
  total?: { amount: number; ccy: string }; // ex.: { amount: 400, ccy: "USD" }
  unitPrice?: { amount: number; ccy: string; per?: string }; // ex.: { amount: 80, ccy: "USD", per: "bag" }
};

const dealCache = makeLRU<string, { normalized: string; deal?: DealMeta }>(512);

const parseDealSemantics = (
  input: string
): { normalized: string; deal?: DealMeta } => {
  const fromCache = dealCache.get(input);
  if (fromCache) return fromCache;

  let s = input.trim();

  // 1) "<qty> <label> for <total> <CCC>"
  const reFor =
    /\b(\d+(?:\.\d+)?)\s+([a-zá-ú]+(?:\s+[a-zá-ú]+)*)\s+for\s+(\d+(?:\.\d+)?)\s*([A-Za-z]{3})\b/i;
  const mFor = s.match(reFor);
  if (mFor) {
    const qty = parseFloat(mFor[1]);
    const label = mFor[2].toLowerCase();
    const totalNum = parseFloat(mFor[3]);
    const ccy = mFor[4].toUpperCase();
    const normalized = s.replace(reFor, `${totalNum} ${ccy}`);
    const unitPrice = qty > 0 ? totalNum / qty : NaN;
    const out = {
      normalized,
      deal: {
        qty,
        label,
        total: { amount: totalNum, ccy: ccy },
        unitPrice: Number.isFinite(unitPrice)
          ? {
              amount: unitPrice,
              ccy: ccy,
              per: /kg|g|lb|oz|mm|cm|m|km|in|ft|yd|mi|ml|l/i.test(label)
                ? label
                : "each",
            }
          : undefined,
      } as DealMeta,
    };
    dealCache.set(input, out);
    return out;
  }

  // 2) "<qty> <label> @/por <price> <CCC> [each/cada]"
  const reAt =
    /\b(\d+(?:\.\d+)?)\s+([a-zá-ú]+(?:\s+[a-zá-ú]+)*)\s+(?:@|por)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]{3})(?:\s*(?:each|cada))?\b/i;
  const mAt = s.match(reAt);
  if (mAt) {
    const qty = parseFloat(mAt[1]);
    const label = mAt[2].toLowerCase();
    const price = parseFloat(mAt[3]);
    const ccy = mAt[4].toUpperCase();
    const total = qty * price;
    const normalized = s.replace(reAt, `${total} ${ccy}`);
    const out = {
      normalized,
      deal: {
        qty,
        label,
        total: { amount: total, ccy: ccy },
        unitPrice: {
          amount: price,
          ccy: ccy,
          per: /kg|g|lb|oz|mm|cm|m|km|in|ft|yd|mi|ml|l/i.test(label)
            ? label
            : "each",
        },
      } as DealMeta,
    };
    dealCache.set(input, out);
    return out;
  }

  // 3) "<qty> <unit> @ <price> <CCC>/<unit>"  ex: "2.5 kg @ 15 BRL/kg"
  const rePerUnit =
    /\b(\d+(?:\.\d+)?)\s*(mm|cm|m|km|in|ft|yd|mi|mg|g|kg|lb|oz|ml|l)\s+@?\s*(\d+(?:\.\d+)?)\s*([A-Za-z]{3})\s*\/\s*(\2)\b/i;
  const mPer = s.match(rePerUnit);
  if (mPer) {
    const qty = parseFloat(mPer[1]);
    const unit = mPer[2].toLowerCase();
    const price = parseFloat(mPer[3]);
    const ccy = mPer[4].toUpperCase();
    const total = qty * price;
    const normalized = s.replace(rePerUnit, `${total} ${ccy}`);
    const out = {
      normalized,
      deal: {
        qty,
        label: unit,
        total: { amount: total, ccy: ccy },
        unitPrice: { amount: price, ccy: ccy, per: unit },
      } as DealMeta,
    };
    dealCache.set(input, out);
    return out;
  }

  // 4) "<qty><unit> ... for <total> <CCC>" (sem "/unit") ⇒ infer per-unit
  const reQtyUnitForTotal =
    /\b(\d+(?:\.\d+)?)(mm|cm|m|km|in|ft|yd|mi|mg|g|kg|lb|oz|ml|l)\b[^=]*?\bfor\s+(\d+(?:\.\d+)?)\s*([A-Za-z]{3})\b/i;
  const mQut = s.match(reQtyUnitForTotal);
  if (mQut) {
    const qty = parseFloat(mQut[1]);
    const unit = mQut[2].toLowerCase();
    const totalNum = parseFloat(mQut[3]);
    const ccy = mQut[4].toUpperCase();
    const normalized = s.replace(reQtyUnitForTotal, `${totalNum} ${ccy}`);
    const unitPrice = qty > 0 ? totalNum / qty : NaN;
    const out = {
      normalized,
      deal: {
        qty,
        label: unit,
        total: { amount: totalNum, ccy: ccy },
        unitPrice: Number.isFinite(unitPrice)
          ? { amount: unitPrice, ccy: ccy, per: unit }
          : undefined,
      } as DealMeta,
    };
    dealCache.set(input, out);
    return out;
  }

  const out = { normalized: input };
  dealCache.set(input, out);
  return out;
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

  return { precision };
};

const hasAddSubtract = (s: string) => /(^|[^*\/])\s[+\-]\s/.test(" " + s + " ");

// ...no topo do evaluator, onde está hoje:
const buildCurrencyConversions = (
  valueInBase: number,
  baseCurrency: string,
  marketData: MarketDataState,
  fmtN: (v: number, fd?: number) => string,
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
        display: `${isApprox ? "~ " : ""}${fmtN(v, 2)} ${code}`,
      });
    }
  }

  for (const sym of COIN_SYMBOLS) {
    const amt = marketData.getCoinAmountFromBase(valueInBase, sym);
    if (amt != null) {
      out.push({
        unit: sym,
        display: `${fmtN(amt, amt < 1 ? 6 : 3)} ${sym}`,
      });
    }
  }
  return out;
};

/** Date flow (expanded) */
const evaluateDates = (
  input: string,
  fmt: (v: number, fd?: number) => string = (v, fd = 2) => formatNumber(v, fd)
): EvaluateResult | null => {
  // 1) BETWEEN → duração em segundos, com chips
  if (isBetweenExpression(input)) {
    const r = evalBetweenExpression(input);
    if (r) {
      const seconds = Math.round(r.ms / 1000);

      const toUnit = (sec: number, u: "ms" | "s" | "min" | "h" | "d") =>
        u === "ms"
          ? sec * 1000
          : u === "min"
          ? sec / 60
          : u === "h"
          ? sec / 3600
          : u === "d"
          ? sec / 86400
          : sec;

      const units: Array<"ms" | "s" | "min" | "h" | "d"> = [
        "ms",
        "s",
        "min",
        "h",
        "d",
      ];

      return {
        result: {
          value: seconds,
          formatted: r.formatted, // "X days (Y.y weeks)"
          unit: "s",
          type: "duration",
          conversions: units.map((u) => ({
            unit: u,
            display: `${fmt(toUnit(seconds, u), u === "ms" ? 0 : 3)} ${u}`,
          })),
          metadata: {
            kind: "duration",
            between: { from: r.aISO, to: r.bISO, ms: r.ms },
          },
        },
      };
    }
  }

  // 2) Datas pontuais (today/now/next monday/workdays(...))
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

/** Local helpers (duplicados aqui para não alterar outros módulos) */
const applyScaleSuffixesLocal = (input: string): string =>
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

const normalizeRadixLiteralsLocal = (s: string): string =>
  s
    .replace(/\b0x[0-9a-fA-F]+\b/g, (m) => String(parseInt(m, 16)))
    .replace(/\b0o[0-7]+\b/g, (m) => String(parseInt(m, 8)))
    .replace(/\b0b[01]+\b/g, (m) => String(parseInt(m, 2)));

const applyPercentPhrasesLocal = (s: string): string => {
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
  targetLength?: string;
  targetSpeed?: string;
  targetAngle?: AngleUnit;
  targetDuration?: string;
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

const ensureImplicitBetweenNumbers = (s: string): string =>
  s.replace(/(\d(?:\.\d+)?)(\s+)(?=\d)/g, (_m, n: string) => `${n} * `);

/** Context variables support */
export type EvalContext = {
  previousValues: number[];
  variables?: Record<string, number | string> | any;
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

const applyBarePercentLocal = (input: string): string =>
  input.replace(/(\d+(?:\.\d+)?)\s*%/g, (_m, n) => `((${n})/100)`);

// Substitui variáveis do contexto por números (suporta string "300 g" → kg)
const applyVariables = (
  input: string,
  vars?: Record<string, number | string | TypedVar>
): string => {
  if (!vars) return input;
  let s = input;

  for (const [rawName, rawValue] of Object.entries(vars)) {
    const nameLower = rawName.toLowerCase();

    if (/^(in|to|of|on|off|sum|avg|prev)$/i.test(nameLower)) continue;
    if (/^[A-Z]{3}$/.test(rawName)) continue;

    let replaceValue: number | null = null;

    if (typeof rawValue === "number") {
      replaceValue = rawValue;
    } else if (typeof rawValue === "string") {
      const q = parseQuantityLiteral(rawValue);
      if (q) replaceValue = q.valueSI;
      else {
        const asNum = Number(rawValue.replace(/\s+/g, ""));
        if (Number.isFinite(asNum)) replaceValue = asNum;
      }
    } else if (rawValue && typeof rawValue === "object") {
      const tv = rawValue as TypedVar;
      if (Number.isFinite(tv.valueSI)) replaceValue = tv.valueSI;
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

const parseLooseNumber = (s: string): number | null => {
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Ex.: "1,234.56" → vírgula = milhar, ponto = decimal
    const cleaned = s.replace(/,/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  if (hasComma && !hasDot) {
    // Ex.: "1.234,56" (ou "40,06") → vírgula = decimal
    const cleaned = s.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  // Só ponto ou só dígitos
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

// ---------- Main evaluate ----------
export const evaluateInput = (
  rawInput: string,
  marketData: MarketDataState,
  ctx?: EvalContext,
  options?: {
    locale?: string;
    sheetId?: string;
    features?: {
      allowRand?: boolean;
      seed?: number;
      strictDimensions?: boolean;
    };
  }
): EvaluateResult => {
  const input = rawInput ?? "";
  if (!input.trim()) return {};

  // Locale resolvido (device/sheet/override)
  const { localeTag } = getLocaleForEval({
    locale: options?.locale,
    sheetId: options?.sheetId,
  });
  const fmtN = (v: number, fd = 2) => formatNumber(v, fd, localeTag);

  // Dates first (including 'between')
  const dateTry = evaluateDates(input, fmtN);
  if (dateTry) {
    if (dateTry.result?.conversions) {
      dateTry.result.conversions = dateTry.result.conversions.map((c) => {
        const m = c.display.match(/(-?\d+(?:[.,]\d+)?)/);
        if (!m) return c;
        const num = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
        const rest = c.display.slice((m.index ?? 0) + m[0].length);
        return { ...c, display: `${fmtN(num, 3)}${rest}` };
      });
    }
    return dateTry;
  }

  // Dimensional analysis of the ORIGINAL expression (for warnings/composite)
  const dimInfo = analyzeDimensions(input);

  if (options?.features?.strictDimensions && dimInfo.addSubConflicts?.length) {
    return {
      error: "Incompatible units for addition/subtraction.",
      recovery: {
        suggestions: dimInfo.addSubConflicts
          .slice(0, 2)
          .map(
            (p) =>
              `Converta para a mesma dimensão antes de somar: "${p.left}" e "${p.right}".`
          ),
        partial: [],
        unknownTokens: [],
        normalizedExpression: undefined,
      },
    };
  }

  const makeLCG = (seed: number) => {
    let s = seed >>> 0 || 123456789;
    return () => {
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  };

  const applyRandSugar = (
    text: string,
    allow: boolean,
    seed?: number
  ): string => {
    if (!allow) return text;
    const rnd = makeLCG(seed ?? 42);
    let out = text.replace(
      /\brand\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/gi,
      (_m, a: string, b: string) => {
        const lo = parseFloat(a),
          hi = parseFloat(b);
        const x = rnd();
        return String(lo + x * (hi - lo));
      }
    );
    out = out.replace(/\brand\s*\(\s*\)/gi, () => String(rnd()));
    return out;
  };

  // Pre-normalization pipeline
  const randApplied = applyRandSugar(
    input,
    !!options?.features?.allowRand,
    options?.features?.seed
  );
  const withFractions = normalizeFractions(randApplied);

  const withNL = applyNLPSugars(withFractions);
  const withRangeList = normalizeRangeAndListFns(withNL);
  const withRadix = normalizeRadixLiteralsLocal(withRangeList);
  const withScales = applyScaleSuffixesLocal(withRadix);
  const withConstants = withScales
    .replace(/\bpi\b/gi, String(Math.PI))
    .replace(/\be\b/gi, String(Math.E));
  const withNumSeps = withConstants
    .replace(/(\d)[_,](?=\d)/g, "$1")
    .replace(/(\d),(?=\d{3}\b)/g, "$1");
  const withPercentSemantics = applyPercentPhrasesLocal(withNumSeps);

  // Durations inline normalization
  const withDurations = hasDurationTokens(withPercentSemantics)
    ? normalizeDurationExpression(withPercentSemantics)
    : withPercentSemantics;

  const inInfo = parseInClause(withDurations);
  const standardized = standardizeCurrencySymbols(inInfo.expression);
  const aliased = normalizeUnitAndCurrencyAliases(standardized);

  // Plugins (before-parse)
  const beforeApplied = runBeforeParse(aliased);

  // Deal semantics
  const dealParsed = parseDealSemantics(beforeApplied);
  const withDeals = dealParsed.normalized;
  const dealMeta = dealParsed.deal;

  // "= USD?" trailing
  const queryMatch = withDeals.match(/=\s*([a-z]{3})\??$/i);
  const targetCurrencyQuery = queryMatch
    ? queryMatch[1].toUpperCase()
    : undefined;
  const targetCurrency = (
    inInfo.targetCurrency ?? targetCurrencyQuery
  )?.toUpperCase();

  const expressionSource = queryMatch
    ? withDeals.replace(/=\s*([a-z]{3})\??$/i, "").trim()
    : withDeals;

  // Vars / context / bare %
  const withVars = applyVariables(expressionSource, ctx?.variables);
  const withContextTokens = applyContextTokens(withVars, ctx);
  const withBarePercent = applyBarePercentLocal(withContextTokens);

  // Heuristics for dimension/kind detection
  const massUnitFromText = determineMassUnit(withBarePercent);
  const tempUnitFromText = determineTempUnit(withBarePercent);
  const dataUnitFromText = determineDataUnit(withBarePercent);
  const cssUnitFromText = determineCssUnit(withBarePercent);
  const lengthLike: LengthDetection = detectLengthLike(withBarePercent);
  const speedUnit = detectSpeedUnit(withBarePercent);
  const angleUnit = detectAngleUnit(withBarePercent);

  const volLiquidUnit = detectVolumeLiquidUnit(withBarePercent);
  const energyUnit = detectEnergyUnit(withBarePercent);
  const powerUnit = detectPowerUnit(withBarePercent);
  const pressureUnit = detectPressureUnit(withBarePercent);

  // Dynamic tokens (fx/crypto)
  const usedCurrencies = new Set<string>();
  let withDynamicTokens = resolveDynamicTokens(
    withBarePercent,
    marketData,
    usedCurrencies
  );

  // Explicit mult and sanitize
  const withNumsMult = ensureImplicitBetweenNumbers(withDynamicTokens);
  const withParensMult = ensureImplicitAroundParens(withNumsMult);
  const mathExpression = sanitizeForMathWithFns(withParensMult);

  // Guard rails
  const guardErr = checkExpressionGuards(withParensMult);
  if (guardErr) {
    return {
      error: guardErr,
      recovery: {
        suggestions: [
          "Tente reduzir o tamanho da expressão ou dividir em etapas.",
        ],
        partial: [],
        unknownTokens: [],
        normalizedExpression:
          withParensMult.slice(0, 2000) +
          (withParensMult.length > 2000 ? " …" : ""),
      },
    };
  }

  if (!mathExpression) {
    const suggestions = buildSuggestions(input);
    const unknown = findUnknownTokens(withParensMult);
    return {
      error: "Invalid calculation",
      recovery: {
        suggestions,
        unknownTokens: unknown,
        normalizedExpression: withParensMult.trim() || undefined,
        partial: [],
      },
    };
  }

  // Simple incompatible +/− check (mass vs length)
  if (hasAddSubtract(mathExpression) && massUnitFromText && lengthLike) {
    return { error: "Incompatible units for addition/subtraction." };
  }

  // Evaluate
  let rawResult: number;
  try {
    rawResult = math.evaluate(mathExpression);
    if (typeof rawResult !== "number" || !Number.isFinite(rawResult)) {
      throw new Error("NaN");
    }
  } catch {
    const suggestions = buildSuggestions(input);
    const unknown = findUnknownTokens(withParensMult);
    const partial = evaluatePartials(withParensMult, (s) => math.evaluate(s));
    return {
      error: "Invalid calculation",
      recovery: {
        suggestions,
        unknownTokens: unknown,
        normalizedExpression: withParensMult.trim(),
        partial,
      },
    };
  }

  // ---------- Build result by detected kind ----------
  let result: CalculationResult;
  let type: CalculationResultType = "number";

  // MASS
  if (massUnitFromText || inInfo.targetMass) {
    type = "mass";
    const initial = (massUnitFromText ?? "kg") as (typeof MASS_UNITS)[number];
    const final = (inInfo.targetMass ?? initial) as (typeof MASS_UNITS)[number];

    const kg = rawResult / (MASS_FACTORS[initial] ?? 1);
    const out = kg * (MASS_FACTORS[final] ?? 1);

    const { precision } = formatByKind(type, out, final);
    result = {
      value: out,
      formatted: fmtN(out, precision),
      unit: final,
      type,
      conversions: MASS_UNITS.filter((u) => u !== final).map((u) => {
        const v = kg * (MASS_FACTORS[u] ?? 1);
        const p = u === "g" || u === "oz" ? 1 : 2;
        return { unit: u, display: `${fmtN(v, p)} ${u}` };
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
    const { precision } = formatByKind(type, out, final.toUpperCase());
    result = {
      value: out,
      formatted: fmtN(out, precision),
      unit: final.toUpperCase(),
      type,
      conversions: (["c", "f", "k"] as TempUnit[])
        .filter((t) => t !== final)
        .map((t) => {
          const v = kToTemp(k, t);
          return {
            unit: t.toUpperCase(),
            display: `${fmtN(v, 2)} ${t.toUpperCase()}`,
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
    const { precision } = formatByKind(type, out, final.toUpperCase());
    result = {
      value: out,
      formatted: fmtN(out, precision),
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
            display: `${fmtN(v, prec)} ${t.toUpperCase()}`,
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
    const { precision } = formatByKind(type, out, final);
    const cssUnits: CssUnit[] = ["px", "pt", "em"];
    result = {
      value: out,
      formatted: fmtN(out, precision),
      unit: final,
      type,
      conversions: cssUnits
        .filter((unit) => unit !== final)
        .map((unit) => {
          const v = fromPx(toPx(rawResult, initial), unit);
          const p = unit === "px" ? 0 : 2;
          return { unit, display: `${fmtN(v, p)} ${unit}` };
        }),
      metadata: { precisionApplied: precision, kind: "css" },
    };

    // LENGTH / AREA / VOLUME (geométrico)
  } else if (lengthLike || inInfo.targetLength) {
    const det =
      lengthLike ??
      ({ kind: "length", unit: "m", power: 1 } as LengthDetection);
    type = det!.kind as CalculationResultType;

    let targetUnit = det!.unit;
    if (inInfo.targetLength) {
      const m = inInfo.targetLength.match(/\b(mm|cm|m|km|in|ft|yd|mi)\b/);
      if (m) targetUnit = m[1] as any;
    }

    const out = convertLengthPow(rawResult, det!.unit, targetUnit, det!.power);
    const { precision } = formatByKind(type, out, targetUnit);
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
      formatted: fmtN(out, precision),
      unit: targetUnit,
      type,
      conversions: conversionsUnits
        .filter((u) => u !== targetUnit)
        .map((u) => {
          const v = convertLengthPow(
            rawResult,
            det!.unit,
            u as any,
            det!.power
          );
          const p = det!.power === 1 ? 3 : 6;
          const sup = det!.power === 1 ? "" : det!.power === 2 ? "²" : "³";
          return { unit: u + sup, display: `${fmtN(v, p)} ${u}${sup}` };
        }),
      metadata: { precisionApplied: precision, kind: det!.kind },
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
    const { precision } = formatByKind(type, out, final);
    const units: any[] = ["m/s", "km/h", "mph", "kn"];
    result = {
      value: out,
      formatted: fmtN(out, precision),
      unit: final,
      type,
      conversions: units
        .filter((u) => u !== final)
        .map((u) => ({
          unit: u,
          display: `${fmtN(convertSpeed(out, final, u), 2)} ${u}`,
        })),
      metadata: { precisionApplied: precision, kind: "speed" },
    };

    // ANGLE
  } else if (angleUnit || inInfo.targetAngle) {
    type = "angle";
    const initial = (angleUnit ?? "deg") as AngleUnit;
    const final = (inInfo.targetAngle ?? initial) as AngleUnit;
    const out = convertAngle(rawResult, initial, final);
    const { precision } = formatByKind(type, out, final);
    const units: AngleUnit[] = ["deg", "rad", "turn"];
    result = {
      value: out,
      formatted: fmtN(out, precision),
      unit: final,
      type,
      conversions: units
        .filter((u) => u !== final)
        .map((u) => ({
          unit: u,
          display: `${fmtN(convertAngle(out, final, u), 3)} ${u}`,
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

    const { precision } = formatByKind(type, desiredValue, desired);
    result = {
      value: desiredValue,
      formatted: fmtN(desiredValue, precision),
      unit: desired,
      type,
      // >>> passa fmtN aqui e NÃO faça mais o map com regex depois <<<
      conversions: buildCurrencyConversions(
        rawResult,
        marketData.baseCurrency,
        marketData,
        fmtN,
        desired ? [desired] : [],
        isFxApprox
      ),
      metadata: { precisionApplied: precision, kind: "currency" },
    };

    // DURATION (as seconds base)
  } else if (hasDurationTokens(withBarePercent) || inInfo.targetDuration) {
    type = "duration";
    const seconds = rawResult;
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
    const { precision } = formatByKind(type, out, final);
    const targets = ["ms", "s", "min", "h", "d"];
    result = {
      value: out,
      formatted: fmtN(out, precision),
      unit: final,
      type,
      conversions: targets
        .filter((u) => u !== final)
        .map((u) => ({
          unit: u,
          display: `${fmtN(toUnit(seconds, u), 3)} ${u}`,
        })),
      metadata: { precisionApplied: precision, kind: "duration" },
    };
  } else if (
    volLiquidUnit ||
    (inInfo.targetLength && /\b(mL|l|L|gal)\b/.test(inInfo.targetLength))
  ) {
    const initial = (volLiquidUnit ?? "L") as any;
    let final = initial;
    if (inInfo.targetLength) {
      const m = inInfo.targetLength.match(/\b(mL|l|L|gal)\b/);
      if (m) final = m[1] === "l" ? "L" : (m[1] as any);
    }
    const out = convertVolumeLiquid(rawResult, initial, final);
    const precision = volLiqPrecision(final, out);
    result = {
      value: out,
      formatted: fmtN(out, precision),
      unit: final,
      type: "volume",
      conversions: VOLUME_LIQUID_UNITS.filter((u) => u !== final).map((u) => {
        const v = convertVolumeLiquid(rawResult, initial, u);
        return { unit: u, display: `${fmtN(v, volLiqPrecision(u, v))} ${u}` };
      }),
      metadata: { precisionApplied: precision, kind: "volume" },
    };
  } else if (energyUnit) {
    const initial = energyUnit;
    const final = initial;
    const out = rawResult;
    const precision = energyPrecision(final, out);
    result = {
      value: out,
      formatted: fmtN(out, precision),
      unit: final,
      type: "energy",
      conversions: ENERGY_UNITS.filter((u) => u !== final).map((u) => {
        const v = convertEnergy(out, final, u);
        return { unit: u, display: `${fmtN(v, energyPrecision(u, v))} ${u}` };
      }),
      metadata: { precisionApplied: precision, kind: "energy" },
    };
  } else if (powerUnit) {
    const initial = powerUnit;
    const final = initial;
    const out = rawResult;
    const precision = powerPrecision(final, out);
    result = {
      value: out,
      formatted: fmtN(out, precision),
      unit: final,
      type: "power",
      conversions: POWER_UNITS.filter((u) => u !== final).map((u) => {
        const v = convertPower(out, final, u);
        return { unit: u, display: `${fmtN(v, powerPrecision(u, v))} ${u}` };
      }),
      metadata: { precisionApplied: precision, kind: "power" },
    };
  } else if (pressureUnit) {
    const initial = pressureUnit;
    const final = initial;
    const out = rawResult;
    const precision = pressPrecision(final, out);
    result = {
      value: out,
      formatted: fmtN(out, precision),
      unit: final,
      type: "pressure",
      conversions: PRESSURE_UNITS.filter((u) => u !== final).map((u) => {
        const v = convertPressure(out, final, u);
        return { unit: u, display: `${fmtN(v, pressPrecision(u, v))} ${u}` };
      }),
      metadata: { precisionApplied: precision, kind: "pressure" },
    };

    // PLAIN NUMBER
  } else {
    const { precision } = formatByKind("number", rawResult);
    result = {
      value: rawResult,
      formatted: fmtN(rawResult, precision),
      type: "number",
      metadata: { precisionApplied: precision, kind: "dimensionless" },
    };
  }

  // Optional: range detection (metadata only)
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

  // Inject dimension warnings/composite/normalized (soft)
  if (result) {
    const warnings: string[] = [];
    const dimInfo = analyzeDimensions(input);
    if (dimInfo.addSubConflicts?.length) {
      warnings.push(
        ...dimInfo.addSubConflicts.map(
          (p) =>
            `Soma/subtração entre "${p.left}" e "${p.right}" pode ser incompatível.`
        )
      );
    }
    result.metadata = {
      ...(result.metadata || {}),
      dimensions: {
        kindsFound: Array.from(dimInfo.kindsFound),
        composite: dimInfo.composite,
      },
      warnings: warnings.length ? warnings : undefined,
      normalizedExpression: mathExpression,
    };
  }

  // Inject deal chips (e, opcionalmente, metadata.deal)
  if (result && dealMeta) {
    const conversions = result.conversions ? [...result.conversions] : [];
    const fmtMoney = (v: number, unit: string) => `${fmtN(v, 2)} ${unit}`;

    if (dealMeta.total) {
      conversions.unshift({
        unit: dealMeta.total.ccy,
        display: `${fmtMoney(dealMeta.total.amount, dealMeta.total.ccy)} total`,
      });
    }
    if (dealMeta.unitPrice) {
      const per = dealMeta.unitPrice.per ?? (dealMeta.label || "each");
      conversions.unshift({
        unit: `${dealMeta.unitPrice.ccy}/${per}`,
        display: `${fmtMoney(
          dealMeta.unitPrice.amount,
          dealMeta.unitPrice.ccy
        )} / ${per}`,
      });
    }
    result.conversions = conversions;
    result.metadata = { ...(result.metadata || {}), deal: dealMeta };
  }

  // Plugins (after-evaluate)
  if (result) {
    runAfterEvaluate({
      input,
      normalizedExpression: mathExpression,
      value: result.value,
      result,
    });
  }

  return { result };
};
