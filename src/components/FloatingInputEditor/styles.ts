import { Platform, StyleSheet } from "react-native";

import type { Theme } from "../../styles/theme";

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      backgroundColor: "transparent",
    },
    backdrop: {
      flex: 1,
      backgroundColor: "transparent",
    },
    overlay: {
      flex: 1,
      backgroundColor: theme.isDark
        ? "rgba(0, 0, 0, 0.7)"
        : "rgba(0, 0, 0, 0.4)",
    },
    bottomSheet: {
      position: "absolute",
      bottom: Platform.OS === "ios" ? 0 : 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.cardBackground,
      paddingHorizontal: theme.spacing.xl + theme.spacing.sm,
      paddingVertical: theme.spacing.md + theme.spacing.xs,
      paddingBottom:
        Platform.OS === "ios"
          ? theme.spacing.xl
          : theme.spacing.md + theme.spacing.xs,
      borderTopLeftRadius: theme.radii.lg,
      borderTopRightRadius: theme.radii.lg,
      ...theme.shadows.high,
      // Add a border for better separation on iOS
      borderTopWidth: Platform.OS === "ios" ? 1 : 0,
      borderTopColor: theme.colors.border,
    },
    input: {
      fontSize: 16,
      color: theme.colors.text,
      fontFamily: Platform.OS === "ios" ? "SF Pro Text" : "Roboto",
      minHeight: 44,
      maxHeight: 120,
      paddingVertical: Platform.OS === "ios" ? 8 : 4,
    },
    doneButton: {
      marginTop: theme.spacing.md,
      paddingVertical: theme.spacing.sm + 2,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.md,
      alignItems: "center",
      minHeight: 44,
      justifyContent: "center",
    },
    doneButtonText: {
      color: "#FFFFFF",
      fontWeight: "600",
      fontSize: 16,
    },
  });
