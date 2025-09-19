// Lightweight text → math transformations and safe helpers

const ALLOWED_FUNS = [
  "round",
  "floor",
  "ceil",
  "abs",
  "min",
  "max",
  "sqrt",
  "pow",
  "log",
  "log10",
  "sin",
  "cos",
  "tan",
] as const;

export const formatNumber = (value: number, fractionDigits = 2) => {
  try {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return value.toFixed(fractionDigits);
  }
};

// 2k / 3.5M / 1.2B / 7T
export const applyScaleSuffixes = (input: string): string =>
  input.replace(
    /\b(\d+(?:\.\d+)?)([kKmMbBtT])\b/g,
    (_m, num: string, suf: string) => {
      const n = parseFloat(num);
      const factor =
        suf === "k" || suf === "K"
          ? 1e3
          : suf === "m" || suf === "M"
          ? 1e6
          : suf === "b" || suf === "B"
          ? 1e9
          : 1e12;
      return String(n * factor);
    }
  );

// 0x / 0o / 0b literals
export const normalizeRadixLiterals = (input: string): string =>
  input
    .replace(/\b0x[0-9a-fA-F]+\b/g, (m) => String(parseInt(m, 16)))
    .replace(/\b0o[0-7]+\b/g, (m) => String(parseInt(m, 8)))
    .replace(/\b0b[01]+\b/g, (m) => String(parseInt(m, 2)));

// Unicode simple fractions (½ ¼ ¾ → numeric)
const UNICODE_FRAC: Record<string, string> = {
  "½": "(1/2)",
  "¼": "(1/4)",
  "¾": "(3/4)",
  "⅓": "(1/3)",
  "⅔": "(2/3)",
  "⅕": "(1/5)",
  "⅖": "(2/5)",
  "⅗": "(3/5)",
  "⅘": "(4/5)",
  "⅙": "(1/6)",
  "⅚": "(5/6)",
  "⅛": "(1/8)",
  "⅜": "(3/8)",
  "⅝": "(5/8)",
  "⅞": "(7/8)",
};
export const applyUnicodeFractions = (s: string): string =>
  s.replace(/[½¼¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (m) => UNICODE_FRAC[m] ?? m);

// Semantic percentages: X% of/on/off A
export const applyPercentPhrases = (input: string): string => {
  let s = input;
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*of\s*\(([^)]+)\)/gi,
    (_m, p, a) => `((${a}) * (${p}/100))`
  );
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*of\s+([^\s][^+\-*/()]+(?:\([^)]*\))?)/gi,
    (_m, p, a) => `((${a}) * (${p}/100))`
  );
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*on\s*\(([^)]+)\)/gi,
    (_m, p, a) => `((${a}) + ((${a}) * (${p}/100)))`
  );
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*on\s+([^\s][^+\-*/()]+(?:\([^)]*\))?)/gi,
    (_m, p, a) => `((${a}) + ((${a}) * (${p}/100)))`
  );
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*off\s*\(([^)]+)\)/gi,
    (_m, p, a) => `((${a}) - ((${a}) * (${p}/100)))`
  );
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*%?\s*off\s+([^\s][^+\-*/()]+(?:\([^)]*\))?)/gi,
    (_m, p, a) => `((${a}) - ((${a}) * (${p}/100)))`
  );
  return s;
};

// Bare percent: "12%" -> "(12/100)"
export const applyBarePercent = (input: string): string =>
  input.replace(/(\d+(?:\.\d+)?)\s*%/g, (_m, n) => `((${n})/100)`);

// Constants: pi, e, tau, phi, ln2, ln10, sqrt2, sqrt3
export const applyConstants = (input: string): string =>
  input
    .replace(/\btau\b/gi, String(Math.PI * 2))
    .replace(/\bphi\b/gi, String((1 + Math.sqrt(5)) / 2))
    .replace(/\bln2\b/gi, String(Math.LN2))
    .replace(/\bln10\b/gi, String(Math.LN10))
    .replace(/\bsqrt2\b/gi, String(Math.SQRT2))
    .replace(/\bsqrt3\b/gi, String(Math.sqrt(3)))
    .replace(/\bpi\b/gi, String(Math.PI))
    .replace(/\be\b/gi, String(Math.E));

// Numeric separators: "1_234.56" / "1,234.56"
export const normalizeNumberSeparators = (input: string): string =>
  input.replace(/(\d)[_,](?=\d)/g, "$1").replace(/(\d),(?=\d{3}\b)/g, "$1");

// "clamp(a,b,c)" sugar → min(max(a,b),c)
export const applyClampSugar = (input: string): string =>
  input.replace(
    /\bclamp\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\)/gi,
    (_m, a, b, c) => `(min(max((${a}),(${b})),(${c})))`
  );

// sin/cos/tan with deg: sin(30 deg) -> sin(30 * PI/180)
export const applyTrigDegrees = (input: string): string => {
  const K = (Math.PI / 180).toString();
  return input.replace(
    /\b(sin|cos|tan)\s*\(([^)]*)\)/gi,
    (_m, fn: string, inner: string) => {
      const replaced = inner
        .replace(
          /(\d+(?:\.\d+)?)\s*deg\b/gi,
          (_mm: string, num: string) => `((${num})*${K})`
        )
        .replace(/\brad\b/gi, "");
      return `${fn}(${replaced})`;
    }
  );
};

// Preserve whitelisted functions, strip other identifiers, restore later.
const protectAllowedFnsAndSanitize = (s: string): string => {
  const placeholders: string[] = [];
  ALLOWED_FUNS.forEach((fn, idx) => {
    s = s.replace(new RegExp(`\\b${fn}\\b`, "g"), (m) => {
      const key = `__FN${idx}__`;
      placeholders[idx] = m;
      return key;
    });
  });
  s = s.replace(/[A-Za-z_]+/g, " ");
  ALLOWED_FUNS.forEach((_fn, idx) => {
    const key = new RegExp(`__FN${idx}__`, "g");
    s = s.replace(key, placeholders[idx] ?? "");
  });
  return s;
};

// Final sanitization that retains whitelisted functions and commas
export const sanitizeForMathWithFns = (input: string): string => {
  let s = protectAllowedFnsAndSanitize(input);
  s = s.replace(/[^0-9+\-*/.,() ]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
};

// Implicit multiplication near parentheses
export const ensureImplicitAroundParens = (s: string): string =>
  s
    .replace(/\)\s*\(/g, ")*(")
    .replace(/(\d)\s*\(/g, "$1*(")
    .replace(/\)\s*(\d)/g, ")*$1");
