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
import { Button, Card, Chip } from "react-native-paper"; // ⬅️ novo
import type { Theme } from "../../styles/theme";
import type { CalculationLine, Note } from "../../types";
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
}

export const CalculationSheet: React.FC<CalculationSheetProps> = ({
  theme,
  note,
  onChangeLine,
  onAddLine,
  onDeleteLine,
  onEditorOpenChange,
}) => {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const placeholderColor = String(theme.colors.secondaryText);

  const [editingLine, setEditingLine] = useState<CalculationLine | null>(null);
  const [isNewEditing, setIsNewEditing] = useState(false);
  const [pendingOpenNew, setPendingOpenNew] = useState(false);
  const prevLinesCount = useRef<number>(note.lines.length);

  const canAddLine = note.lines.length < MAX_LINES_PER_SHEET;

  const pressAnim = useRef(new Animated.Value(0)).current;
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

  const SwipeableRow: React.FC<{
    onDelete: () => void;
    children: React.ReactNode;
  }> = ({ onDelete, children }) => {
    const translateX = React.useRef(new Animated.Value(0)).current;
    const [width, setWidth] = useState(0);

    const handleLayout = React.useCallback((e: LayoutChangeEvent) => {
      setWidth(e.nativeEvent.layout.width);
    }, []);

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (_evt, gesture) => {
            if (editingLine) return false;
            const dx = Math.abs(gesture.dx);
            const dy = Math.abs(gesture.dy);
            return dx > 6 && dx > dy;
          },
          onPanResponderMove: (_evt, gesture) => {
            if (gesture.dx < 0) translateX.setValue(gesture.dx);
            else translateX.setValue(gesture.dx * 0.2);
          },
          onPanResponderRelease: (_evt, gesture) => {
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
            Animated.spring(translateX, {
              toValue: 0,
              bounciness: 8,
              useNativeDriver: true,
            }).start();
          },
        }),
      [onDelete, translateX, width, editingLine]
    );

    return (
      <View style={styles.cardWrapper} onLayout={handleLayout}>
        <View style={styles.deleteBackdrop}>
          <Text style={styles.deleteText}>Delete</Text>
        </View>
        <Animated.View
          style={{ transform: [{ translateX }] }}
          {...panResponder.panHandlers}
        >
          {children}
        </Animated.View>
      </View>
    );
  };

  const handleInputFocus = (line: CalculationLine) => {
    if (editingLine) return;
    setIsNewEditing(false);
    setEditingLine(line);
    Keyboard.dismiss();
  };

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
        onScrollBeginDrag={() => {
          if (!editingLine) Keyboard.dismiss();
        }}
        onTouchStart={() => {
          if (!editingLine) Keyboard.dismiss();
        }}
      >
        {note.lines.map((line) => {
          const hasResult = Boolean(line.result);
          const allowSwipe = note.lines.length > 1;

          const PaperCard = (
            <Animated.View style={scaleStyle}>
              <Card
                mode="contained"
                onPress={() => handleInputFocus(line)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={!!editingLine}
                style={styles.card}
                theme={{
                  colors: { surface: theme.colors.cardBackground.toString() },
                }}
              >
                <Card.Content style={{ padding: 0 }}>
                  <Text style={styles.input}>
                    {line.input || "Type calculation..."}
                  </Text>

                  {hasResult ? (
                    <>
                      <View style={styles.resultContainer}>
                        <Text style={styles.resultPrimary}>
                          {line.result?.formatted}
                        </Text>
                        {line.result?.unit ? (
                          <Text style={styles.resultSecondary}>
                            {line.result.unit}
                          </Text>
                        ) : null}
                      </View>

                      {line.result?.conversions?.length ? (
                        <View style={styles.conversionChips}>
                          {line.result.conversions.map((conversion) => (
                            <Chip
                              key={`${line.id}-${conversion.unit}`}
                              compact
                              mode="flat"
                              style={styles.chipPaper}
                              textStyle={styles.chipTextPaper}
                            >
                              {conversion.display}
                            </Chip>
                          ))}
                        </View>
                      ) : null}
                    </>
                  ) : null}

                  {line.error ? (
                    <Text style={styles.errorText}>{line.error}</Text>
                  ) : null}
                </Card.Content>
              </Card>
            </Animated.View>
          );

          return allowSwipe ? (
            <SwipeableRow key={line.id} onDelete={() => onDeleteLine(line.id)}>
              {PaperCard}
            </SwipeableRow>
          ) : (
            <View key={line.id} style={styles.cardWrapper}>
              {PaperCard}
            </View>
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
        />
      )}
    </>
  );
};
