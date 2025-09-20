import { Platform, StyleSheet } from "react-native";

import type { Theme } from "../../styles/theme";

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      position: "relative",
      zIndex: 1,
    },
    animatedContainer: {
      overflow: "hidden",
      borderRadius: theme.radii.lg,
    },
    card: {
      padding: theme.spacing.lg + theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      ...(Platform.OS === "ios" ? theme.shadows.medium : theme.shadows.medium),
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    title: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    example: {
      fontSize: 14,
      color: theme.colors.secondaryText,
      marginBottom: theme.spacing.xs,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    toggleButton: {},
    fab: {
      position: "absolute",
      right: theme.spacing.xl,
      bottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      borderRadius: theme.radii.xl,
      alignItems: "center",
      justifyContent: "center",
      ...(Platform.OS === "ios" ? theme.shadows.medium : theme.shadows.medium),
    },
    fabIcon: {
      color: theme.colors.primary,
      alignSelf: "center",
    },
  });
