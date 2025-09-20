import React, { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { StarAward02Icon, StarIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import type { Theme } from "../../styles/theme";
import { Wordmark } from "../Wordmark";
import { createStyles } from "./styles";

interface HeaderProps {
  theme: Theme;
  isPremium: boolean;
  onPressPremium: () => void;
  onLongPressPremiumReset?: () => void; // Added
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  isPremium,
  onPressPremium,
  onLongPressPremiumReset,
}) => {
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View>
        <Wordmark
          theme={theme}
          height={64}
          tracking={4}
          gapAdjust={-56}
          textColor={theme.colorsFlat.primary}
          accentColor={theme.colorsFlat.accent}
        />
      </View>
      {!isPremium ? (
        <TouchableOpacity style={styles.premiumButton} onPress={onPressPremium}>
          <HugeiconsIcon
            icon={StarIcon}
            color={"#FFFFFF"}
            size={16}
            strokeWidth={2.2}
          />
          <Text style={styles.premiumText}>Upgrade</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onLongPress={onLongPressPremiumReset}
          delayLongPress={5000}
          accessibilityLabel="Hold to reset to free"
        >
          <HugeiconsIcon
            icon={StarAward02Icon}
            color={theme.colors.primary}
            size={24}
            strokeWidth={2}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};
