import { Platform, StyleSheet } from "react-native";

import type { Theme } from "../../styles/theme";

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingLeft: theme.spacing.sm,
      paddingRight: theme.spacing.xl,
      paddingVertical: theme.spacing.lg + theme.spacing.sm,
    },
    premiumButton: {
      position: "absolute",
      right: theme.spacing.lg,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.md,
      ...(Platform.OS === "ios" ? theme.shadows.low : theme.shadows.low),
    },
    premiumText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "600",
      marginLeft: theme.spacing.xs,
    },
  });
