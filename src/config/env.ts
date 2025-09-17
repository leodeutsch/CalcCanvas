import Constants from "expo-constants";

type Extra = Record<string, string | undefined>;

const extra: Extra = Constants.expoConfig?.extra ?? {};

const fromExtra = (key: string) => extra[key] ?? extra[key.toLowerCase()];

const getEnv = (name: string, fallbackKey?: string) =>
  process.env[name] ?? (fallbackKey ? fromExtra(fallbackKey) : undefined) ?? "";

export const ENV = {
  openExchangeApiKey: getEnv(
    "EXPO_PUBLIC_OPENEXCHANGE_API_KEY",
    "OPENEXCHANGE_API_KEY"
  ),
  exchangeRateApiKey: getEnv(
    "EXPO_PUBLIC_EXCHANGERATE_API_KEY",
    "EXCHANGERATE_API_KEY"
  ),
  coinGeckoApiKey: getEnv("EXPO_PUBLIC_COINGECKO_API_KEY", "COINGECKO_API_KEY"),
};
