import { evaluateInput } from "../src/utils/evaluator";

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

describe("rand() sugar (deterministic with seed)", () => {
  test("rand() with seed", () => {
    const opts = { features: { allowRand: true, seed: 123 } } as any;
    const { result } = evaluateInput(
      "rand()",
      mockMarketData() as any,
      undefined,
      opts
    );
    expect(result?.type).toBe("number");
    const v = result?.value as number;
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  test("rand(a,b) with seed", () => {
    const opts = { features: { allowRand: true, seed: 123 } } as any;
    const { result } = evaluateInput(
      "rand(10,20)",
      mockMarketData() as any,
      undefined,
      opts
    );
    expect(result?.type).toBe("number");
    const v = result?.value as number;
    expect(v).toBeGreaterThanOrEqual(10);
    expect(v).toBeLessThan(20);
  });
});
