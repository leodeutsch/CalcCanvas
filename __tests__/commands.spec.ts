import { evaluateLineOrCommand } from "../src/utils/calc/evaluateLineOrCommand";
import { getAllVars } from "../src/utils/calc/varStore";

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

describe("evaluateLineOrCommand", () => {
  const sheetId = "TEST";
  const md = mockMarketData() as any;
  const prev: number[] = [];

  test("assignment: apple = 300 g", () => {
    const r = evaluateLineOrCommand(
      "apple = 300 g  # feira",
      md,
      prev,
      sheetId
    );
    expect(r.kind).toBe("assign");
    const vars = getAllVars({ sheetId });
    expect(vars.apple && typeof vars.apple === "object").toBe(true); // TypedVar
  });

  test("calc using typed var with coercion", () => {
    const r = evaluateLineOrCommand("2 * apple in g", md, prev, sheetId);
    expect(r.kind).toBe("calc");
    const res = (r as any).evaluation.result;
    expect(res.type).toBe("mass");
    expect(res.unit?.toLowerCase()).toBe("g");
    // 2 * 300 g = 600 g
    expect(Math.round(res.value)).toBe(600);
  });

  test('import vars from "OtherSheet"', () => {
    // prepara outra sheet com uma var
    evaluateLineOrCommand("fuel = 2.5 L", md, prev, "OtherSheet");
    const r = evaluateLineOrCommand(
      'import vars from "OtherSheet"',
      md,
      prev,
      sheetId
    );
    expect(r.kind).toBe("import");
    const vars = getAllVars({ sheetId });
    expect(vars.fuel).toBeTruthy();
  });
});
