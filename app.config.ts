import { ConfigContext, ExpoConfig } from "@expo/config";
import "dotenv/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "CalcCanvas",
  slug: config.slug ?? "calc-canvas",
  // If you had userInterfaceStyle set to "light", consider "automatic" so theming works:
  userInterfaceStyle: config.userInterfaceStyle ?? "automatic",
  extra: {
    ...config.extra,
    OPENEXCHANGE_API_KEY: process.env.OPENEXCHANGE_API_KEY,
    EXCHANGERATE_API_KEY: process.env.EXCHANGERATE_API_KEY,
  },
});
