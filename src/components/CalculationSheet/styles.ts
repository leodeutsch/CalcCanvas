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
      paddingVertical: theme.spacing.lg + theme.spacing.sm,
      maxHeight: 360,
      overflow: "hidden",
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
      display: "flex",
      flexDirection: "row",
      width: "48%",
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
      color: "#FFFFFF",
      fontWeight: "700",
    },
  });
