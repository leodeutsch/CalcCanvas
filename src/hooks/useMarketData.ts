import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_BASE,
  fetchCoinPrices,
  fetchExchangeRates,
  getCoinIdFromSymbol,
  loadPersistedBase,
  persistBaseCurrency,
} from "../services/marketData";

export interface MarketDataState {
  baseCurrency: string;
  exchangeRates: Record<string, number>; // base -> target
  ratesToBase: Record<string, number>; // target -> base
  coinPrices: Record<string, number>;
  isLoading: boolean;
  lastUpdated?: number;

  refresh: () => Promise<void>;
  setBaseCurrency: (code: string) => Promise<void>;

  getCurrencyRate: (code: string) => number | undefined; // code -> rate to base
  convertFromBase: (value: number, targetCode: string) => number | undefined;
  convertToBase: (value: number, sourceCode: string) => number | undefined;

  getCoinPriceBySymbol: (symbol: string) => number | undefined;
  getCoinAmountFromBase: (value: number, symbol: string) => number | undefined;
}

export const useMarketData = (): MarketDataState => {
  const [baseCurrency, setBaseCurrencyState] = useState(DEFAULT_BASE);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(
    {}
  );
  const [ratesToBase, setRatesToBase] = useState<Record<string, number>>({});
  const [coinPrices, setCoinPrices] = useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  // Load persisted base at startup
  useEffect(() => {
    (async () => {
      const persisted = await loadPersistedBase();
      setBaseCurrencyState(persisted);
    })();
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [exchangeData, coinData] = await Promise.all([
        fetchExchangeRates(baseCurrency),
        fetchCoinPrices(baseCurrency),
      ]);

      setBaseCurrencyState(exchangeData.base);
      setExchangeRates(exchangeData.baseToTarget);
      setRatesToBase(exchangeData.targetToBase);
      setCoinPrices(coinData.prices);
      setLastUpdated(Date.now());
    } catch (error) {
      console.error("Error refreshing market data", error);
    } finally {
      setIsLoading(false);
    }
  }, [baseCurrency]);

  // Expose a setter that persists and refreshes
  const setBaseCurrency = useCallback(
    async (code: string) => {
      const upper = code.toUpperCase();
      if (upper === baseCurrency.toUpperCase()) return;
      await persistBaseCurrency(upper);
      setBaseCurrencyState(upper);
      // refresh will run due to baseCurrency change effect below
    },
    [baseCurrency]
  );

  // Refresh when base currency changes (and on mount after load)
  useEffect(() => {
    refresh();
  }, [refresh]);

  const getCurrencyRate = useCallback(
    (code: string): number | undefined => {
      const upper = code.toUpperCase();
      if (upper === baseCurrency.toUpperCase()) return 1;
      return ratesToBase[upper];
    },
    [baseCurrency, ratesToBase]
  );

  const convertFromBase = useCallback(
    (value: number, targetCode: string): number | undefined => {
      const rate = exchangeRates[targetCode.toUpperCase()];
      if (rate == null) return undefined;
      return value * rate;
    },
    [exchangeRates]
  );

  const convertToBase = useCallback(
    (value: number, sourceCode: string): number | undefined => {
      const rate = getCurrencyRate(sourceCode);
      if (rate == null) return undefined;
      return value * rate;
    },
    [getCurrencyRate]
  );

  const getCoinPriceBySymbol = useCallback(
    (symbol: string): number | undefined => {
      const id = getCoinIdFromSymbol(symbol);
      if (!id) return undefined;
      return coinPrices[id];
    },
    [coinPrices]
  );

  const getCoinAmountFromBase = useCallback(
    (value: number, symbol: string): number | undefined => {
      const price = getCoinPriceBySymbol(symbol);
      if (!price || price === 0) return undefined;
      return value / price;
    },
    [getCoinPriceBySymbol]
  );

  return useMemo(
    () => ({
      baseCurrency,
      exchangeRates,
      ratesToBase,
      coinPrices,
      isLoading,
      lastUpdated,

      refresh,
      setBaseCurrency,

      getCurrencyRate,
      convertFromBase,
      convertToBase,
      getCoinPriceBySymbol,
      getCoinAmountFromBase,
    }),
    [
      baseCurrency,
      exchangeRates,
      ratesToBase,
      coinPrices,
      isLoading,
      lastUpdated,
      refresh,
      setBaseCurrency,
      getCurrencyRate,
      convertFromBase,
      convertToBase,
      getCoinPriceBySymbol,
      getCoinAmountFromBase,
    ]
  );
};
