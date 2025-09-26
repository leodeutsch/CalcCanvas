// Best-effort to get the device locale across Expo and vanilla RN.
// Caches the result to avoid repeated requires.

let cachedLocale: string | null = null;

export const getDefaultLocale = (): string => {
  if (cachedLocale) return cachedLocale;

  // Try react-native-localize
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RNLocalize = require("react-native-localize");
    const locales = RNLocalize?.getLocales?.();
    const tag = locales?.[0]?.languageTag;
    if (tag) {
      cachedLocale = tag;
      return cachedLocale!;
    }
  } catch {}

  // Try expo-localization
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExpoLocalization = require("expo-localization");
    const tag = ExpoLocalization?.locale || ExpoLocalization?.locales?.[0];
    if (tag) {
      cachedLocale = tag;
      return cachedLocale!;
    }
  } catch {}

  // Fallback
  cachedLocale = "en-US";
  return cachedLocale;
};
