import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, View } from "react-native";

import {
  CalculationSheet,
  EmptyState,
  ExamplesFooter,
  Header,
  NoteTabs,
  PremiumPill,
  ThemedPopup,
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
    deleteLine,
    setPremium, // Added
    downgradeToFree, // Added
  } = useNotes(marketData);

  // Premium pill state
  const [pillVisible, setPillVisible] = useState(false);
  const [pillMessage, setPillMessage] = useState("");
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPremiumPill = useCallback((message: string) => {
    setPillMessage(message);
    setPillVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setPillVisible(false);
      hideTimerRef.current = null;
    }, 2000);
  }, []);

  // Popup state
  type Action = {
    label: string;
    onPress?: () => void;
    variant?: "primary" | "secondary" | "destructive";
  };
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [popupActions, setPopupActions] = useState<Action[]>([]);

  const showPopup = useCallback(
    (title: string, message: string, actions: Action[]) => {
      setPopupTitle(title);
      setPopupMessage(message);
      setPopupActions(actions);
      setPopupVisible(true);
    },
    []
  );

  const hidePopup = useCallback(() => setPopupVisible(false), []);

  const handlePremiumPress = useCallback(() => {
    showPopup("Go Premium", "Unlock unlimited sheets!", [
      { label: "Not now", variant: "secondary", onPress: hidePopup },
      {
        label: "Upgrade",
        variant: "primary",
        onPress: async () => {
          await setPremium(true); // DEV unlock
          hidePopup();
        },
      },
    ]);
  }, [hidePopup, showPopup, setPremium]);

  const handlePremiumReset = useCallback(async () => {
    await downgradeToFree();
  }, [downgradeToFree]);

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      const target = notes.find((note) => note.id === noteId);
      if (!target) return;

      // Protected first sheet -> themed popup
      if (notes[0]?.id === noteId) {
        showPopup("Protected sheet", "The first sheet can't be deleted.", [
          { label: "Got it", variant: "primary", onPress: hidePopup },
        ]);
        return;
      }

      // Keep existing delete confirmation for other sheets
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
    [deleteNote, notes, hidePopup, showPopup]
  );

  const handleDeleteLine = useCallback(
    (lineId: string) => {
      if (activeNote) {
        deleteLine(activeNote.id, lineId);
      }
    },
    [activeNote, deleteLine]
  );

  // Gate: Add Sheet
  const handleAddSheetRequested = useCallback(() => {
    if (!isPremium) {
      showPremiumPill("Adding sheets is available for Premium users");
      return;
    }
    addNote();
  }, [addNote, isPremium, showPremiumPill]);

  // Gate: Add Calculation Line
  const handleAddLineRequested = useCallback(() => {
    if (!isPremium) {
      showPremiumPill("Adding calculations is available for Premium users");
      return;
    }
    if (activeNote) {
      addLine(activeNote.id);
    }
  }, [activeNote, addLine, isPremium, showPremiumPill]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Header
          theme={theme}
          isPremium={isPremium}
          onPressPremium={handlePremiumPress}
          onLongPressPremiumReset={handlePremiumReset} // Added
        />
      </View>

      <NoteTabs
        theme={theme}
        notes={notes}
        activeNoteId={activeNoteId}
        onSelect={setActiveNoteId}
        onAdd={handleAddSheetRequested}
        onDeleteRequest={handleDeleteNote}
      />

      {activeNote ? (
        <CalculationSheet
          theme={theme}
          note={activeNote}
          onChangeLine={(lineId: string, text: string) =>
            updateLine(activeNote.id, lineId, text)
          }
          onAddLine={handleAddLineRequested}
          onDeleteLine={handleDeleteLine}
        />
      ) : (
        <EmptyState theme={theme} />
      )}

      <ExamplesFooter theme={theme} examples={EXAMPLE_LINES} />

      <PremiumPill theme={theme} message={pillMessage} visible={pillVisible} />

      <ThemedPopup
        theme={theme}
        visible={popupVisible}
        title={popupTitle}
        message={popupMessage}
        actions={popupActions}
      />
    </View>
  );
};
