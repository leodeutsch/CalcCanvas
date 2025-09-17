import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Text, View } from "react-native";

import type { Theme } from "../../styles/theme";

type Props = {
  theme: Theme;
  message: string;
  visible: boolean;
};

export const PremiumPill: React.FC<Props> = ({ theme, message, visible }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 10,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [opacity, translateY, visible]);

  const containerStyle = useMemo(
    () => ({
      position: "absolute" as const,
      left: 0,
      right: 0,
      top: 24,
      alignItems: "center" as const,
      pointerEvents: "none" as const,
    }),
    []
  );

  const pillStyle = useMemo(
    () => ({
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      ...(theme.shadows.medium ?? {}),
    }),
    [theme]
  );

  const textStyle = useMemo(
    () => ({
      color: theme.colors.secondaryText,
      fontWeight: "600" as const,
      fontSize: 14,
    }),
    [theme]
  );

  return (
    <View style={containerStyle}>
      <Animated.View
        style={{
          opacity,
          transform: [{ translateY }],
        }}
      >
        <View style={pillStyle}>
          <Text style={textStyle}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
};
