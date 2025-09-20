import { ColorValue, Platform, PlatformColor } from "react-native";

export interface ThemeColors {
  background: ColorValue;
  cardBackground: ColorValue;
  surface: ColorValue;
  primary: ColorValue;
  accent: ColorValue;
  text: ColorValue;
  secondaryText: ColorValue;
  border: ColorValue;
  success: ColorValue;
  error: ColorValue;
  chipBackground: ColorValue;
}

export interface ThemeShadow {
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
}
export interface ThemeShadows {
  low: ThemeShadow;
  medium: ThemeShadow;
  high: ThemeShadow;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}
export interface ThemeRadii {
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface ThemeColorsFlat {
  background: string;
  cardBackground: string;
  surface: string;
  primary: string;
  accent: string;
  text: string;
  secondaryText: string;
  border: string;
  success: string;
  error: string;
  chipBackground: string;
}

export interface Theme {
  isDark: boolean;
  platform: typeof Platform.OS;
  colors: ThemeColors;
  colorsFlat: ThemeColorsFlat;
  shadows: ThemeShadows;
  spacing: ThemeSpacing;
  radii: ThemeRadii;
}

/* ===================== Blueprint Tech – LIGHT (iOS) ===================== */
const IOS_LIGHT_COLORS: ThemeColors = {
  background: "#EAF2FF",
  cardBackground: "#F7FAFF",
  surface: "#FFFFFF",
  primary: "#2563EB",
  accent: "#22D3EE",
  text: "#0F172A",
  secondaryText: "#475569",
  border: "#CBD5F1",
  success: "#10B981",
  error: "#EF4444",
  chipBackground: "rgba(37, 99, 235, 0.12)", // primary @ 12%
};

/* ===================== Blueprint Tech – DARK (iOS) ===================== */
const IOS_DARK_COLORS: ThemeColors = {
  background: "#0F172A",
  cardBackground: "#1E293B",
  surface: "#1B2536",
  primary: "#60A5FA",
  accent: "#67E8F9",
  text: "#E2E8F0",
  secondaryText: "#94A3B8",
  border: "#263446",
  success: "#34D399",
  error: "#F87171",
  chipBackground: "rgba(96, 165, 250, 0.16)",
};

/* ===================== Blueprint Tech – LIGHT (Android fallback) ===================== */
const ANDROID_LIGHT_COLORS: ThemeColors = {
  background: "#EAF2FF",
  cardBackground: "#F7FAFF",
  surface: "#FFFFFF",
  primary: "#2563EB",
  accent: "#22D3EE",
  text: "#0F172A",
  secondaryText: "#475569",
  border: "#CBD5F1",
  success: "#10B981",
  error: "#EF4444",
  chipBackground: "rgba(37, 99, 235, 0.12)",
};

/* ===================== Blueprint Tech – DARK (Android fallback) ===================== */
const ANDROID_DARK_COLORS: ThemeColors = {
  background: "#0F172A",
  cardBackground: "#1E293B",
  surface: "#1F2A3A",
  primary: "#60A5FA",
  accent: "#67E8F9",
  text: "#E2E8F0",
  secondaryText: "#94A3B8",
  border: "#263446",
  success: "#34D399",
  error: "#F87171",
  chipBackground: "rgba(96, 165, 250, 0.16)",
};

const resolveAndroidDynamicColor = (
  lightAttr: string,
  darkAttr: string,
  fallbackLight: ColorValue,
  fallbackDark: ColorValue,
  isDark: boolean
): ColorValue => {
  try {
    return PlatformColor(isDark ? darkAttr : lightAttr);
  } catch {
    return isDark ? fallbackDark : fallbackLight;
  }
};

const resolveThemeColors = (isDark: boolean): ThemeColors => {
  if (Platform.OS === "ios") return isDark ? IOS_DARK_COLORS : IOS_LIGHT_COLORS;

  return {
    background: resolveAndroidDynamicColor(
      "@android:color/system_neutral1_50",
      "@android:color/system_neutral1_900",
      ANDROID_LIGHT_COLORS.background,
      ANDROID_DARK_COLORS.background,
      isDark
    ),
    cardBackground: resolveAndroidDynamicColor(
      "@android:color/system_neutral2_50",
      "@android:color/system_neutral2_900",
      ANDROID_LIGHT_COLORS.cardBackground,
      ANDROID_DARK_COLORS.cardBackground,
      isDark
    ),
    surface: resolveAndroidDynamicColor(
      "@android:color/system_neutral1_100",
      "@android:color/system_neutral1_800",
      ANDROID_LIGHT_COLORS.surface,
      ANDROID_DARK_COLORS.surface,
      isDark
    ),
    primary: resolveAndroidDynamicColor(
      "@android:color/system_accent1_400",
      "@android:color/system_accent1_200",
      ANDROID_LIGHT_COLORS.primary,
      ANDROID_DARK_COLORS.primary,
      isDark
    ),
    accent: isDark ? ANDROID_DARK_COLORS.accent : ANDROID_LIGHT_COLORS.accent,
    text: resolveAndroidDynamicColor(
      "@android:color/system_neutral1_900",
      "@android:color/system_neutral1_50",
      ANDROID_LIGHT_COLORS.text,
      ANDROID_DARK_COLORS.text,
      isDark
    ),
    secondaryText: resolveAndroidDynamicColor(
      "@android:color/system_neutral2_700",
      "@android:color/system_neutral2_200",
      ANDROID_LIGHT_COLORS.secondaryText,
      ANDROID_DARK_COLORS.secondaryText,
      isDark
    ),
    border: resolveAndroidDynamicColor(
      "@android:color/system_neutral2_200",
      "@android:color/system_neutral2_700",
      ANDROID_LIGHT_COLORS.border,
      ANDROID_DARK_COLORS.border,
      isDark
    ),
    success: resolveAndroidDynamicColor(
      "@android:color/system_accent2_400",
      "@android:color/system_accent2_200",
      ANDROID_LIGHT_COLORS.success,
      ANDROID_DARK_COLORS.success,
      isDark
    ),
    error: resolveAndroidDynamicColor(
      "@android:color/system_accent3_400",
      "@android:color/system_accent3_200",
      ANDROID_LIGHT_COLORS.error,
      ANDROID_DARK_COLORS.error,
      isDark
    ),
    chipBackground: resolveAndroidDynamicColor(
      "@android:color/system_neutral1_100",
      "@android:color/system_neutral1_700",
      ANDROID_LIGHT_COLORS.chipBackground,
      ANDROID_DARK_COLORS.chipBackground,
      isDark
    ),
  };
};

const createShadows = (_colors: ThemeColors): ThemeShadows => {
  if (Platform.OS === "ios") {
    return {
      low: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      medium: {
        shadowColor: "#1f2937",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.16,
        shadowRadius: 20,
      },
      high: {
        shadowColor: "#1f2937",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.28,
        shadowRadius: 28,
      },
    };
  }
  const elevation = (value: number): ThemeShadow => ({ elevation: value });
  return { low: elevation(4), medium: elevation(8), high: elevation(12) };
};

const SPACING: ThemeSpacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
const RADII: ThemeRadii = { sm: 12, md: 18, lg: 24, xl: 32 };

const toFlat = (c: ThemeColors): ThemeColorsFlat => ({
  background: String(c.background),
  cardBackground: String(c.cardBackground),
  surface: String(c.surface),
  primary: String(c.primary),
  accent: String(c.accent),
  text: String(c.text),
  secondaryText: String(c.secondaryText),
  border: String(c.border),
  success: String(c.success),
  error: String(c.error),
  chipBackground: String(c.chipBackground),
});

export const createTheme = (isDark: boolean): Theme => {
  const colors = resolveThemeColors(isDark);

  const colorsFlat: ThemeColorsFlat =
    Platform.OS === "ios"
      ? toFlat(isDark ? IOS_DARK_COLORS : IOS_LIGHT_COLORS)
      : toFlat(isDark ? ANDROID_DARK_COLORS : ANDROID_LIGHT_COLORS);

  return {
    isDark,
    platform: Platform.OS,
    colors,
    colorsFlat,
    shadows: createShadows(colors),
    spacing: SPACING,
    radii: RADII,
  };
};
