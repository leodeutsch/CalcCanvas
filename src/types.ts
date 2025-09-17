export type CalculationResultType = "mass" | "currency" | "number" | "date";

export interface ResultConversion {
  unit: string;
  display: string;
}

export interface CalculationResult {
  value: number;
  formatted: string;
  unit?: string;
  type: CalculationResultType;
  conversions?: ResultConversion[];
  metadata?: Record<string, unknown>;
}

export interface CalculationLine {
  id: string;
  input: string;
  result?: CalculationResult;
  error?: string;
}

export interface Note {
  id: string;
  title: string;
  lines: CalculationLine[];
  lastModified: string;
}
