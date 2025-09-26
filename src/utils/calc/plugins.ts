export type BeforeParseHook = (input: string) => string;
export type AfterEvaluateHook = (payload: {
  input: string;
  normalizedExpression: string;
  value: number;
  result: any; // CalculationResult mutável
}) => void;

const before: BeforeParseHook[] = [];
const after: AfterEvaluateHook[] = [];

export const registerBeforeParse = (fn: BeforeParseHook) => {
  before.push(fn);
};
export const registerAfterEvaluate = (fn: AfterEvaluateHook) => {
  after.push(fn);
};

export const runBeforeParse = (s: string): string => {
  return before.reduce((acc, fn) => {
    try {
      return fn(acc) ?? acc;
    } catch {
      return acc;
    }
  }, s);
};

export const runAfterEvaluate = (p: {
  input: string;
  normalizedExpression: string;
  value: number;
  result: any;
}) => {
  for (const fn of after) {
    try {
      fn(p);
    } catch {}
  }
};
