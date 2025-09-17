import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Text, TouchableOpacity, View } from "react-native";
import type { Theme } from "../../styles/theme";

export type PopupAction = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "destructive";
};

type Props = {
  theme: Theme;
  visible: boolean;
  title: string;
  message: string;
  actions: PopupAction[];
};

export const ThemedPopup: React.FC<Props> = ({
  theme,
  visible,
  title,
  message,
  actions,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : 12,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, visible]);

  const overlayStyle = useMemo(
    () => ({
      position: "absolute" as const,
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.28)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: 24,
    }),
    []
  );

  const cardStyle = useMemo(
    () => ({
      width: "100%" as const,
      maxWidth: 420,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.xl,
      ...(theme.shadows.medium ?? {}),
    }),
    [theme]
  );

  const titleStyle = useMemo(
    () => ({
      fontSize: 18,
      fontWeight: "700" as const,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    }),
    [theme]
  );

  const messageStyle = useMemo(
    () => ({
      fontSize: 14,
      color: theme.colors.secondaryText,
      marginBottom: theme.spacing.lg,
    }),
    [theme]
  );

  const actionsRow = useMemo(
    () => ({
      flexDirection: "row" as const,
      justifyContent: "flex-end" as const,
    }),
    []
  );

  const buttonBase = useMemo(
    () => ({
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.md,
      marginLeft: theme.spacing.sm,
      minWidth: 96,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    }),
    [theme]
  );

  const getButtonStyle = (variant: PopupAction["variant"]) => {
    switch (variant) {
      case "destructive":
        return {
          ...buttonBase,
          backgroundColor: theme.colors.error,
        };
      case "primary":
        return {
          ...buttonBase,
          backgroundColor: theme.colors.primary,
        };
      default:
        return {
          ...buttonBase,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        };
    }
  };

  const getButtonTextStyle = (variant: PopupAction["variant"]) => {
    switch (variant) {
      case "destructive":
      case "primary":
        return { color: "#FFFFFF", fontWeight: "700" as const, fontSize: 14 };
      default:
        return {
          color: theme.colors.text,
          fontWeight: "600" as const,
          fontSize: 14,
        };
    }
  };

  if (!visible) {
    // Keep it mounted for smooth fade-out; pointerEvents none when hidden
  }

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[overlayStyle, { opacity }]}
    >
      <Animated.View
        style={[
          cardStyle,
          {
            transform: [{ translateY }],
          },
        ]}
      >
        <Text style={titleStyle}>{title}</Text>
        <Text style={messageStyle}>{message}</Text>

        <View style={actionsRow}>
          {actions.map((a) => (
            <TouchableOpacity
              key={a.label}
              onPress={a.onPress}
              activeOpacity={0.85}
              style={getButtonStyle(a.variant)}
            >
              <Text style={getButtonTextStyle(a.variant)}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
};
