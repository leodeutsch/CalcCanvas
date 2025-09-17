import { ColorValue, Platform, PlatformColor } from "react-native";

export interface ThemeColors {
  background: ColorValue;
  cardBackground: ColorValue;
  surface: ColorValue;
  primary: ColorValue;
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

export interface Theme {
  isDark: boolean;
  platform: typeof Platform.OS;
  colors: ThemeColors;
  shadows: ThemeShadows;
  spacing: ThemeSpacing;
  radii: ThemeRadii;
}

const IOS_LIGHT_COLORS: ThemeColors = {
  background: "#e0edff",
  cardBackground: "#fdfdff",
  surface: "#ffffff",
  primary: "#2563eb",
  text: "#0f172a",
  secondaryText: "#475569",
  border: "#cbd5f5",
  success: "#16a34a",
  error: "#dc2626",
  chipBackground: "rgba(37, 99, 235, 0.12)",
};

const IOS_DARK_COLORS: ThemeColors = {
  background: "#0f172a",
  cardBackground: "#1e293b",
  surface: "#1b2536",
  primary: "#38bdf8",
  text: "#e2e8f0",
  secondaryText: "#94a3b8",
  border: "#1e293b",
  success: "#22d3ee",
  error: "#f87171",
  chipBackground: "rgba(148, 163, 184, 0.2)",
};

const ANDROID_LIGHT_COLORS: ThemeColors = {
  background: "#fef7ff",
  cardBackground: "#fef7ff",
  surface: "#f8f2ff",
  primary: "#6750a4",
  text: "#1c1b1f",
  secondaryText: "#4f4d55",
  border: "#d7c6f6",
  success: "#006d3d",
  error: "#b3261e",
  chipBackground: "rgba(103, 80, 164, 0.14)",
};

const ANDROID_DARK_COLORS: ThemeColors = {
  background: "#141218",
  cardBackground: "#1d1b20",
  surface: "#1f1829",
  primary: "#d0bcff",
  text: "#e6e1e5",
  secondaryText: "#cac4d0",
  border: "#4a4458",
  success: "#4ade80",
  error: "#f2b8b5",
  chipBackground: "rgba(208, 188, 255, 0.16)",
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
  } catch (error) {
    return isDark ? fallbackDark : fallbackLight;
  }
};

const resolveThemeColors = (isDark: boolean): ThemeColors => {
  if (Platform.OS === "ios") {
    return isDark ? IOS_DARK_COLORS : IOS_LIGHT_COLORS;
  }

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

const createShadows = (colors: ThemeColors): ThemeShadows => {
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

  return {
    low: elevation(4),
    medium: elevation(8),
    high: elevation(12),
  };
};

const SPACING: ThemeSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

const RADII: ThemeRadii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
};

export const createTheme = (isDark: boolean): Theme => {
  const colors = resolveThemeColors(isDark);

  return {
    isDark,
    platform: Platform.OS,
    colors,
    shadows: createShadows(colors),
    spacing: SPACING,
    radii: RADII,
  };
};
