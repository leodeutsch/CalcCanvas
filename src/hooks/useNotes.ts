import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FREE_NOTE_LIMIT, STORAGE_KEYS } from "../constants";
import type { CalculationLine, CalculationResult, Note } from "../types";
import { evaluateInput } from "../utils/evaluator";
import { createBlankNote, createInitialNote, createLine } from "../utils/notes";
import type { MarketDataState } from "./useMarketData";
import { EXCHANGE_CACHE_TTL } from "../services/marketData";

interface NotesHook {
  notes: Note[];
  activeNote: Note | undefined;
  activeNoteId: string;
  isPremium: boolean;
  setActiveNoteId: (id: string) => void;
  updateLine: (noteId: string, lineId: string, input: string) => void;
  addLine: (noteId: string) => void;
  addNote: () => void;
  deleteNote: (noteId: string) => void;
}

const normalizeLegacyResult = (
  line: CalculationLine
): CalculationLine => {
  const rawResult = (line as unknown as { result?: unknown }).result;

  if (!rawResult) {
    return { ...line, result: undefined };
  }

  if (typeof rawResult === "object" && "formatted" in (rawResult as object)) {
    return line;
  }

  const numericValue = Number.parseFloat(
    typeof rawResult === "number"
      ? rawResult.toString()
      : String(rawResult).replace(/[^0-9.-]/g, "")
  );

  if (!Number.isFinite(numericValue)) {
    return { ...line, result: undefined };
  }

  const normalizedResult: CalculationResult = {
    value: numericValue,
    formatted: String(rawResult),
    type: "number",
  };

  return { ...line, result: normalizedResult };
};

export const useNotes = (marketData: MarketDataState): NotesHook => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>("");
  const [isPremium, setIsPremium] = useState(false);

  const persistNotes = useCallback(async (updatedNotes: Note[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(updatedNotes));
    } catch (error) {
      console.error("Error saving notes:", error);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const storedNotes = await AsyncStorage.getItem(STORAGE_KEYS.notes);
      const storedPremium = await AsyncStorage.getItem(STORAGE_KEYS.premium);

      if (storedNotes) {
        const parsedNotes: Note[] = JSON.parse(storedNotes).map((note: Note) => ({
          ...note,
          lines: note.lines.map((line) => normalizeLegacyResult(line)),
          lastModified: note.lastModified ?? new Date().toISOString(),
        }));

        if (parsedNotes.length === 0) {
          const fallbackNote = createInitialNote();
          setNotes([fallbackNote]);
          setActiveNoteId(fallbackNote.id);
          await persistNotes([fallbackNote]);
        } else {
          setNotes(parsedNotes);
          setActiveNoteId(parsedNotes[0].id);
        }
      } else {
        const initialNote = createInitialNote();
        setNotes([initialNote]);
        setActiveNoteId(initialNote.id);
        await persistNotes([initialNote]);
      }

      setIsPremium(storedPremium === "true");
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  }, [persistNotes]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!marketData.lastUpdated) {
      return;
    }

    setNotes((previousNotes) => {
      const updatedNotes = previousNotes.map((note) => ({
        ...note,
        lines: note.lines.map((line) => {
          if (!line.input.trim()) {
            return line;
          }

          const evaluation = evaluateInput(line.input, marketData);
          return {
            ...line,
            result: evaluation.result,
            error: evaluation.error,
          };
        }),
      }));

      persistNotes(updatedNotes);
      return updatedNotes;
    });
  }, [
    marketData.lastUpdated,
    marketData.baseCurrency,
    marketData.exchangeRates,
    marketData.ratesToBase,
    marketData.coinPrices,
    marketData.getCurrencyRate,
    marketData.convertFromBase,
    marketData.convertToBase,
    marketData.getCoinPriceBySymbol,
    marketData.getCoinAmountFromBase,
    persistNotes,
  ]);

  const updateLine = useCallback(
    (noteId: string, lineId: string, input: string) => {
      if (
        !marketData.lastUpdated ||
        Date.now() - marketData.lastUpdated > EXCHANGE_CACHE_TTL
      ) {
        marketData.refresh();
      }

      setNotes((previousNotes) => {
        const updatedNotes = previousNotes.map((note) => {
          if (note.id !== noteId) {
            return note;
          }

          const evaluation = evaluateInput(input, marketData);

          const updatedLines = note.lines.map((line) =>
            line.id === lineId
              ? {
                  ...line,
                  input,
                  result: evaluation.result,
                  error: evaluation.error,
                }
              : line
          );

          return {
            ...note,
            lines: updatedLines,
            lastModified: new Date().toISOString(),
          };
        });

        persistNotes(updatedNotes);
        return updatedNotes;
      });
    },
    [marketData, persistNotes]
  );

  const addLine = useCallback(
    (noteId: string) => {
      setNotes((previousNotes) => {
        const updatedNotes = previousNotes.map((note) =>
          note.id === noteId
            ? {
                ...note,
                lines: [...note.lines, createLine()],
                lastModified: new Date().toISOString(),
              }
            : note
        );

        persistNotes(updatedNotes);
        return updatedNotes;
      });
    },
    [persistNotes]
  );

  const addNote = useCallback(() => {
    if (!isPremium && notes.length >= FREE_NOTE_LIMIT) {
      Alert.alert(
        "Premium Feature",
        "Upgrade to Premium to create unlimited calculation sheets on CalcCanvas!",
        [{ text: "OK" }]
      );
      return;
    }

    const newNote = createBlankNote(notes.length + 1);
    const updatedNotes = [...notes, newNote];

    setNotes(updatedNotes);
    setActiveNoteId(newNote.id);
    persistNotes(updatedNotes);
  }, [isPremium, notes, persistNotes]);

  const deleteNote = useCallback(
    (noteId: string) => {
      setNotes((previousNotes) => {
        const filteredNotes = previousNotes.filter((note) => note.id !== noteId);

        if (filteredNotes.length === 0) {
          const initialNote = createBlankNote(1);
          setActiveNoteId(initialNote.id);
          persistNotes([initialNote]);
          return [initialNote];
        }

        if (noteId === activeNoteId) {
          setActiveNoteId(filteredNotes[0].id);
        }

        persistNotes(filteredNotes);
        return filteredNotes;
      });
    },
    [activeNoteId, persistNotes]
  );

  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeNoteId),
    [activeNoteId, notes]
  );

  return {
    notes,
    activeNote,
    activeNoteId,
    isPremium,
    setActiveNoteId,
    updateLine,
    addLine,
    addNote,
    deleteNote,
  };
};
