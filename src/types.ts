export type CalculationResultType =
  | "mass"
  | "currency"
  | "number"
  | "date"
  | "css"
  | "temperature"
  | "data"
  | "length"
  | "speed"
  | "area"
  | "volume"
  | "angle"
  | "energy"
  | "power"
  | "pressure"
  | "duration";

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
  metadata?: {
    precisionApplied?: number;
    range?: { min: number; max: number; unit?: string };
    kind?: string;
    deal?: {
      qty: number;
      total?: { amount: number; ccy: string };
      unitPrice?: { amount: number; ccy: string; per?: string };
      label?: string;
    };
    between?: { start?: any; end?: any; ms?: any; from?: any; to?: any };
    dimensions?: {
      kindsFound?: string[];
      composite?: string;
    };
    warnings?: string[];
    normalizedExpression?: string;
  };
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

export interface Result {
  formatted: string;
  unit?: string;
  conversions?: { unit: string; display: string }[];
}

export interface Line {
  id: string;
  input: string;
  result?: Result;
  error?: string;
}
