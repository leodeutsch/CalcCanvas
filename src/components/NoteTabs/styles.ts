import { Platform, StyleSheet } from "react-native";

import type { Theme } from "../../styles/theme";

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      maxHeight: 64,
    },
    content: {
      paddingHorizontal: theme.spacing.lg,
      alignItems: "center",
    },
    tab: {
      paddingHorizontal: theme.spacing.md + theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      marginRight: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.xl,
      minWidth: 80,
      alignItems: "center",
      justifyContent: "center",
      ...(Platform.OS === "ios" ? theme.shadows.low : theme.shadows.low),
    },
    activeTab: {
      backgroundColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 16,
      color: theme.colors.secondaryText,
      fontWeight: "500",
    },
    activeTabText: {
      color: "#FFFFFF",
      fontWeight: "600",
    },
    addTab: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.surface,
      justifyContent: "center",
      alignItems: "center",
      ...(Platform.OS === "ios" ? theme.shadows.low : theme.shadows.low),
    },
    addTabText: {
      fontSize: 22,
      color: theme.colors.primary,
      fontWeight: "500",
    },
  });
