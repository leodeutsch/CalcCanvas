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
      paddingVertical: Platform.OS === "ios" ? 8 : 6,
    },
    resultScroll: {
      flex: 1,
      marginTop: theme.spacing.md,
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
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      marginRight: 8,
      marginBottom: 8,
    },
    chipText: {
      fontSize: 14,
      fontWeight: "600",
    },
    errorText: {
      fontSize: 14,
      fontStyle: "italic",
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
      borderRadius: theme.radii.md,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
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
  });
