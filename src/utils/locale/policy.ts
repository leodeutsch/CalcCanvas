export type CurrencySymbolPosition = "before" | "after";
export type PercentSpace = "tight" | "spaced";
export type SystemUnit = "metric" | "imperial" | "auto";

export type LocalePolicy = {
  localeTag: string; // ex: "pt-BR" | "en-US"
  currencySymbolPosition: CurrencySymbolPosition; // só p/ UI (chips)
  percentSpace: PercentSpace; // "10%" vs "10 %"
  unitSystem: SystemUnit; // “auto” usa device/locale
};

const DEFAULT_POLICY: LocalePolicy = {
  localeTag: "en-US",
  currencySymbolPosition: "after",
  percentSpace: "tight",
  unitSystem: "auto",
};

// Registro por sheet (memória volátil; persista no storage do app se quiser)
const SHEET_POLICIES = new Map<string, LocalePolicy>();

export const setSheetLocalePolicy = (
  sheetId: string,
  policy: Partial<LocalePolicy>
) => {
  const cur = SHEET_POLICIES.get(sheetId) ?? DEFAULT_POLICY;
  SHEET_POLICIES.set(sheetId, { ...cur, ...policy });
};

export const getSheetLocalePolicy = (sheetId?: string): LocalePolicy | null => {
  if (!sheetId) return null;
  return SHEET_POLICIES.get(sheetId) ?? null;
};

// Resolve prioridade: (caller.locale?) > (sheet policy?) > device default
import { getDefaultLocale } from ".";
export const getLocaleForEval = (opts?: {
  locale?: string;
  sheetId?: string;
}): { localeTag: string; policy: LocalePolicy } => {
  const device = getDefaultLocale();
  const sheet = opts?.sheetId ? getSheetLocalePolicy(opts.sheetId) : null;

  const chosenTag = opts?.locale ?? sheet?.localeTag ?? device;
  const policy: LocalePolicy = {
    ...DEFAULT_POLICY,
    ...(sheet ?? {}),
    localeTag: chosenTag,
  };
  // Heurística: pt-* → símbolo depois, espaço em %, en-* → símbolo depois p/ códigos (chips), % sem espaço
  if (!opts?.locale && !sheet?.currencySymbolPosition) {
    if (/^pt(-|_)/i.test(chosenTag)) policy.currencySymbolPosition = "after";
  }
  if (!opts?.locale && !sheet?.percentSpace) {
    policy.percentSpace = /^fr|^pt|^es/i.test(chosenTag) ? "spaced" : "tight";
  }
  return { localeTag: policy.localeTag, policy };
};
