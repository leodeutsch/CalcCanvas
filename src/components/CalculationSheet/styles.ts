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
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      maxHeight: 360,
      overflow: "hidden",
      borderRadius: theme.spacing.sm + theme.spacing.sm,
      backgroundColor: theme.colors.cardBackground,
    },
    input: {
      fontSize: 16,
      color: theme.colors.secondaryText,
      marginBottom: theme.spacing.md + theme.spacing.xs,
      fontFamily: Platform.OS === "ios" ? "SF Pro Text" : "Roboto",
    },
    resultContainer: {
      marginBottom: theme.spacing.sm,
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
      marginTop: 0,
      maxHeight: 80,
      overflow: "hidden",
    },
    conversionChip: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radii.sm,
      backgroundColor: theme.colors.chipBackground,
      marginRight: theme.spacing.xs,
      marginBottom: theme.spacing.xs,
    },
    chipPaper: {
      marginRight: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.chipBackground,
    },
    chipTextPaper: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.secondaryText,
    },

    conversionText: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.colors.secondaryText,
    },
    errorText: {
      marginTop: theme.spacing.sm,
      fontSize: 14,
      color: theme.colors.error,
      fontStyle: "italic",
    },
    addLineButton: {
      width: "56%",
      marginHorizontal: "auto",
      borderRadius: theme.radii.xl,
      backgroundColor: theme.colors.surface,
    },
    addLineContent: {
      paddingVertical: theme.spacing.sm,
      width: "100%",
      borderRadius: theme.radii.xl,
    },
    addLineText: {
      fontSize: 16,
      color: theme.colors.primary,
      fontWeight: "600",
    },

    deleteBackdrop: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: theme.colors.error,
      borderRadius: theme.radii.lg,
      justifyContent: "center",
      alignItems: "flex-end",
      paddingRight: theme.spacing.xl + theme.spacing.sm,
    },
    deleteText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
  });
