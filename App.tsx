import React, { useEffect, useMemo, useState } from "react";
import { Appearance, Platform, StatusBar } from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import { MainScreen } from "./src/screens/MainScreen";
import { createTheme } from "./src/styles/theme";

export const App: React.FC = () => {
  const [colorScheme, setColorScheme] = useState(
    Appearance.getColorScheme() ?? "light"
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme) {
        setColorScheme(colorScheme);
      }
    });

    return () => subscription.remove();
  }, []);

  const isDark = colorScheme === "dark";

  const theme = useMemo(() => createTheme(isDark), [isDark]);

  const statusBarBackgroundColor = useMemo(() => {
    if (Platform.OS !== "android") return undefined;

    return isDark ? "#141218" : "#fef7ff";
  }, [isDark]);

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
        }}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={statusBarBackgroundColor}
        />
        <MainScreen theme={theme} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
};
