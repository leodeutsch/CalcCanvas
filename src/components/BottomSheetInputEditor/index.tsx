import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import * as Clipboard from "expo-clipboard";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  Keyboard,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Chip, HelperText } from "react-native-paper";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useEvaluatedInput } from "../../hooks/useEvaluatedInput";
import { useMarketData } from "../../hooks/useMarketData";
import type { Theme } from "../../styles/theme";
import type { CalculationLine } from "../../types";
import { buildResultVM } from "../../ui/resultViewModel";
import { useStickyUnits } from "../../ui/useStickyUnits";
import { formatNumber } from "../../utils/calc/mathSugars";
import { getAllVars } from "../../utils/calc/varStore";
import { evaluateInput } from "../../utils/evaluator";
import { createStyles } from "./styles";

interface BottomSheetInputEditorProps {
  theme: Theme;
  line: CalculationLine;
  placeholderColor: string;
  onSave: (lineId: string, value: string) => void;
  onCancel: (lineId: string, valueSnapshot: string) => void;
  onOpenChange?: (open: boolean) => void;
  sheetId: string;
}

export const BottomSheetInputEditor: React.FC<BottomSheetInputEditorProps> = ({
  theme,
  line,
  onSave,
  onCancel,
  onOpenChange,
  sheetId,
}) => {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const inputRef = useRef<TextInput>(null);

  const [value, setValue] = useState(line.input);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const marketData = useMarketData();

  const debouncedValue = useDebouncedValue(value, 50);

  const evalFn = useCallback(
    (expr: string) => evaluateInput(expr, marketData, undefined, { sheetId }),
    [marketData, sheetId]
  );

  const evalResult = useEvaluatedInput(debouncedValue, evalFn);

  const sticky = useStickyUnits(sheetId);
  const [vm, setVM] = useState<null | Awaited<
    ReturnType<typeof buildResultVM>
  >>(null);

  const [varNames, setVarNames] = useState<string[]>([]);
  useEffect(() => {
    const varsObj = getAllVars({ sheetId });
    setVarNames(Object.keys(varsObj));
  }, [sheetId]);

  const guessVarFromExpr = useCallback((expr: string, known: string[]) => {
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sorted = [...known].sort((a, b) => b.length - a.length);
    return (
      sorted.find((name) => new RegExp(`\\b${esc(name)}\\b`, "i").test(expr)) ||
      null
    );
  }, []);

  useEffect(() => {
    const r = evalResult?.result;
    if (!r) {
      setVM(null);
      return;
    }
    const varName = guessVarFromExpr(value, varNames) || undefined;
    buildResultVM(r, { sheetId, sticky, variableName: varName }).then(setVM);
  }, [evalResult?.result, sheetId, sticky, value, varNames, guessVarFromExpr]);

  const snapPoints = useMemo(() => ["96%"], []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
    } catch (err) {
      console.warn("Clipboard copy failed", err);
    }
  }, []);

  const btnAnim = useSharedValue(0);
  const doneAnimStyle = useAnimatedStyle(() => ({
    opacity: btnAnim.value,
    transform: [{ translateY: withTiming(0, { duration: 160 }) }],
  }));

  useEffect(() => {
    const t = setTimeout(() => {
      sheetRef.current?.expand();
      onOpenChange?.(true);
      setIsOpen(true);
      inputRef.current?.focus();
      btnAnim.value = withTiming(1, { duration: 160 });
    }, 60);

    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
        inputRef.current?.blur();
      }
    );
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardVisible(true)
    );

    return () => {
      clearTimeout(t);
      hide.remove();
      show.remove();
    };
  }, [onOpenChange, btnAnim]);

  const handleChipPress = useCallback(
    async (unit: string) => {
      if (!vm?.stickyScope || !evalResult?.result) return;
      await sticky.setPreferredUnit(vm.stickyScope, unit);
      const varName = guessVarFromExpr(value, varNames) || undefined;
      const updated = await buildResultVM(evalResult.result, {
        sheetId,
        sticky,
        variableName: varName,
      });
      setVM(updated);
    },
    [
      vm?.stickyScope,
      evalResult?.result,
      sheetId,
      sticky,
      value,
      varNames,
      guessVarFromExpr,
    ]
  );

  const handleDone = () => {
    Keyboard.dismiss();
    onSave(line.id, value);
    sheetRef.current?.close();
  };

  const handleClose = () => {
    onCancel(line.id, value);
    onOpenChange?.(false);
    setIsOpen(false);
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
  const KBD_LIFT_OFFSET_ANDROID = 32;
  const KBD_LIFT_OFFSET_IOS = 56;
  const footerLiftStyle = useAnimatedStyle(() => {
    const h = kbd.height.value;
    const effective = h > 0 ? h : 0;
    const mb =
      Platform.OS === "ios" && effective > 0
        ? effective - KBD_LIFT_OFFSET_IOS
        : Platform.OS === "android"
        ? Math.max(0, effective - KBD_LIFT_OFFSET_ANDROID)
        : 0;

    return {
      marginBottom: withTiming(mb, { duration: 120 }),
    };
  });

  const renderFooter = useCallback(
    (footerProps: any) => (
      <BottomSheetFooter {...footerProps} bottomInset={0}>
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
          <Button
            mode="contained"
            onPress={handleDone}
            style={styles.doneButton}
            compact
          >
            Done
          </Button>
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

  // Android back gesture: first dismiss keyboard (if visible), then close sheet
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const onBackPress = () => {
      if (keyboardVisible) {
        Keyboard.dismiss();
        return true;
      }
      if (isOpen) {
        sheetRef.current?.close();
        return true;
      }

      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [keyboardVisible, isOpen]);

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
      keyboardBehavior="extend"
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
          placeholderTextColor={`${theme.colorsFlat.text}60`}
          multiline
          submitBehavior="newline"
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
            <HelperText type="error" visible style={[styles.errorText]}>
              {evalResult.error}
            </HelperText>
          ) : evalResult?.result ? (
            <View>
              {vm ? (
                <View>
                  <View style={styles.resultRow}>
                    <Text
                      style={[
                        styles.resultPrimary,
                        { color: theme.colors.success },
                      ]}
                    >
                      {vm.primary.formatted}
                    </Text>
                    {vm.primary.unit ? (
                      <Text
                        style={[
                          styles.resultSecondary,
                          { color: theme.colors.secondaryText },
                        ]}
                      >
                        {vm.primary.unit}
                      </Text>
                    ) : null}
                  </View>

                  {evalResult?.result?.metadata?.deal ? (
                    <View style={styles.chipsWrap}>
                      {(() => {
                        const d = evalResult.result.metadata.deal;
                        // chip 1: unit price (ex.: 80 USD/bag)
                        const unitLabel = d.unitPrice?.per
                          ? `/${d.unitPrice.per}`
                          : "";
                        return (
                          <>
                            {d.unitPrice != null && (
                              <Chip
                                key="deal-unitprice"
                                mode="flat"
                                compact
                                onPress={() =>
                                  handleChipPress(
                                    `${d.unitPrice!.ccy}${unitLabel}`
                                  )
                                }
                                onLongPress={() =>
                                  copyToClipboard(
                                    `${formatNumber(d.unitPrice!.amount, 2)} ${
                                      d.unitPrice!.ccy
                                    }${unitLabel}`
                                  )
                                }
                                style={styles.chip}
                                textStyle={styles.chipText}
                              >
                                {`${formatNumber(d.unitPrice!.amount, 2)} ${
                                  d.unitPrice!.ccy
                                }${unitLabel}`}
                              </Chip>
                            )}
                            {/* chip 2: total (ex.: 400 USD total) */}
                            {d.total != null && (
                              <Chip
                                key="deal-total"
                                mode="flat"
                                compact
                                onPress={() => handleChipPress(d.total!.ccy)}
                                onLongPress={() =>
                                  copyToClipboard(
                                    `${formatNumber(d.total!.amount, 2)} ${
                                      d.total!.ccy
                                    } total`
                                  )
                                }
                                style={styles.chip}
                                textStyle={styles.chipText}
                              >
                                {`${formatNumber(d.total!.amount, 2)} ${
                                  d.total!.ccy
                                } total`}
                              </Chip>
                            )}
                          </>
                        );
                      })()}
                    </View>
                  ) : null}

                  {!!vm.chips?.length && (
                    <View style={styles.chipsWrap}>
                      {vm.chips.map((c) => (
                        <Chip
                          key={`conv-${c.unit}`}
                          mode="flat"
                          compact
                          onPress={() => handleChipPress(c.unit)}
                          onLongPress={() => copyToClipboard(String(c.display))}
                          style={styles.chip}
                          textStyle={styles.chipText}
                          accessibilityLabel={`Conversion ${c.display}`}
                        >
                          {c.display}
                        </Chip>
                      ))}
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </BottomSheetView>
    </BottomSheet>
  );
};
