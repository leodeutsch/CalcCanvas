import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  KeyboardState,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useEvaluatedInput } from "../../hooks/useEvaluatedInput";
import { useMarketData } from "../../hooks/useMarketData";
import type { Theme } from "../../styles/theme";
import type { CalculationLine } from "../../types";
import { evaluateInput } from "../../utils/evaluator";
import { createStyles } from "./styles";

interface BottomSheetInputEditorProps {
  theme: Theme;
  line: CalculationLine;
  placeholderColor: string;
  onSave: (lineId: string, value: string) => void;
  onCancel: (lineId: string, valueSnapshot: string) => void;
  onOpenChange?: (open: boolean) => void;
}

export const BottomSheetInputEditor: React.FC<BottomSheetInputEditorProps> = ({
  theme,
  line,
  placeholderColor,
  onSave,
  onCancel,
  onOpenChange,
}) => {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const inputRef = useRef<TextInput>(null);

  const [value, setValue] = useState(line.input);
  const marketData = useMarketData();

  const debouncedValue = useDebouncedValue(value, 50);

  const evalFn = useCallback(
    (expr: string) => evaluateInput(expr, marketData),
    [marketData]
  );

  const evalResult = useEvaluatedInput(debouncedValue, evalFn);

  const snapPoints = useMemo(() => ["96%"], []);

  const btnAnim = useSharedValue(0);
  const doneAnimStyle = useAnimatedStyle(() => ({
    opacity: btnAnim.value,
    transform: [{ translateY: withTiming(0, { duration: 160 }) }],
  }));

  useEffect(() => {
    const t = setTimeout(() => {
      sheetRef.current?.expand();
      onOpenChange?.(true);
      inputRef.current?.focus();
      btnAnim.value = withTiming(1, { duration: 160 });
    }, 60);

    // perder foco quando teclado fecha
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => inputRef.current?.blur()
    );

    return () => {
      clearTimeout(t);
      hide.remove();
    };
  }, [onOpenChange, btnAnim]);

  const handleDone = () => {
    Keyboard.dismiss();
    onSave(line.id, value);
    sheetRef.current?.close();
  };

  const handleClose = () => {
    onCancel(line.id, value);
    onOpenChange?.(false);
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={theme.isDark ? 0.6 : 0.35}
        style={[props.style, { backgroundColor: "black" }]}
      />
    ),
    [theme.isDark]
  );

  const kbd = useAnimatedKeyboard();
  const footerLiftStyle = useAnimatedStyle(() => {
    const isOpen =
      kbd.state.value === KeyboardState.OPEN ||
      kbd.state.value === KeyboardState.OPENING;
    const h = kbd.height.value;
    const effective = isOpen && h > 50 ? h - 72 : 0;
    const lift =
      Platform.OS === "ios" ? effective : Math.max(0, effective - 32);
    return {
      transform: [{ translateY: withTiming(-lift, { duration: 120 }) }],
    };
  });

  const renderFooter = useCallback(
    (footerProps: any) => (
      <BottomSheetFooter {...footerProps} bottomInset={insets.bottom}>
        <Animated.View
          style={[
            {
              paddingHorizontal: 16,
              paddingBottom: 12 + Math.max(insets.bottom, 0),
              alignItems: "flex-end",
            },
            footerLiftStyle,
            doneAnimStyle,
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleDone}
            style={styles.doneButton}
            accessibilityLabel="Apply calculation and close"
          >
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </BottomSheetFooter>
    ),
    [
      doneAnimStyle,
      handleDone,
      insets.bottom,
      theme.colors.primary,
      theme.radii.md,
      theme.spacing.sm,
      theme.spacing.lg,
    ]
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={handleClose}
      enableDynamicSizing={false}
      enableHandlePanningGesture
      enableContentPanningGesture={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: theme.colors.cardBackground,
        borderTopLeftRadius: theme.radii.lg,
        borderTopRightRadius: theme.radii.lg,
      }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      keyboardBehavior={Platform.OS === "ios" ? "extend" : "interactive"}
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      footerComponent={renderFooter}
    >
      <BottomSheetView style={styles.container}>
        {/* input */}
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              fontFamily: Platform.OS === "ios" ? "SF Pro Text" : "Roboto",
            },
          ]}
          value={value}
          onChangeText={setValue}
          placeholder="Type calculation..."
          placeholderTextColor={placeholderColor}
          multiline
          submitBehavior="blurAndSubmit"
          enablesReturnKeyAutomatically
          scrollEnabled={false}
          autoFocus={false}
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="default"
          returnKeyType="done"
          onSubmitEditing={handleDone}
        />

        {/* live result list with scroll */}
        <ScrollView
          style={styles.resultScroll}
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="always"
        >
          {evalResult?.error ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {evalResult.error}
            </Text>
          ) : evalResult?.result ? (
            <View>
              <View style={styles.resultRow}>
                <Text
                  style={[
                    styles.resultPrimary,
                    { color: theme.colors.success },
                  ]}
                >
                  {evalResult.result.formatted}
                </Text>
                {evalResult.result.unit ? (
                  <Text
                    style={[
                      styles.resultSecondary,
                      { color: theme.colors.secondaryText },
                    ]}
                  >
                    {evalResult.result.unit}
                  </Text>
                ) : null}
              </View>

              {evalResult.result.conversions?.length ? (
                <View style={styles.chipsWrap}>
                  {evalResult.result.conversions.map((c) => (
                    <View
                      key={`conv-${c.unit}`}
                      style={[
                        styles.chip,
                        { backgroundColor: theme.colors.chipBackground },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: theme.colors.secondaryText },
                        ]}
                      >
                        {c.display}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </BottomSheetView>
    </BottomSheet>
  );
};
