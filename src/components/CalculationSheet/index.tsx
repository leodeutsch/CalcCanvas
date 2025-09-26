import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  LayoutChangeEvent,
  PanResponder,
  ScrollView,
  Text,
  View,
} from "react-native";
import AnimatedRollingNumber from "react-native-animated-rolling-numbers";
import { Button, Card, Chip } from "react-native-paper";
import type { Theme } from "../../styles/theme";
import type { CalculationLine, Note } from "../../types";
import { buildResultVM } from "../../ui/resultViewModel";
import { useStickyUnits } from "../../ui/useStickyUnits";
import { formatNumber } from "../../utils/calc/mathSugars";
import { BottomSheetInputEditor } from "../BottomSheetInputEditor";
import { createStyles } from "./styles";

const MAX_LINES_PER_SHEET = 3;

interface CalculationSheetProps {
  theme: Theme;
  note: Note;
  onChangeLine: (lineId: string, value: string) => void;
  onAddLine: () => void;
  onDeleteLine: (lineId: string) => void;
  onEditorOpenChange: (open: boolean) => void;
  sheetId: string;
}

const LineRow: React.FC<{
  theme: Theme;
  line: CalculationLine;
  styles: ReturnType<typeof createStyles>;
  onOpenLine: (line: CalculationLine) => void;
  sheetId: string;
}> = ({ theme, line, styles, onOpenLine, sheetId }) => {
  const pressAnim = React.useRef(new Animated.Value(0)).current;
  const sticky = useStickyUnits(String(sheetId ?? "default")); // se tiver um id em theme/context, melhor passar via prop
  const [vm, setVM] = useState<any>(null);

  useEffect(() => {
    if (!line.result) {
      setVM(null);
      return;
    }
    buildResultVM(line.result, {
      sheetId: String(sheetId ?? "default"),
      sticky,
    }).then(setVM);
  }, [line.result, sheetId, sticky]);

  const handlePressIn = () =>
    Animated.spring(pressAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();

  const handlePressOut = () =>
    Animated.spring(pressAnim, {
      toValue: 0,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  const scaleStyle = {
    transform: [
      {
        scale: pressAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.98],
        }),
      },
    ],
  };

  const hasResult = Boolean(line.result);

  return (
    <Card
      mode="contained"
      onPress={() => onOpenLine(line)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.card}
      theme={{ colors: { surface: String(theme.colors.cardBackground) } }}
    >
      <Card.Content style={{ padding: 0 }}>
        <Animated.View style={scaleStyle}>
          <Text style={styles.input}>
            {line.input || "Type calculation..."}
          </Text>

          {hasResult ? (
            <>
              <View style={styles.resultContainer}>
                {vm ? (
                  <>
                    <AnimatedRollingNumber
                      value={Number(line.result?.value) || 0}
                      formattedText={vm.primary.formatted}
                      useGrouping
                      textStyle={styles.resultPrimary}
                      accessibilityLabel="Result value"
                    />
                    {vm.primary.unit ? (
                      <Text style={styles.resultSecondary}>
                        {vm.primary.unit}
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </View>

              {!!vm?.chips?.length ? (
                <View style={styles.conversionChips}>
                  {line.result?.metadata?.deal &&
                    (() => {
                      const d = line.result.metadata.deal;
                      const unitLabel = d.unitPrice?.per
                        ? `/${d.unitPrice.per}`
                        : "";
                      return (
                        <>
                          {d.unitPrice != null && (
                            <Chip
                              key={`${line.id}-deal-unitprice`}
                              compact
                              mode="flat"
                              style={styles.chipPaper}
                              textStyle={styles.chipTextPaper}
                              onPress={async () => {
                                if (!vm?.stickyScope || !line.result) return;
                                await sticky.setPreferredUnit(
                                  vm.stickyScope,
                                  `${d.unitPrice!.ccy}${unitLabel}`
                                );
                                const updated = await buildResultVM(
                                  line.result,
                                  {
                                    sheetId: String(sheetId ?? "default"),
                                    sticky,
                                  }
                                );
                                setVM(updated);
                              }}
                              onLongPress={() => {
                                // opcional: copiar texto
                              }}
                            >
                              {`${formatNumber(d.unitPrice!.amount, 2)} ${
                                d.unitPrice!.ccy
                              }${unitLabel}`}
                            </Chip>
                          )}
                          {d.total != null && (
                            <Chip
                              key={`${line.id}-deal-total`}
                              compact
                              mode="flat"
                              style={styles.chipPaper}
                              textStyle={styles.chipTextPaper}
                              onPress={async () => {
                                if (!vm?.stickyScope || !line.result) return;
                                await sticky.setPreferredUnit(
                                  vm.stickyScope,
                                  d.total!.ccy
                                );
                                const updated = await buildResultVM(
                                  line.result,
                                  {
                                    sheetId: String(sheetId ?? "default"),
                                    sticky,
                                  }
                                );
                                setVM(updated);
                              }}
                            >
                              {`${formatNumber(d.total!.amount, 2)} ${
                                d.total!.ccy
                              } total`}
                            </Chip>
                          )}
                        </>
                      );
                    })()}

                  {vm.chips.map((conversion: any) => (
                    <Chip
                      key={`${line.id}-${conversion.unit}`}
                      compact
                      mode="flat"
                      style={styles.chipPaper}
                      textStyle={styles.chipTextPaper}
                      onPress={async () => {
                        if (!vm?.stickyScope || !line.result) return;
                        await sticky.setPreferredUnit(
                          vm.stickyScope,
                          conversion.unit
                        );
                        const updated = await buildResultVM(line.result, {
                          sheetId: String(sheetId ?? "default"),
                          sticky,
                        });
                        setVM(updated);
                      }}
                    >
                      <AnimatedRollingNumber
                        value={0}
                        formattedText={String(conversion.display).split(" ")[0]}
                        textStyle={[styles.chipTextPaper, { marginBottom: -4 }]}
                        accessibilityLabel={`Conversion ${conversion.display}`}
                      />{" "}
                      {conversion.unit}
                    </Chip>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          {line.error ? (
            <Text style={styles.errorText}>{line.error}</Text>
          ) : null}
        </Animated.View>
      </Card.Content>
    </Card>
  );
};

const SwipeableRow: React.FC<{
  theme: Theme;
  allowSwipe: boolean;
  onDelete: () => void;
  styles: ReturnType<typeof createStyles>;
  children: React.ReactNode;
}> = ({ theme, allowSwipe, onDelete, styles, children }) => {
  const translateX = React.useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  const handleLayout = React.useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) => {
          if (!allowSwipe) return false;
          const dx = Math.abs(gesture.dx);
          const dy = Math.abs(gesture.dy);
          return dx > 6 && dx > dy;
        },
        onPanResponderMove: (_evt, gesture) => {
          if (!allowSwipe) return;
          if (gesture.dx < 0) translateX.setValue(gesture.dx);
          else translateX.setValue(gesture.dx * 0.2);
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (!allowSwipe) return;
          const threshold = Math.max(80, width * 0.25);
          if (gesture.dx < -threshold || gesture.vx < -1.2) {
            Animated.timing(translateX, {
              toValue: -width,
              duration: 160,
              useNativeDriver: true,
            }).start(() => onDelete());
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              bounciness: 8,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          if (!allowSwipe) return;
          Animated.spring(translateX, {
            toValue: 0,
            bounciness: 8,
            useNativeDriver: true,
          }).start();
        },
      }),
    [allowSwipe, onDelete, translateX, width]
  );

  const inset = theme.spacing.xs;

  return (
    <View style={styles.cardWrapper} onLayout={handleLayout}>
      {allowSwipe ? (
        <View
          style={[
            styles.deleteBackdrop,
            {
              top: inset,
              bottom: inset,
              left: inset,
              right: inset,
              borderRadius: Math.max(0, Number(theme.radii.lg) - inset),
            },
          ]}
        >
          <Text style={styles.deleteText}>Delete</Text>
        </View>
      ) : null}

      <Animated.View
        style={allowSwipe ? { transform: [{ translateX }] } : undefined}
        {...(allowSwipe ? panResponder.panHandlers : {})}
      >
        {children}
      </Animated.View>
    </View>
  );
};

export const CalculationSheet: React.FC<CalculationSheetProps> = ({
  theme,
  note,
  onChangeLine,
  onAddLine,
  onDeleteLine,
  onEditorOpenChange,
  sheetId,
}) => {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const placeholderColor = String(theme.colors.secondaryText);

  const [editingLine, setEditingLine] = useState<CalculationLine | null>(null);
  const [isNewEditing, setIsNewEditing] = useState(false);
  const [pendingOpenNew, setPendingOpenNew] = useState(false);
  const prevLinesCount = useRef<number>(note.lines.length);

  const canAddLine = note.lines.length < MAX_LINES_PER_SHEET;

  const handleAddAndOpen = () => {
    if (!canAddLine) return;
    setPendingOpenNew(true);
    onAddLine();
  };

  useEffect(() => {
    if (pendingOpenNew && note.lines.length > prevLinesCount.current) {
      const last = note.lines[note.lines.length - 1];
      setIsNewEditing(true);
      setEditingLine(last);
      setPendingOpenNew(false);
    }
    prevLinesCount.current = note.lines.length;
  }, [note.lines, pendingOpenNew]);

  const handleEditorSave = (lineId: string, value: string) => {
    if (isNewEditing && !value.trim()) {
      onDeleteLine(lineId);
      setEditingLine(null);
      return;
    }
    onChangeLine(lineId, value);
    setEditingLine(null);
  };

  const handleEditorCancel = (lineId: string, valueSnapshot: string) => {
    if (isNewEditing && !valueSnapshot.trim()) {
      onDeleteLine(lineId);
    }
    setEditingLine(null);
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!editingLine}
        onScrollBeginDrag={() => !editingLine && Keyboard.dismiss()}
        onTouchStart={() => !editingLine && Keyboard.dismiss()}
      >
        {note.lines.map((line) => {
          const allowSwipe = note.lines.length > 1;

          return (
            <SwipeableRow
              key={line.id}
              theme={theme}
              styles={styles}
              allowSwipe={allowSwipe}
              onDelete={() => onDeleteLine(line.id)}
            >
              <LineRow
                theme={theme}
                line={line}
                styles={styles}
                onOpenLine={(l) => {
                  if (editingLine) return;
                  setIsNewEditing(false);
                  setEditingLine(l);
                  Keyboard.dismiss();
                }}
                sheetId={sheetId}
              />
            </SwipeableRow>
          );
        })}

        {canAddLine && (
          <Button
            mode="contained-tonal"
            compact
            onPress={handleAddAndOpen}
            style={styles.addLineButton}
            disabled={!!editingLine}
            labelStyle={styles.addLineText}
            contentStyle={styles.addLineContent}
            icon={() => (
              <HugeiconsIcon
                icon={PlusSignIcon}
                color={theme.colors.primary}
                size={16}
                strokeWidth={3.5}
              />
            )}
          >
            Add calculation
          </Button>
        )}
      </ScrollView>

      {editingLine && (
        <BottomSheetInputEditor
          theme={theme}
          line={editingLine}
          placeholderColor={placeholderColor}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
          onOpenChange={onEditorOpenChange}
          sheetId={String(note.id ?? note.title ?? "default")}
        />
      )}
    </>
  );
};
