import React, { useMemo } from "react";
import {
  Keyboard,
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
}

export const CalculationSheet: React.FC<CalculationSheetProps> = ({
  theme,
  note,
  onChangeLine,
  onAddLine,
}) => {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const placeholderColor = theme.colors.secondaryText;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={Keyboard.dismiss}
      onTouchStart={Keyboard.dismiss}
    >
      {note.lines.map((line) => {
        const hasResult = Boolean(line.result);

        return (
          <View key={line.id} style={styles.cardWrapper}>
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
  );
};
