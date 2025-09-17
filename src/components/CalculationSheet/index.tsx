import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import type { Theme } from "../../styles/theme";
import type { Note } from "../../types";
import { createStyles } from "./styles";

interface CalculationSheetProps {
  theme: Theme;
  note: Note;
  onChangeLine: (lineId: string, value: string) => void;
  onAddLine: () => void;
  onDeleteLine: (lineId: string) => void; // Added
}

export const CalculationSheet: React.FC<CalculationSheetProps> = ({
  theme,
  note,
  onChangeLine,
  onAddLine,
  onDeleteLine,
}) => {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const placeholderColor = theme.colors.secondaryText;
  const scrollViewRef = useRef<ScrollView>(null); // Ref to control ScrollView

  // Dismiss focus when keyboard hides
  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        // Dismiss keyboard focus to ensure inputs lose focus
        Keyboard.dismiss();
      }
    );

    return () => {
      keyboardDidHideListener.remove();
    };
  }, []);

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
      [onDelete, translateX, width]
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0} // Adjust offset for iOS status bar/header
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        onTouchStart={Keyboard.dismiss}
      >
        {note.lines.map((line, index) => {
          const hasResult = Boolean(line.result);
          const allowSwipe = note.lines.length > 1; // Disable swipe if only one

          const Card = (
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                value={line.input}
                onChangeText={(text) => onChangeLine(line.id, text)}
                placeholder="Type calculation..."
                placeholderTextColor={placeholderColor}
                multiline
                onSubmitEditing={onAddLine}
              />

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
            </View>
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

        <TouchableOpacity style={styles.addLineButton} onPress={onAddLine}>
          <HugeiconsIcon
            icon={PlusSignIcon}
            color={theme.colors.primary}
            size={16}
            strokeWidth={3.5}
          />
          <Text style={styles.addLineText}>Add calculation</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
