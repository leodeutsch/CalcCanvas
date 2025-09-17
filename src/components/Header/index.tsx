import React, { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { StarIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import type { Theme } from "../../styles/theme";
import { createStyles } from "./styles";

interface HeaderProps {
  theme: Theme;
  isPremium: boolean;
  onPressPremium: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  isPremium,
  onPressPremium,
}) => {
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CalcCanvas</Text>
      <TouchableOpacity style={styles.premiumButton} onPress={onPressPremium}>
        <HugeiconsIcon
          icon={StarIcon}
          color={isPremium ? "gold" : "#FFFFFF"}
          size={16}
          strokeWidth={2.2}
        />
        <Text style={styles.premiumText}>
          {isPremium ? "Premium" : "Upgrade"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
