import { useCallback, useMemo } from "react";
import { Alert, View } from "react-native";

import {
  CalculationSheet,
  EmptyState,
  ExamplesFooter,
  Header,
  NoteTabs,
} from "../../components";
import { EXAMPLE_LINES } from "../../constants";
import { useMarketData } from "../../hooks/useMarketData";
import { useNotes } from "../../hooks/useNotes";
import type { Theme } from "../../styles/theme";
import { createStyles } from "./styles";

interface MainScreenProps {
  theme: Theme;
}

export const MainScreen: React.FC<MainScreenProps> = ({ theme }) => {
  const styles = useMemo(() => createStyles(theme), [theme]);

  const marketData = useMarketData();

  const {
    notes,
    activeNote,
    activeNoteId,
    isPremium,
    setActiveNoteId,
    updateLine,
    addLine,
    addNote,
    deleteNote,
  } = useNotes(marketData);

  const handlePremiumPress = useCallback(() => {
    Alert.alert("Premium", "Unlock unlimited sheets, cloud sync, and more!");
  }, []);

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      const target = notes.find((note) => note.id === noteId);
      if (!target) {
        return;
      }

      Alert.alert(
        "Delete sheet",
        `Are you sure you want to delete "${target.title}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteNote(noteId),
          },
        ]
      );
    },
    [deleteNote, notes]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Header
          theme={theme}
          isPremium={isPremium}
          onPressPremium={handlePremiumPress}
        />
      </View>

      <NoteTabs
        theme={theme}
        notes={notes}
        activeNoteId={activeNoteId}
        onSelect={setActiveNoteId}
        onAdd={addNote}
        onDeleteRequest={handleDeleteNote}
      />

      {activeNote ? (
        <CalculationSheet
          theme={theme}
          note={activeNote}
          onChangeLine={(lineId: string, text: string) =>
            updateLine(activeNote.id, lineId, text)
          }
          onAddLine={() => addLine(activeNote.id)}
        />
      ) : (
        <EmptyState theme={theme} />
      )}

      <View style={styles.footer}>
        <ExamplesFooter theme={theme} examples={EXAMPLE_LINES} />
      </View>
    </View>
  );
};
