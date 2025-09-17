import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_BASE,
  fetchCoinPrices,
  fetchExchangeRates,
  getCoinIdFromSymbol,
} from "../services/marketData";

export interface MarketDataState {
  baseCurrency: string;
  exchangeRates: Record<string, number>;
  ratesToBase: Record<string, number>;
  coinPrices: Record<string, number>;
  isLoading: boolean;
  lastUpdated?: number;
  refresh: () => Promise<void>;
  getCurrencyRate: (code: string) => number | undefined;
  convertFromBase: (value: number, targetCode: string) => number | undefined;
  convertToBase: (value: number, sourceCode: string) => number | undefined;
  getCoinPriceBySymbol: (symbol: string) => number | undefined;
  getCoinAmountFromBase: (value: number, symbol: string) => number | undefined;
}

export const useMarketData = (): MarketDataState => {
  const [baseCurrency, setBaseCurrency] = useState(DEFAULT_BASE);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [ratesToBase, setRatesToBase] = useState<Record<string, number>>({});
  const [coinPrices, setCoinPrices] = useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [exchangeData, coinData] = await Promise.all([
        fetchExchangeRates(baseCurrency),
        fetchCoinPrices(baseCurrency),
      ]);

      setBaseCurrency(exchangeData.base);
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getCurrencyRate = useCallback(
    (code: string): number | undefined => {
      const upper = code.toUpperCase();
      if (upper === baseCurrency.toUpperCase()) {
        return 1;
      }
      return ratesToBase[upper];
    },
    [baseCurrency, ratesToBase]
  );

  const convertFromBase = useCallback(
    (value: number, targetCode: string): number | undefined => {
      const rate = exchangeRates[targetCode.toUpperCase()];
      if (rate == null) {
        return undefined;
      }
      return value * rate;
    },
    [exchangeRates]
  );

  const convertToBase = useCallback(
    (value: number, sourceCode: string): number | undefined => {
      const rate = getCurrencyRate(sourceCode);
      if (rate == null) {
        return undefined;
      }
      return value * rate;
    },
    [getCurrencyRate]
  );

  const getCoinPriceBySymbol = useCallback(
    (symbol: string): number | undefined => {
      const id = getCoinIdFromSymbol(symbol);
      if (!id) {
        return undefined;
      }
      return coinPrices[id];
    },
    [coinPrices]
  );

  const getCoinAmountFromBase = useCallback(
    (value: number, symbol: string): number | undefined => {
      const price = getCoinPriceBySymbol(symbol);
      if (!price || price === 0) {
        return undefined;
      }
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
      getCurrencyRate,
      convertFromBase,
      convertToBase,
      getCoinPriceBySymbol,
      getCoinAmountFromBase,
    ]
  );
};
