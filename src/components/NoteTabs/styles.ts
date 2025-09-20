import { StyleSheet } from "react-native";
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
    pillWrapper: {
      marginRight: theme.spacing.sm,
    },
    pill: {
      borderRadius: theme.radii.xl,
      // minWidth: 80,
      justifyContent: "center",
      height: 40,
      paddingHorizontal: theme.spacing.sm,
    },
    pillText: {
      fontSize: 16,
      fontWeight: "600",
    },
    addBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignSelf: "center",
      marginLeft: theme.spacing.sm,
    },
  });
