import { normalizeRangeAndListFns } from "../src/utils/calc/nlpSugars";

describe("normalizeRangeAndListFns", () => {
  test("sum range integers", () => {
    const s = normalizeRangeAndListFns("sum 1..10");
    // Fórmula fechada
    expect(s).toBe("((1+10)*(10-1+1))/2");
  });

  test("avg range integers", () => {
    const s = normalizeRangeAndListFns("avg(1..11)");
    expect(s).toBe("(1+11)/2");
  });

  test("median range integers", () => {
    const s = normalizeRangeAndListFns("median 5..12");
    expect(s).toBe("(5+12)/2");
  });

  test("sum list", () => {
    const s = normalizeRangeAndListFns("sum(2, 5, 9)");
    expect(s).toBe("(2+ 5+ 9)".replace(/\s+/g, " "));
  });

  test("avg list", () => {
    const s = normalizeRangeAndListFns("avg(2, 5, 9)");
    expect(s.replace(/\s+/g, " ")).toBe("((2+ 5+ 9)/3)".replace(/\s+/g, " "));
  });

  test("median list of 3", () => {
    const s = normalizeRangeAndListFns("median(2, 9, 5)");
    // 2+9+5 - min(2,9,5) - max(2,9,5) = 7 => mediana textual correta
    expect(s).toContain("- min((");
    expect(s).toContain(") - max((");
  });

  test("sum percentages of value", () => {
    const s = normalizeRangeAndListFns("sum(10%, 12%, 8%) of 2500");
    // vira ((10% of 2500) + (12% of 2500) + (8% of 2500))
    expect(s).toMatch(/\(10% of 2500\)/);
    expect(s).toMatch(/\(12% of 2500\)/);
    expect(s).toMatch(/\(8% of 2500\)/);
  });

  test("avg percentages of variable", () => {
    const s = normalizeRangeAndListFns("avg(10%,12%) of price");
    expect(s).toMatch(/\(\(10% of price\) \+ \(12% of price\)\)\/2/);
  });
});
