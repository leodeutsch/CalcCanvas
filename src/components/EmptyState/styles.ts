import { StyleSheet } from "react-native";

import type { Theme } from "../../styles/theme";

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xl + theme.spacing.sm,
    },
    text: {
      textAlign: "center",
      fontSize: 16,
      color: theme.colors.secondaryText,
    },
  });
