// Lightweight text → math transformations and safe helpers

import { getDefaultLocale } from "../locale";

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
  "sum",
  "mean",
  "median",
] as const;

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

// ✅ exportação named que o evaluator importa
export const sanitizeForMathWithFns = (input: string): string => {
  let s = protectAllowedFnsAndSanitize(input);
  // se quiser aceitar expoentes ^, deixe a linha abaixo com o ^
  s = s.replace(/[^0-9+\-*/.^,() ]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
};

const COMMA_DECIMAL_LOCALES =
  /^(af|ar|be|bg|ca|cs|da|de|el|es|eu|fa|fi|fr|gl|he|hi|hr|hu|id|it|kk|ko|lt|lv|ms|nb|nl|pl|pt|ro|ru|sk|sl|sr|sv|tr|uk|vi|zh)(-|_)?/i;

const manualFormat = (
  value: number,
  fractionDigits: number,
  useCommaDecimal: boolean
): string => {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const [intStrRaw, fracRaw = ""] = abs.toFixed(fractionDigits).split(".");
  const thousandSep = useCommaDecimal ? "." : ",";
  const decimalSep = useCommaDecimal ? "," : ".";

  // agrupa milhar
  const intStr = intStrRaw.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  return fractionDigits > 0
    ? `${sign}${intStr}${decimalSep}${fracRaw}`
    : `${sign}${intStr}`;
};

export const formatNumber = (
  value: number,
  fractionDigits = 2,
  locale?: string
): string => {
  if (!Number.isFinite(value)) return String(value);

  const loc = (locale ?? getDefaultLocale() ?? "en-US").replace("_", "-");
  const wantCommaDecimal = COMMA_DECIMAL_LOCALES.test(loc);

  // 1) Tenta Intl.NumberFormat
  try {
    const s = new Intl.NumberFormat(loc, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);

    // sanity check: se pedimos vírgula decimal e veio ponto, ou vice-versa,
    // cai para o manual
    const sample = Math.abs(value).toFixed(fractionDigits);
    const decimalCharInResult = s.replace(/[^.,]/g, "").slice(-1); // último separador
    const shouldBe = wantCommaDecimal ? "," : ".";
    if (
      sample.includes(".") &&
      decimalCharInResult &&
      decimalCharInResult !== shouldBe
    ) {
      // Intl existe mas não respeitou o locale → manual
      return manualFormat(value, fractionDigits, wantCommaDecimal);
    }

    return s;
  } catch {
    // ignore
  }

  // 2) Tenta toLocaleString
  try {
    const s = value.toLocaleString(
      loc as any,
      {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      } as any
    );
    // mesma verificação
    const decimalCharInResult = s.replace(/[^.,]/g, "").slice(-1);
    const shouldBe = wantCommaDecimal ? "," : ".";
    if (decimalCharInResult && decimalCharInResult !== shouldBe) {
      return manualFormat(value, fractionDigits, wantCommaDecimal);
    }
    return s;
  } catch {
    // ignore
  }

  // 3) Último recurso: manual
  return manualFormat(value, fractionDigits, wantCommaDecimal);
};
