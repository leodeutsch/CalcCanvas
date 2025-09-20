import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import React, { useEffect, useMemo, useState } from "react";
import { Appearance, Platform, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import {
  MD3DarkTheme,
  MD3LightTheme,
  Provider as PaperProvider,
  configureFonts,
} from "react-native-paper";

import { MainScreen } from "./src/screens/MainScreen";
import { createTheme } from "./src/styles/theme";

export const App: React.FC = () => {
  const [colorScheme, setColorScheme] = useState(
    Appearance.getColorScheme() ?? "light"
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme) setColorScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const isDark = colorScheme === "dark";
  const theme = useMemo(() => createTheme(isDark), [isDark]);

  const paperFonts = configureFonts({
    config: {
      fontFamily: Platform.OS === "ios" ? "SF Pro Text" : "Roboto",
    },
  });

  const paperTheme = useMemo(() => {
    const base = isDark ? MD3DarkTheme : MD3LightTheme;
    const c = theme.colorsFlat; // sempre strings
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: c.primary,
        background: c.background,
        surface: c.surface,
        surfaceVariant: c.cardBackground,
        outline: c.border,
        onSurface: c.text,
        onSurfaceVariant: c.secondaryText,
        error: c.error,
        secondary: c.secondaryText,
        accent: c.accent,
      },
      fonts: paperFonts,
    };
  }, [isDark, theme.colorsFlat, paperFonts]);

  const statusBarBackgroundColor = useMemo(() => {
    if (Platform.OS !== "android") return undefined;
    return isDark ? "#141218" : "#fef7ff";
  }, [isDark]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.colors.background }}
        >
          <PaperProvider theme={paperTheme}>
            <BottomSheetModalProvider>
              <StatusBar
                barStyle={isDark ? "light-content" : "dark-content"}
                backgroundColor={statusBarBackgroundColor}
              />
              <MainScreen theme={theme} />
            </BottomSheetModalProvider>
          </PaperProvider>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};
