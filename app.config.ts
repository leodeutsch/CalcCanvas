// app.config.ts
import { ConfigContext, ExpoConfig } from "@expo/config";
import "dotenv/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "CalcCanvas",
  slug: config.slug ?? "calc-canvas",
  userInterfaceStyle: config.userInterfaceStyle ?? "automatic",
  extra: {
    ...config.extra,
    // Somente chaves com EXPO_PUBLIC_ são embutidas no app (dev, preview, prod)
    EXPO_PUBLIC_OPENEXCHANGE_API_KEY:
      process.env.EXPO_PUBLIC_OPENEXCHANGE_API_KEY,
    EXPO_PUBLIC_EXCHANGERATE_API_KEY:
      process.env.EXPO_PUBLIC_EXCHANGERATE_API_KEY,
  },
});
