import { StyleSheet } from "react-native";

import type { Theme } from "../../styles/theme";

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "space-between",
      backgroundColor: theme.colors.background,
    },
    header: {
      marginBottom: theme.spacing.sm,
    },
    footer: {
      marginTop: theme.spacing.md,
    },
  });
