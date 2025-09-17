import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";

import type { Theme } from "../../styles/theme";
import type { CalculationLine } from "../../types";
import { createStyles } from "./styles";

interface FloatingInputEditorProps {
  theme: Theme;
  line: CalculationLine;
  placeholderColor: string;
  onSave: (lineId: string, value: string) => void;
  onCancel: () => void;
}

export const FloatingInputEditor: React.FC<FloatingInputEditorProps> = ({
  theme,
  line,
  placeholderColor,
  onSave,
  onCancel,
}) => {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [value, setValue] = useState(line.input);
  const inputRef = useRef<TextInput>(null);
  const hasSubmittedRef = useRef(false);
  const [keyboardShown, setKeyboardShown] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const mountTimeRef = useRef(Date.now());

  // Animation values
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(50)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    // Reset flags when component mounts
    hasSubmittedRef.current = false;
    mountTimeRef.current = Date.now();
    setKeyboardShown(false);

    // Keyboard listeners
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => {
        setKeyboardShown(true);
        setKeyboardHeight(event.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardShown(false);
        setKeyboardHeight(0);
        // Only auto-save if enough time has passed and keyboard was actually shown
        const timeSinceMount = Date.now() - mountTimeRef.current;
        if (timeSinceMount > 1000 && !hasSubmittedRef.current) {
          handleSubmit();
        }
      }
    );

    // Start animations
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.back(1.05)),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.back(1.05)),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Focus after animation completes for better iOS behavior
      if (!hasSubmittedRef.current) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    });

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
      hasSubmittedRef.current = true;
    };
  }, [opacity, translateY, scale]);

  const handleSubmit = () => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    Keyboard.dismiss();
    onSave(line.id, value);
  };

  const handleCancel = () => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    Keyboard.dismiss();
    onCancel();
  };

  const handleBlur = () => {
    // Only auto-save on blur if:
    // 1. Not already submitted
    // 2. Keyboard was actually shown (to avoid immediate blur on mount)
    // 3. Enough time has passed since mount
    const timeSinceMount = Date.now() - mountTimeRef.current;
    if (!hasSubmittedRef.current && keyboardShown && timeSinceMount > 500) {
      handleSubmit();
    }
  };

  // Calculate bottom position based on keyboard height
  const bottomPosition =
    Platform.OS === "ios" && keyboardHeight > 0
      ? keyboardHeight - 34 // Adjust for safe area
      : 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? undefined : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <TouchableOpacity
        style={styles.backdrop}
        onPress={handleCancel}
        activeOpacity={1}
      >
        <Animated.View style={[styles.overlay, { opacity }]} />
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.bottomSheet,
          {
            bottom: bottomPosition,
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={setValue}
          placeholder="Type calculation..."
          placeholderTextColor={placeholderColor}
          multiline={false}
          returnKeyType="done"
          enablesReturnKeyAutomatically={false}
          onSubmitEditing={handleSubmit}
          onBlur={handleBlur}
          selectTextOnFocus={true}
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="default"
          autoFocus={false}
          clearButtonMode="while-editing"
        />

        <TouchableOpacity
          style={styles.doneButton}
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};
