import AsyncStorage from "@react-native-async-storage/async-storage";

import { ENV } from "../config/env";

export interface ExchangeRateData {
  base: string;
  baseToTarget: Record<string, number>;
  targetToBase: Record<string, number>;
  fetchedAt: number;
}

export interface CoinPriceData {
  vsCurrency: string;
  prices: Record<string, number>;
  fetchedAt: number;
}

const DEFAULT_BASE_CURRENCY = "USD";
const EXCHANGE_CACHE_PREFIX = "exchange_rates_";
const COIN_CACHE_KEY = "coin_prices";
export const EXCHANGE_CACHE_TTL = 60 * 60 * 1000; // 1 hour
export const COIN_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const DEFAULT_EXCHANGE_RATES: ExchangeRateData = {
  base: DEFAULT_BASE_CURRENCY,
  baseToTarget: {
    USD: 1,
    EUR: 0.92,
    BRL: 5.1,
    GBP: 0.78,
    CAD: 1.36,
    AUD: 1.51,
    JPY: 157.0,
  },
  targetToBase: {
    USD: 1,
    EUR: 1 / 0.92,
    BRL: 1 / 5.1,
    GBP: 1 / 0.78,
    CAD: 1 / 1.36,
    AUD: 1 / 1.51,
    JPY: 1 / 157.0,
  },
  fetchedAt: Date.now(),
};

const DEFAULT_COIN_PRICES: CoinPriceData = {
  vsCurrency: DEFAULT_BASE_CURRENCY,
  prices: {
    bitcoin: 60000,
    ethereum: 2800,
    solana: 140,
    dogecoin: 0.12,
  },
  fetchedAt: Date.now(),
};

const buildExchangeRateData = (
  base: string,
  conversionRates: Record<string, number>
): ExchangeRateData => {
  const baseUpper = base.toUpperCase();
  const baseToTarget: Record<string, number> = { [baseUpper]: 1 };
  const targetToBase: Record<string, number> = { [baseUpper]: 1 };

  Object.entries(conversionRates).forEach(([code, rate]) => {
    const upper = code.toUpperCase();
    if (!Number.isFinite(rate) || rate <= 0) {
      return;
    }

    baseToTarget[upper] = rate;
    targetToBase[upper] = 1 / rate;
  });

  return {
    base: baseUpper,
    baseToTarget,
    targetToBase,
    fetchedAt: Date.now(),
  };
};

type Rates = Record<string, number>;

type FetchOptions = {
  base?: string; // default 'USD'
  symbols?: string[]; // limit currencies
};

const pickSymbols = (rates: Rates, symbols?: string[]) => {
  if (!symbols || symbols.length === 0) return rates;
  const set = new Set(symbols.map((s) => s.toUpperCase()));
  const out: Rates = {};
  for (const [k, v] of Object.entries(rates)) {
    if (set.has(k.toUpperCase())) out[k] = v;
  }
  return out;
};

// Rebase rates from USD to target base (for OXR free plan)
const rebaseFromUSD = (usdRates: Rates, base: string): Rates => {
  const baseRate = usdRates[base];
  if (!baseRate) throw new Error(`Base ${base} not found in USD rates`);
  const rebased: Rates = {};
  for (const [code, rateVsUSD] of Object.entries(usdRates)) {
    // rate(base->code) = rate(USD->code) / rate(USD->base)
    rebased[code] = rateVsUSD / baseRate;
  }
  rebased[base] = 1;
  return rebased;
};

const { openExchangeApiKey, exchangeRateApiKey, coinGeckoApiKey } = ENV;

async function fetchFromOpenExchange({
  base = "USD",
  symbols,
}: FetchOptions): Promise<{ base: string; rates: Rates; timestamp: number }> {
  if (!openExchangeApiKey)
    throw new Error("OPENEXCHANGE_API_KEY missing");
  const params = new URLSearchParams({ app_id: openExchangeApiKey });
  if (symbols && symbols.length)
    params.set("symbols", symbols.join(",").toUpperCase());

  const res = await fetch(
    `https://openexchangerates.org/api/latest.json?${params.toString()}`
  );
  if (!res.ok) throw new Error(`OpenExchange HTTP ${res.status}`);
  const data: { timestamp: number; base: "USD"; rates: Rates } =
    await res.json();

  const usdRates = symbols?.length
    ? pickSymbols(data.rates, symbols)
    : data.rates;
  const rates =
    base.toUpperCase() === "USD"
      ? { ...usdRates, USD: 1 }
      : rebaseFromUSD(usdRates, base.toUpperCase());

  return { base: base.toUpperCase(), rates, timestamp: data.timestamp * 1000 };
}

async function fetchFromExchangeRateAPI({
  base = "USD",
  symbols,
}: FetchOptions): Promise<{ base: string; rates: Rates; timestamp: number }> {
  if (!exchangeRateApiKey) throw new Error("EXCHANGERATE_API_KEY missing");

  // Note: Free plan endpoints typically require base in the path or only support USD; adjust if your plan supports /latest/{BASE}
  const res = await fetch(
    `https://v6.exchangerate-api.com/v6/${exchangeRateApiKey}/latest/${encodeURIComponent(
      base.toUpperCase()
    )}`
  );
  if (!res.ok) throw new Error(`ExchangeRate-API HTTP ${res.status}`);
  const data: {
    result: string;
    time_last_update_unix: number;
    base_code: string;
    conversion_rates: Rates;
  } = await res.json();
  if (data.result !== "success")
    throw new Error("ExchangeRate-API returned error");

  const rates = pickSymbols(data.conversion_rates, symbols);
  return {
    base: data.base_code,
    rates,
    timestamp: data.time_last_update_unix * 1000,
  };
}

// Public API: fetch latest FX rates with provider fallback
export async function fetchLatestRates(opts: FetchOptions = {}) {
  // Try OXR first if key exists; fall back to ExchangeRate-API
  const hasOXR = !!openExchangeApiKey;
  const hasER = !!exchangeRateApiKey;

  if (!hasOXR && !hasER) {
    throw new Error(
      "No FX provider keys configured. Set OPENEXCHANGE_API_KEY or EXCHANGERATE_API_KEY."
    );
  }

  try {
    if (hasOXR) return await fetchFromOpenExchange(opts);
  } catch (e) {
    console.warn("OpenExchange failed, falling back:", e);
  }

  return await fetchFromExchangeRateAPI(opts);
}

export const fetchExchangeRates = async (
  baseCurrency = DEFAULT_BASE_CURRENCY
): Promise<ExchangeRateData> => {
  const upperBase = baseCurrency.toUpperCase();
  const cacheKey = `${EXCHANGE_CACHE_PREFIX}${upperBase}`;

  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed: ExchangeRateData = JSON.parse(cached);
      if (Date.now() - parsed.fetchedAt < EXCHANGE_CACHE_TTL) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn("Failed to read cached exchange rates", error);
  }

  try {
    const { base, rates, timestamp } = await fetchLatestRates({
      base: upperBase,
      symbols: Object.keys(DEFAULT_EXCHANGE_RATES.baseToTarget),
    });

    const result = buildExchangeRateData(base, rates);
    result.fetchedAt = timestamp;

    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
    } catch (error) {
      console.warn("Failed to cache exchange rates", error);
    }

    return result;
  } catch (error) {
    console.warn("Falling back to default exchange rates", error);
    return DEFAULT_EXCHANGE_RATES;
  }
};

const COIN_SYMBOL_TO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  DOGE: "dogecoin",
};

export const COIN_IDS = Array.from(new Set(Object.values(COIN_SYMBOL_TO_ID)));

export const fetchCoinPrices = async (
  vsCurrency = DEFAULT_BASE_CURRENCY
): Promise<CoinPriceData> => {
  const upperCurrency = vsCurrency.toUpperCase();

  try {
    const cached = await AsyncStorage.getItem(COIN_CACHE_KEY);
    if (cached) {
      const parsed: CoinPriceData = JSON.parse(cached);
      if (
        parsed.vsCurrency === upperCurrency &&
        Date.now() - parsed.fetchedAt < COIN_CACHE_TTL
      ) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn("Failed to read cached coin prices", error);
  }

  const ids = COIN_IDS.join(",");
  const apiKey = coinGeckoApiKey?.trim();

  const url = new URL(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${upperCurrency.toLowerCase()}`
  );

  if (apiKey) {
    url.searchParams.set("x_cg_pro_api_key", apiKey);
  }

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch coin prices: ${response.status}`);
    }

    const data = await response.json();
    const prices: Record<string, number> = {};

    Object.entries(data ?? {}).forEach(([key, value]) => {
      if (value && typeof value === "object") {
        const amount = (value as Record<string, number>)[
          upperCurrency.toLowerCase()
        ];
        if (Number.isFinite(amount)) {
          prices[key] = amount as number;
        }
      }
    });

    if (Object.keys(prices).length === 0) {
      throw new Error("Unexpected coin price response");
    }

    const result: CoinPriceData = {
      vsCurrency: upperCurrency,
      prices,
      fetchedAt: Date.now(),
    };

    try {
      await AsyncStorage.setItem(COIN_CACHE_KEY, JSON.stringify(result));
    } catch (error) {
      console.warn("Failed to cache coin prices", error);
    }

    return result;
  } catch (error) {
    console.warn("Falling back to default coin prices", error);
    return DEFAULT_COIN_PRICES;
  }
};

export const getCoinIdFromSymbol = (symbol: string): string | undefined =>
  COIN_SYMBOL_TO_ID[symbol.toUpperCase()];

export const getSupportedCurrencyCodes = () =>
  Object.keys(DEFAULT_EXCHANGE_RATES.baseToTarget);

export const DEFAULT_BASE = DEFAULT_BASE_CURRENCY;
