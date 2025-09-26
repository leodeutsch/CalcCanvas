// Minimal mock to satisfy evaluateInput usage.

export type MarketDataMock = ReturnType<typeof createMarketDataMock>;

export const createMarketDataMock = (opts?: {
  baseCurrency?: string;
  fx?: Record<string, number>; // target per base (e.g. EUR: 0.9 means 1 USD = 0.9 EUR)
  coins?: Record<string, number>; // coin price in base (e.g. BTC: 65000 USD)
  lastUpdated?: number;
}) => {
  const base = opts?.baseCurrency ?? "USD";
  const fx = opts?.fx ?? { USD: 1, EUR: 0.9, BRL: 5.0 };
  const coins = opts?.coins ?? { BTC: 65000, ETH: 3000, SOL: 150, DOGE: 0.2 };

  return {
    baseCurrency: base,
    exchangeRates: fx,
    ratesToBase: Object.fromEntries(
      Object.entries(fx).map(([k, v]) => [k, v === 0 ? 0 : 1 / v])
    ),
    coinPrices: coins,
    lastUpdated: opts?.lastUpdated ?? Date.now(),
    refresh: () => {},

    // evaluator chama isso para “substituir” tokens
    getCurrencyRate: (code: string) => {
      const up = code.toUpperCase();
      return fx[up] ?? null;
    },

    // valor em base -> target
    convertFromBase: (value: number, to: string) => {
      const up = to.toUpperCase();
      const rate = fx[up];
      if (rate == null) return null;
      return value * rate;
    },

    // valor em currency -> base
    convertToBase: (value: number, from: string) => {
      const up = from.toUpperCase();
      const rate = fx[up];
      if (rate == null || rate === 0) return null;
      return value / rate;
    },

    getCoinPriceBySymbol: (sym: string) => {
      const up = sym.toUpperCase();
      return coins[up] ?? null;
    },

    getCoinAmountFromBase: (value: number, sym: string) => {
      const up = sym.toUpperCase();
      const price = coins[up];
      if (!price) return null;
      return value / price;
    },
  };
};
