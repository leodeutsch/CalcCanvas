import type { CalculationLine, CalculationResult, Note } from "../types";

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createLine = (
  input = "",
  result?: CalculationResult
): CalculationLine => ({
  id: generateId(),
  input,
  result,
});

export const createInitialNote = (): Note => ({
  id: generateId(),
  title: "Sheet",
  lines: [
    createLine("3 apples * $2.50 each", {
      value: 7.5,
      formatted: "7.50",
      unit: "USD",
      type: "currency",
      conversions: [],
    }),
  ],
  lastModified: new Date().toISOString(),
});

export const createBlankNote = (sheetNumber: number): Note => ({
  id: generateId(),
  title: sheetNumber === 1 ? "Sheet" : `Sheet ${sheetNumber}`,
  lines: [createLine()],
  lastModified: new Date().toISOString(),
});
