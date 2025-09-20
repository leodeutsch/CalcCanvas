import { Platform, StyleSheet } from "react-native";
import { Theme } from "../../styles/theme";

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      zIndex: 5,
    },
    input: {
      fontSize: 16,
      minHeight: 44,
      paddingVertical: Platform.OS === "ios" ? 12 : 8,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.chipBackground,
      borderRadius: theme.radii.md,
    },
    resultScroll: {
      flex: 1,
      marginTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
    },
    resultRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginBottom: theme.spacing.sm,
    },
    resultPrimary: {
      fontSize: 36,
      fontWeight: "700",
    },
    resultSecondary: {
      fontSize: 18,
      fontWeight: "600",
      marginLeft: 8,
    },
    chipsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 6,
    },
    chip: {
      borderRadius: theme.radii.md,
      marginRight: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.chipBackground,
    },
    chipText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    errorText: {
      fontSize: 14,
      fontStyle: "italic",
      color: theme.colors.error,
    },
    doneButtonFloat: {
      position: "absolute",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      alignSelf: "flex-end",
    },
    doneButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.xl,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      ...(Platform.OS === "ios"
        ? {
            shadowColor: theme.shadows.medium.shadowColor,
            shadowOffset: theme.shadows.medium.shadowOffset,
            shadowOpacity: theme.shadows.medium.shadowOpacity,
            shadowRadius: theme.shadows.medium.shadowRadius,
          }
        : {
            elevation: 8,
          }),
    },
    doneText: {
      color: theme.colors.background,
      fontWeight: "600",
      fontSize: 16,
    },
    snackWrapper: {
      position: "absolute",
      top: 0,
      left: 72,
      right: 72,
      zIndex: 10,
    },
    snackStyle: {
      width: "64%",
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.lg,
    },
  });
