import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import React, { useMemo } from "react";
import { ScrollView, View } from "react-native";
import { Chip, IconButton } from "react-native-paper";

import type { Theme } from "../../styles/theme";
import type { Note } from "../../types";
import { createStyles } from "./styles";

const withAlpha22 = (hex: string) => {
  if (!/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(hex)) {
    return "#00000022";
  }
  return `${hex}22`;
};

interface NoteTabsProps {
  theme: Theme;
  notes: Note[];
  activeNoteId: string;
  onSelect: (noteId: string) => void;
  onAdd: () => void;
  onDeleteRequest: (noteId: string) => void;
}

export const NoteTabs: React.FC<NoteTabsProps> = ({
  theme,
  notes,
  activeNoteId,
  onSelect,
  onAdd,
  onDeleteRequest,
}) => {
  const styles = useMemo(() => createStyles(theme), [theme]);

  const C = theme.colorsFlat;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {notes.map((note) => {
        const isActive = note.id === activeNoteId;

        return (
          <View key={note.id} style={styles.pillWrapper}>
            <Chip
              style={[
                styles.pill,
                {
                  backgroundColor: isActive ? C.primary : C.surface,
                },
              ]}
              textStyle={[
                styles.pillText,
                { color: isActive ? C.cardBackground : C.secondaryText },
              ]}
              mode="flat"
              rippleColor={withAlpha22(C.primary)}
              onPress={() => onSelect(note.id)}
              onLongPress={() => onDeleteRequest(note.id)}
            >
              {note.title}
            </Chip>
          </View>
        );
      })}

      <IconButton
        icon={() => (
          <HugeiconsIcon
            icon={PlusSignIcon}
            size={20}
            strokeWidth={3}
            color={C.primary}
          />
        )}
        size={20}
        onPress={onAdd}
        style={styles.addBtn}
        iconColor={C.primary}
        containerColor={C.chipBackground}
        rippleColor={withAlpha22(C.primary)}
      />
    </ScrollView>
  );
};
