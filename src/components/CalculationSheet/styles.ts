import { Platform, StyleSheet } from "react-native";

import type { Theme } from "../../styles/theme";

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      paddingTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xl + theme.spacing.sm,
    },
    cardWrapper: {
      marginBottom: theme.spacing.xl + theme.spacing.sm,
      borderRadius: theme.radii.lg,
      ...(theme.shadows.high ?? {}),
    },
    card: {
      paddingHorizontal: theme.spacing.xl + theme.spacing.sm,
      paddingVertical: theme.spacing.md + theme.spacing.xs,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.cardBackground,
    },
    input: {
      fontSize: 16,
      color: theme.colors.secondaryText,
      marginBottom: theme.spacing.md + theme.spacing.xs,
      fontFamily: Platform.OS === "ios" ? "SF Pro Text" : "Roboto",
    },
    resultContainer: {
      marginBottom: theme.spacing.md,
      flexDirection: "row",
      alignItems: "flex-end",
    },
    resultPrimary: {
      fontSize: 36,
      fontWeight: "700",
      color: theme.colors.success,
    },
    resultSecondary: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.secondaryText,
      marginLeft: theme.spacing.sm,
    },
    conversionChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: theme.spacing.xs,
    },
    conversionChip: {
      paddingVertical: theme.spacing.xs + 2,
      paddingHorizontal: theme.spacing.md + theme.spacing.xs,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.chipBackground,
      marginRight: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    conversionText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.secondaryText,
    },
    errorText: {
      marginTop: theme.spacing.sm,
      fontSize: 14,
      color: theme.colors.error,
      fontStyle: "italic",
    },
    addLineButton: {
      display: "flex",
      flexDirection: "row",
      width: "48%",
      marginTop: theme.spacing.sm,
      marginHorizontal: "auto",
      paddingVertical: theme.spacing.lg,
      borderRadius: theme.radii.xl,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      ...(theme.shadows.medium ?? {}),
    },
    addLineText: {
      fontSize: 16,
      color: theme.colors.primary,
      fontWeight: "600",
      marginLeft: theme.spacing.sm,
    },
  });
