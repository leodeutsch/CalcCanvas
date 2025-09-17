import React, { useMemo } from "react";
import {
  Animated,
  Keyboard,
  LayoutChangeEvent,
  PanResponder,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import type { Theme } from "../../styles/theme";
import type { CalculationLine, Note } from "../../types";
import { FloatingInputEditor } from "../FloatingInputEditor";
import { createStyles } from "./styles";

// Add this constant
const MAX_LINES_PER_SHEET = 3;

interface CalculationSheetProps {
  theme: Theme;
  note: Note;
  onChangeLine: (lineId: string, value: string) => void;
  onAddLine: () => void;
  onDeleteLine: (lineId: string) => void;
}

export const CalculationSheet: React.FC<CalculationSheetProps> = ({
  theme,
  note,
  onChangeLine,
  onAddLine,
  onDeleteLine,
}) => {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const placeholderColor = String(theme.colors.secondaryText);

  const [editingLine, setEditingLine] = React.useState<CalculationLine | null>(
    null
  );

  // Check if we can add more lines
  const canAddLine = note.lines.length < MAX_LINES_PER_SHEET;

  const SwipeableRow: React.FC<{
    onDelete: () => void;
    children: React.ReactNode;
  }> = ({ onDelete, children }) => {
    const translateX = React.useRef(new Animated.Value(0)).current;
    const [width, setWidth] = React.useState(0);

    const handleLayout = React.useCallback((e: LayoutChangeEvent) => {
      setWidth(e.nativeEvent.layout.width);
    }, []);

    const panResponder = React.useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (_evt, gesture) => {
            // Don't allow swiping when editing
            if (editingLine) return false;

            const dx = Math.abs(gesture.dx);
            const dy = Math.abs(gesture.dy);
            return dx > 6 && dx > dy;
          },
          onPanResponderMove: (_evt, gesture) => {
            if (gesture.dx < 0) {
              translateX.setValue(gesture.dx);
            } else {
              translateX.setValue(gesture.dx * 0.2);
            }
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
    // Don't open if already editing
    if (editingLine) return;

    setEditingLine(line);
  };

  const handleFloatingSave = (lineId: string, value: string) => {
    onChangeLine(lineId, value);
    // Clear the editing state immediately
    setEditingLine(null);
  };

  const handleFloatingCancel = () => {
    // Clear the editing state immediately
    setEditingLine(null);
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!editingLine} // Disable scrolling when editing
        onScrollBeginDrag={() => {
          if (!editingLine) {
            Keyboard.dismiss();
          }
        }}
        onTouchStart={() => {
          if (!editingLine) {
            Keyboard.dismiss();
          }
        }}
      >
        {note.lines.map((line, index) => {
          const hasResult = Boolean(line.result);
          const allowSwipe = note.lines.length > 1;

          const Card = (
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleInputFocus(line)}
              activeOpacity={0.8}
              disabled={!!editingLine} // Disable while editing
            >
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
                        <View
                          key={`${line.id}-${conversion.unit}`}
                          style={styles.conversionChip}
                        >
                          <Text style={styles.conversionText}>
                            {conversion.display}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}

              {line.error ? (
                <Text style={styles.errorText}>{line.error}</Text>
              ) : null}
            </TouchableOpacity>
          );

          return allowSwipe ? (
            <SwipeableRow key={line.id} onDelete={() => onDeleteLine(line.id)}>
              {Card}
            </SwipeableRow>
          ) : (
            <View key={line.id} style={styles.cardWrapper}>
              {Card}
            </View>
          );
        })}

        {/* Only show the add button if we haven't reached the limit */}
        {canAddLine && (
          <TouchableOpacity
            style={styles.addLineButton}
            onPress={onAddLine}
            disabled={!!editingLine} // Disable while editing
          >
            <HugeiconsIcon
              icon={PlusSignIcon}
              color={theme.colors.primary}
              size={16}
              strokeWidth={3.5}
            />
            <Text style={styles.addLineText}>Add calculation</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {editingLine && (
        <FloatingInputEditor
          key={editingLine.id} // Force remount with key
          theme={theme}
          line={editingLine}
          placeholderColor={placeholderColor}
          onSave={handleFloatingSave}
          onCancel={handleFloatingCancel}
        />
      )}
    </>
  );
};
