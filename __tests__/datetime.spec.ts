import { evaluateInput } from "../src/utils/evaluator";

// mock mínimo de MarketDataState para datas (FX não é usado nessas paths)
const mockMarketData = () => ({
  baseCurrency: "USD",
  exchangeRates: {},
  ratesToBase: {},
  lastUpdated: Date.now(),
  getCurrencyRate: (_c: string) => null,
  convertFromBase: (_v: number, _c: string) => null,
  getCoinAmountFromBase: (_v: number, _s: string) => null,
  getCoinPriceBySymbol: (_s: string) => null,
});

describe("datetime – expressions", () => {
  test("between → duration with chips", () => {
    const { result } = evaluateInput(
      "between 2024-01-01 and 2024-01-11",
      mockMarketData() as any
    );
    expect(result?.type).toBe("duration");
    // 10 dias -> ~864000000 ms -> ~864000 s
    expect(result?.unit).toBe("s");
    expect(result?.conversions?.some((c: any) => c.unit === "d")).toBe(true);
    expect(result?.metadata?.between?.from).toMatch(/2024-01-01/);
    expect(result?.metadata?.between?.to).toMatch(/2024-01-11/);
  });

  test("workdays(10) from today", () => {
    const { result } = evaluateInput(
      "workdays(10) from today",
      mockMarketData() as any
    );
    expect(result?.type).toBe("date");
    expect(typeof result?.value).toBe("number");
    expect(result?.formatted).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });

  test("workdays(5) from 2025-01-06", () => {
    const { result } = evaluateInput(
      "workdays(5) from 2025-01-06",
      mockMarketData() as any
    );
    expect(result?.type).toBe("date");
    expect(result?.formatted).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });

  test("next monday + 2w", () => {
    const { result } = evaluateInput(
      "next monday + 2w",
      mockMarketData() as any
    );
    expect(result?.type).toBe("date");
    expect(typeof result?.value).toBe("number");
  });
});
