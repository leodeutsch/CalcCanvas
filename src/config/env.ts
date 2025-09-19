import Constants from "expo-constants";

type Extra = Partial<{
  EXPO_PUBLIC_OPENEXCHANGE_API_KEY: string;
  EXPO_PUBLIC_EXCHANGERATE_API_KEY: string;
  EXPO_PUBLIC_COINGECKO_API_KEY: string;
}>;

function getExtra(): Extra {
  const fromExpo = (Constants?.expoConfig?.extra ?? {}) as Extra;
  // fallback para casos antigos — não deve ser necessário, mas ajuda
  // @ts-ignore
  const fromManifest = (Constants?.manifest?.extra ?? {}) as Extra;
  return { ...fromManifest, ...fromExpo };
}

const extra = getExtra();

export const ENV = {
  openExchangeApiKey: extra.EXPO_PUBLIC_OPENEXCHANGE_API_KEY || "",
  exchangeRateApiKey: extra.EXPO_PUBLIC_EXCHANGERATE_API_KEY || "",
  coinGeckoApiKey: extra.EXPO_PUBLIC_COINGECKO_API_KEY || "",
};
