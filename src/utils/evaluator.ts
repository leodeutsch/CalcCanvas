import * as math from "mathjs";

import {
  applyDateOperations,
  formatDateResult,
  isDateExpression,
  parseDateExpression,
  parseDateOperations,
} from "./datetime";

import type { MarketDataState } from "../hooks/useMarketData";
import type {
  CalculationResult,
  CalculationResultType,
  ResultConversion,
} from "../types";

const MASS_UNITS = ["kg", "g", "lb", "oz"] as const;
const MASS_CONVERSION_FACTORS: Record<string, number> = {
  kg: 1,
  g: 1000,
  lb: 2.20462262,
  oz: 35.2739619,
};

const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "BRL",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "CHF",
];

const COIN_SYMBOLS = ["BTC", "ETH", "SOL", "DOGE"] as const;

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  "US$": "USD",
  "R$": "BRL",
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
  if (dynamicTokens.length === 0) {
    return input;
  }

  const tokenPattern = dynamicTokens.join("|");
  const beforeRegex = new RegExp(`(\\d|\\))\\s*(${tokenPattern})`, "gi");
  const afterRegex = new RegExp(`(${tokenPattern})\\s*(\\d|\\()`, "gi");

  let normalized = input.replace(beforeRegex, (_match, left, token) =>
    `${left} * ${token}`
  );

  normalized = normalized.replace(afterRegex, (_match, token, right) =>
    `${token} * ${right}`
  );

  return normalized;
};

const formatNumber = (value: number, fractionDigits = 2) => {
  try {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch (error) {
    return value.toFixed(fractionDigits);
  }
};

const buildMassConversions = (
  value: number,
  unit: string
): ResultConversion[] => {
  const baseInKg = value / (MASS_CONVERSION_FACTORS[unit] ?? 1);

  return MASS_UNITS.map((targetUnit) => {
    const convertedValue = baseInKg * MASS_CONVERSION_FACTORS[targetUnit];
    const precision = targetUnit === "g" || targetUnit === "oz" ? 1 : 2;
    return {
      unit: targetUnit,
      display: `${formatNumber(convertedValue, precision)} ${targetUnit}`,
    };
  }).filter((conversion) => conversion.unit !== unit);
};

const buildCurrencyConversions = (
  value: number,
  baseCurrency: string,
  marketData: MarketDataState,
  exclude: string[] = []
): ResultConversion[] => {
  const currencies = SUPPORTED_CURRENCIES.filter(
    (code) => code !== baseCurrency && !exclude.includes(code)
  );

  const conversions: ResultConversion[] = [];

  currencies.forEach((currency) => {
    const converted = marketData.convertFromBase(value, currency);
    if (converted != null) {
      conversions.push({
        unit: currency,
        display: `${formatNumber(converted, 2)} ${currency}`,
      });
    }
  });

  // Provide coin conversions if possible (value expressed in base currency)
  COIN_SYMBOLS.forEach((symbol) => {
    const amount = marketData.getCoinAmountFromBase(value, symbol);
    if (amount != null) {
      const precision = amount < 1 ? 6 : 3;
      conversions.push({
        unit: symbol,
        display: `${formatNumber(amount, precision)} ${symbol}`,
      });
    }
  });

  return conversions;
};

const formatMassResult = (value: number, unit: string): CalculationResult => {
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
  currency: string
): CalculationResult => ({
  value,
  formatted: formatNumber(value, 2),
  unit: currency,
  type: "currency",
});

const formatGenericResult = (value: number): CalculationResult => ({
  value,
  formatted: formatNumber(value, 3).replace(/\.0+$/, ""),
  type: "number",
});

const determineMassUnit = (input: string): string | undefined => {
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

const resolveDynamicTokens = (
  input: string,
  marketData: MarketDataState,
  usedCurrencies: Set<string>
): string => {
  let updated = input;
  const tokens = [...SUPPORTED_CURRENCIES, ...COIN_SYMBOLS];

  updated = ensureExplicitMultiplication(updated, tokens);

  const tokenRegex = new RegExp(`\\b(${tokens.join("|")})\\b`, "gi");

  updated = updated.replace(tokenRegex, (match) => {
    const token = match.toUpperCase();
    if (SUPPORTED_CURRENCIES.includes(token)) {
      const rate = marketData.getCurrencyRate(token);
      if (rate != null) {
        usedCurrencies.add(token);
        return rate.toString();
      }
    }

    if (COIN_SYMBOLS.includes(token as (typeof COIN_SYMBOLS)[number])) {
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

const evaluateDates = (input: string): EvaluateResult | null => {
  const parsed = parseDateExpression(input);
  if (!parsed) {
    return null;
  }

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

export const evaluateInput = (
  input: string,
  marketData: MarketDataState
): EvaluateResult => {
  if (!input.trim()) {
    return {};
  }

  if (isDateExpression(input)) {
    const dateResult = evaluateDates(input);
    if (dateResult) {
      return dateResult;
    }
  }

  const massUnit = determineMassUnit(input);
  const usedCurrencies = new Set<string>();

  const standardized = standardizeCurrencySymbols(input);
  const queryMatch = standardized.match(/=\s*([a-z]{3})\??$/i);
  const targetCurrency = queryMatch ? queryMatch[1].toUpperCase() : undefined;
  const expressionSource = queryMatch
    ? standardized.replace(/=\s*([a-z]{3})\??$/i, "").trim()
    : standardized;

  const withDynamicTokens = resolveDynamicTokens(
    expressionSource,
    marketData,
    usedCurrencies
  );
  const mathExpression = sanitizeForMath(withDynamicTokens);

  if (!mathExpression) {
    return {};
  }

  try {
    const rawResult = math.evaluate(mathExpression);

    if (typeof rawResult !== "number" || !Number.isFinite(rawResult)) {
      return { error: "Invalid calculation" };
    }

    let result: CalculationResult;
    let resultType: CalculationResultType = "number";

    if (massUnit) {
      resultType = "mass";
      result = formatMassResult(rawResult, massUnit);
      result.conversions = buildMassConversions(rawResult, massUnit);
    } else if (usedCurrencies.size > 0 || targetCurrency) {
      resultType = "currency";

      const desiredCurrency =
        targetCurrency && marketData.convertFromBase(rawResult, targetCurrency) != null
          ? targetCurrency
          : marketData.baseCurrency;

      const desiredValue =
        desiredCurrency === marketData.baseCurrency
          ? rawResult
          : marketData.convertFromBase(rawResult, desiredCurrency) ?? rawResult;

      result = formatCurrencyResult(desiredValue, desiredCurrency);

      result.conversions = buildCurrencyConversions(
        rawResult,
        marketData.baseCurrency,
        marketData,
        desiredCurrency ? [desiredCurrency] : []
      );
    } else {
      result = formatGenericResult(rawResult);
    }

    return { result: { ...result, type: resultType } };
  } catch (error) {
    return { error: "Invalid calculation" };
  }
};
