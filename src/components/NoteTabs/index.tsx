import React, { useMemo } from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";

import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import type { Theme } from "../../styles/theme";
import type { Note } from "../../types";
import { createStyles } from "./styles";

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
          <TouchableOpacity
            key={note.id}
            style={[styles.tab, isActive && styles.activeTab]}
            onPress={() => onSelect(note.id)}
            onLongPress={() => onDeleteRequest(note.id)}
            delayLongPress={400}
          >
            <Text style={[styles.tabText, isActive && styles.activeTabText]}>
              {note.title}
            </Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity style={styles.addTab} onPress={onAdd}>
        {/* <Text style={styles.addTabText}>+</Text> */}
        <HugeiconsIcon
          icon={PlusSignIcon}
          color={theme.colors.primary}
          size={20}
          strokeWidth={3}
        />
      </TouchableOpacity>
    </ScrollView>
  );
};
