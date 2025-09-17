import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";

import type { Theme } from "../../styles/theme";
import { createStyles } from "./styles";

interface ExamplesFooterProps {
  theme: Theme;
  examples: string[];
}

const STORAGE_KEY = "examples_footer_collapsed";

export const ExamplesFooter: React.FC<ExamplesFooterProps> = ({
  theme,
  examples,
}) => {
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [isReady, setIsReady] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const animation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loadState = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const collapsed = stored === "true";
        setIsCollapsed(collapsed);
        animation.setValue(collapsed ? 0 : 1);
      } catch (error) {
        console.warn("Failed to load examples footer state", error);
      } finally {
        setIsReady(true);
      }
    };

    loadState();
  }, [animation]);

  const animateTo = useCallback(
    (toValue: number, onComplete?: () => void) => {
      Animated.timing(animation, {
        toValue,
        duration: 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          onComplete?.();
        }
      });
    },
    [animation]
  );

  const handleCollapse = useCallback(() => {
    animateTo(0, () => {
      setIsCollapsed(true);
      AsyncStorage.setItem(STORAGE_KEY, "true").catch((error) =>
        console.warn("Failed to persist footer state", error)
      );
    });
  }, [animateTo]);

  const handleExpand = useCallback(() => {
    setIsCollapsed(false);
    AsyncStorage.setItem(STORAGE_KEY, "false").catch((error) =>
      console.warn("Failed to persist footer state", error)
    );
    requestAnimationFrame(() => {
      animateTo(1);
    });
  }, [animateTo]);

  const handleContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;
      if (height > contentHeight) {
        setContentHeight(height);
      }
    },
    [contentHeight]
  );

  const animatedStyle = useMemo(() => {
    if (!contentHeight) {
      return {
        opacity: animation,
      };
    }

    return {
      opacity: animation,
      height: animation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, contentHeight],
        extrapolate: "clamp",
      }),
      transform: [
        {
          translateY: animation.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0],
          }),
        },
      ],
    };
  }, [animation, contentHeight]);

  if (!isReady) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[styles.animatedContainer, animatedStyle]}
        pointerEvents={isCollapsed ? "none" : "auto"}
      >
        <View onLayout={handleContentLayout} style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Try these examples:</Text>
            <TouchableOpacity
              onPress={handleCollapse}
              style={styles.toggleButton}
            >
              <HugeiconsIcon
                icon={ViewIcon}
                color={theme.colors.primary}
                strokeWidth={2}
              />
            </TouchableOpacity>
          </View>

          {examples.map((example) => (
            <Text key={example} style={styles.example}>
              • {example}
            </Text>
          ))}
        </View>
      </Animated.View>

      {isCollapsed ? (
        <TouchableOpacity style={styles.fab} onPress={handleExpand}>
          <HugeiconsIcon
            icon={ViewOffIcon}
            color={theme.colors.primary}
            size={22}
            strokeWidth={2}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
