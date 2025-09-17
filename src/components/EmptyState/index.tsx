import React, { useMemo } from "react";
import { Text, View } from "react-native";

import type { Theme } from "../../styles/theme";
import { createStyles } from "./styles";

interface EmptyStateProps {
  theme: Theme;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ theme }) => {
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Create a sheet to start calculating.</Text>
    </View>
  );
};
