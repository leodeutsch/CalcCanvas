jest.mock("../src/services/marketData", () => ({
  EXCHANGE_CACHE_TTL: 5 * 60 * 1000, // 5min, valor qualquer pro evaluator
}));

import { createMarketDataMock } from "../__mocks__/marketData.mock";
import { evaluateInput } from "../src/utils/evaluator";

const md = createMarketDataMock({
  baseCurrency: "USD",
  fx: { USD: 1, EUR: 0.9, BRL: 5.0 },
  coins: { BTC: 60000, ETH: 3000, SOL: 150, DOGE: 0.2 },
});

const run = (expr: string, vars?: Record<string, number | string>) =>
  evaluateInput(expr, md as any, {
    previousValues: [],
    variables: vars,
  });

describe("evaluator basics", () => {
  test("plain arithmetic", () => {
    const r = run("2 + 3 * 4").result!;
    expect(r.type).toBe("number");
    expect(r.value).toBe(14);
  });

  test("scale suffixes", () => {
    const r = run("2k + 500").result!;
    expect(r.value).toBe(2500);
  });

  test("percent phrases", () => {
    const r = run("10% of 500").result!;
    expect(r.value).toBe(50);
  });
});

describe("units & conversions", () => {
  test("mass: 1500 g in kg", () => {
    const r = run("1500 g in kg").result!;
    expect(r.type).toBe("mass");
    expect(r.unit).toBe("kg");
    expect(r.value).toBeCloseTo(1.5, 6);
  });

  test("data: 2 GB in mb", () => {
    const r = run("2 gb in mb").result!;
    expect(r.type).toBe("data");
    expect(r.unit?.toLowerCase()).toBe("mb");
    expect(r.value).toBeCloseTo(2000, 3);
  });

  test("css: 12 pt in px", () => {
    const r = run("12 pt in px").result!;
    expect(r.type).toBe("css");
    expect(r.unit).toBe("px");
    // 1pt = 96/72 px
    expect(r.value).toBeCloseTo(12 * (96 / 72), 6);
  });

  test("temperature: 0 c in f", () => {
    const r = run("0 c in f").result!;
    expect(r.type).toBe("temperature");
    expect(r.unit).toBe("F");
    expect(r.value).toBeCloseTo(32, 6);
  });
});

describe("currency & tokens", () => {
  test("USD symbol/code normalization", () => {
    const r = run("$100 + 50 usd").result!;
    expect(r.type).toBe("currency"); // because a currency token was used
    expect(r.unit).toBe("USD"); // stays in base by default
    expect(r.value).toBeCloseTo(150, 6);
  });

  test('explicit target currency with "= EUR"', () => {
    const r = run("100 usd = eur").result!;
    // convert base 100 to EUR (rate 0.9)
    expect(r.type).toBe("currency");
    expect(r.unit).toBe("EUR");
    expect(r.value).toBeCloseTo(90, 6);
  });
});

describe("variables & mass-like strings", () => {
  test("string variable parsed as mass (apples)", () => {
    const r = run("5 apples in kg", { apples: "300g" }).result!;
    expect(r.type).toBe("mass");
    expect(r.unit).toBe("kg");
    expect(r.value).toBeCloseTo(1.5, 6);
  });

  test("singular/plural tolerance", () => {
    const r = run("5 apple in kg", { apple: "300g" }).result!;
    expect(r.type).toBe("mass");
    expect(r.unit).toBe("kg");
    expect(r.value).toBeCloseTo(1.5, 6);
  });
});

describe("context tokens", () => {
  test("prev/sum/avg with previousValues", () => {
    const result = evaluateInput("prev + avg", md as any, {
      previousValues: [10, 20, 30],
      variables: {},
    }).result!;
    // prev = 30; avg(10,20,30)=20 => 50
    expect(result.value).toBe(50);
  });
});

describe("edge / natural-language gaps", () => {
  test('interpret "5 bags for 400 usd" as 400 total (and optionally 80 each)', () => {
    const r = run("5 bags for 400 usd").result!;
    expect(r.type).toBe("currency");
    expect(r.unit).toBe("USD");
    expect(r.value).toBeCloseTo(400, 6);
    // opcionalmente poderíamos exibir 80 cada no futuro, em conversions/metadata
  });
});
