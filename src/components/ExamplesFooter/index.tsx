import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
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
import type { Theme } from "../../styles/theme";
import { createStyles } from "./styles";

interface ExamplesFooterProps {
  theme: Theme;
  examples: string[];
  hidden?: boolean; // external visibility (e.g., editor open)
}

const STORAGE_KEY = "examples_footer_collapsed";

export const ExamplesFooter: React.FC<ExamplesFooterProps> = ({
  theme,
  examples,
  hidden = false,
}) => {
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [isReady, setIsReady] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const animation = useRef(new Animated.Value(1)).current;

  // initial load of collapsed state
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // drive animation by hidden + isCollapsed without changing persisted state
  useEffect(() => {
    if (!isReady) return;
    const target = hidden ? 0 : isCollapsed ? 0 : 1;
    Animated.timing(animation, {
      toValue: target,
      duration: 220,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [hidden, isCollapsed, isReady, animation]);

  const animateTo = useCallback(
    (toValue: number, onComplete?: () => void) => {
      Animated.timing(animation, {
        toValue,
        duration: 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) onComplete?.();
      });
    },
    [animation]
  );

  const handleCollapse = useCallback(() => {
    // keep state collapsed regardless of hidden; animation will be handled by effect
    setIsCollapsed(true);
    AsyncStorage.setItem(STORAGE_KEY, "true").catch((e) =>
      console.warn("Failed to persist footer state", e)
    );
    // if not hidden, animate immediately for snappy feedback
    if (!hidden) animateTo(0);
  }, [animateTo, hidden]);

  const handleExpand = useCallback(() => {
    setIsCollapsed(false);
    AsyncStorage.setItem(STORAGE_KEY, "false").catch((e) =>
      console.warn("Failed to persist footer state", e)
    );
    if (!hidden) animateTo(1);
  }, [animateTo, hidden]);

  const handleContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;
      if (height > contentHeight) setContentHeight(height);
    },
    [contentHeight]
  );

  const animatedStyle = useMemo(() => {
    if (!contentHeight) {
      return { opacity: animation };
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

  if (!isReady) return null;

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[styles.animatedContainer, animatedStyle]}
        // disable touch both when hidden and when collapsed
        pointerEvents={hidden || isCollapsed ? "none" : "auto"}
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

      {/* show FAB only when collapsed AND not hidden */}
      {isCollapsed && !hidden ? (
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
