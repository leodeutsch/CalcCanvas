import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";

import { FREE_NOTE_LIMIT, STORAGE_KEYS } from "../constants";
import { EXCHANGE_CACHE_TTL } from "../services/marketData";
import type { CalculationLine, CalculationResult, Note } from "../types";
import { evaluateInput } from "../utils/evaluator"; // mantém como está na sua base
import { createBlankNote, createInitialNote, createLine } from "../utils/notes";
import type { MarketDataState } from "./useMarketData";

const MAX_LINES_PER_SHEET = 3;
const VARS_KEY = (noteId: string) => `cc_vars_${noteId}`;
type VarsMap = Record<string, number>;

// Detect inline assignment (lhs := rhs or lhs = rhs)
const RE_ASSIGN = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[:=]\s*(.+)$/;

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
  deleteLine: (noteId: string, lineId: string) => void;
  setPremium: (value: boolean) => Promise<void>;
  downgradeToFree: () => Promise<void>;
}

const normalizeLegacyResult = (line: CalculationLine): CalculationLine => {
  const rawResult = (line as unknown as { result?: unknown }).result;
  if (!rawResult) return { ...line, result: undefined };
  if (typeof rawResult === "object" && "formatted" in (rawResult as object)) {
    return line;
  }
  const numericValue = Number.parseFloat(
    typeof rawResult === "number"
      ? rawResult.toString()
      : String(rawResult).replace(/[^0-9.-]/g, "")
  );
  if (!Number.isFinite(numericValue)) return { ...line, result: undefined };
  const normalizedResult: CalculationResult = {
    value: numericValue,
    formatted: String(rawResult),
    type: "number",
  };
  return { ...line, result: normalizedResult };
};

const varsEqual = (a: VarsMap, b: VarsMap) => {
  const ak = Object.keys(a),
    bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
};

export const useNotes = (marketData: MarketDataState): NotesHook => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>("");
  const [isPremium, setIsPremium] = useState(false);
  const [varsByNote, setVarsByNote] = useState<Record<string, VarsMap>>({});

  // Debounce timer (single queue; last call wins)
  const updateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdate = useRef<{
    noteId: string;
    lineId: string;
    input: string;
  } | null>(null);

  const loadNoteVars = useCallback(async (noteId: string): Promise<VarsMap> => {
    try {
      const raw = await AsyncStorage.getItem(VARS_KEY(noteId));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const out: VarsMap = {};
      for (const [k, v] of Object.entries(parsed || {})) {
        if (typeof v === "number" && Number.isFinite(v))
          out[k.toLowerCase()] = v;
      }
      return out;
    } catch {
      return {};
    }
  }, []);

  const saveNoteVars = useCallback(async (noteId: string, vars: VarsMap) => {
    try {
      await AsyncStorage.setItem(VARS_KEY(noteId), JSON.stringify(vars));
    } catch (e) {
      console.warn("Failed to persist vars for note", noteId, e);
    }
  }, []);

  const removeNoteVars = useCallback(async (noteId: string) => {
    try {
      await AsyncStorage.removeItem(VARS_KEY(noteId));
    } catch (e) {
      console.warn("Failed to remove vars for note", noteId, e);
    }
  }, []);

  const persistNotes = useCallback(async (updatedNotes: Note[]) => {
    try {
      const payload = { version: 1, notes: updatedNotes };
      await AsyncStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(payload));
    } catch (error) {
      console.error("Error saving notes:", error);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const storedNotes = await AsyncStorage.getItem(STORAGE_KEYS.notes);
      const storedPremium = await AsyncStorage.getItem(STORAGE_KEYS.premium);

      if (storedNotes) {
        let parsedNotesRaw: unknown;
        try {
          parsedNotesRaw = JSON.parse(storedNotes);
        } catch {
          parsedNotesRaw = null;
        }

        // aceita {version:1, notes:[...]} ou [...]
        const rawArray = Array.isArray(parsedNotesRaw)
          ? parsedNotesRaw
          : Array.isArray((parsedNotesRaw as any)?.notes)
          ? (parsedNotesRaw as any).notes
          : [];

        const parsedNotes: Note[] = rawArray.map((note: Note) => ({
          ...note,
          lines: note.lines.map((line) => normalizeLegacyResult(line)),
          lastModified: note.lastModified ?? new Date().toISOString(),
        }));

        if (parsedNotes.length === 0) {
          const fallbackNote = createInitialNote();
          setNotes([fallbackNote]);
          setActiveNoteId(fallbackNote.id);
          await persistNotes([fallbackNote]);
          setVarsByNote({ [fallbackNote.id]: {} });
          await saveNoteVars(fallbackNote.id, {});
        } else {
          setNotes(parsedNotes);
          setActiveNoteId(parsedNotes[0].id);
          const entries = await Promise.all(
            parsedNotes.map(
              async (n) => [n.id, await loadNoteVars(n.id)] as const
            )
          );
          const map: Record<string, VarsMap> = {};
          for (const [id, vars] of entries) map[id] = vars;
          setVarsByNote(map);
        }
      } else {
        const initialNote = createInitialNote();
        setNotes([initialNote]);
        setActiveNoteId(initialNote.id);
        await persistNotes([initialNote]);
        setVarsByNote({ [initialNote.id]: {} });
        await saveNoteVars(initialNote.id, {});
      }

      setIsPremium(storedPremium === "true");
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  }, [loadNoteVars, persistNotes, saveNoteVars]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Evaluate a single source string, handling assignments (lhs := rhs).
  const evaluateWithAssign = useCallback(
    (src: string, prevVals: number[], scopeVars: VarsMap) => {
      const trimmed = src || "";
      if (!trimmed.trim()) {
        return {
          result: undefined as CalculationResult | undefined,
          numeric: NaN,
          assignedName: null as string | null,
        };
      }

      const m = trimmed.match(RE_ASSIGN);
      if (m) {
        const lhs = m[1].toLowerCase();
        const rhs = m[2].trim();
        const ev = evaluateInput(rhs, marketData, {
          previousValues: prevVals,
          variables: scopeVars,
        });
        const numeric =
          ev.result && Number.isFinite(ev.result.value)
            ? Number(ev.result.value)
            : NaN;
        if (Number.isFinite(numeric)) {
          // store lhs in scope (case-insensitive)
          scopeVars[lhs] = numeric;
        }
        return { result: ev.result, numeric, assignedName: lhs };
      } else {
        const ev = evaluateInput(trimmed, marketData, {
          previousValues: prevVals,
          variables: scopeVars,
        });
        const numeric =
          ev.result && Number.isFinite(ev.result.value)
            ? Number(ev.result.value)
            : NaN;
        return {
          result: ev.result,
          numeric,
          assignedName: null as string | null,
        };
      }
    },
    [marketData]
  );

  // Partial recompute from a given index (inclusive)
  const recomputeFromIndex = useCallback(
    (
      note: Note,
      startIndex: number,
      baseVars: VarsMap
    ): { nextNote: Note; varsOut: VarsMap } => {
      const { lines } = note;
      const prevVals: number[] = [];

      // 1) Build prevVals for [0 .. startIndex-1] from existing results
      for (let i = 0; i < startIndex; i++) {
        const v =
          lines[i].result && Number.isFinite(lines[i].result!.value)
            ? Number(lines[i].result!.value)
            : NaN;
        prevVals.push(v);
      }

      // 2) Rebuild scopeVars by reevaluating only assignment lines before startIndex
      const scopeVars: VarsMap = { ...baseVars };
      for (let i = 0; i < startIndex; i++) {
        const src = lines[i].input || "";
        if (!src.trim()) continue;
        if (!RE_ASSIGN.test(src)) {
          continue; // not an assignment line -> skip reevaluation
        }
        const { result, numeric, assignedName } = evaluateWithAssign(
          src,
          prevVals,
          scopeVars
        );
        // for consistency, keep prevVals[i] aligned with the value derived on this pass
        prevVals[i] = Number.isFinite(numeric) ? numeric : prevVals[i]; // fallback to previous numeric if any
        // assigned variable already stored inside evaluateWithAssign
      }

      // 3) Evaluate from startIndex to the end
      const nextLines: CalculationLine[] = [...lines];
      for (let i = startIndex; i < nextLines.length; i++) {
        const ln = nextLines[i];
        const src = ln.input || "";
        if (!src.trim()) {
          prevVals.push(NaN);
          nextLines[i] = { ...ln, result: undefined, error: undefined };
          continue;
        }
        const { result, numeric } = evaluateWithAssign(
          src,
          prevVals,
          scopeVars
        );
        prevVals.push(Number.isFinite(numeric) ? numeric : NaN);
        nextLines[i] = { ...ln, result, error: undefined };
      }

      return {
        nextNote: {
          ...note,
          lines: nextLines,
          lastModified: new Date().toISOString(),
        },
        varsOut: scopeVars,
      };
    },
    [evaluateWithAssign]
  );

  // FX/coins refresh → recompute all notes (full pass)
  useEffect(() => {
    if (!marketData.lastUpdated) return;

    setNotes((prev) => {
      const next: Note[] = [];
      const nextVarsMap: Record<string, VarsMap> = { ...varsByNote };

      for (const note of prev) {
        const { nextNote, varsOut } = recomputeFromIndex(
          note,
          0,
          varsByNote[note.id] ?? {}
        );
        next.push(nextNote);
        if (!varsEqual(varsByNote[note.id] || {}, varsOut)) {
          nextVarsMap[note.id] = varsOut;
          saveNoteVars(note.id, varsOut);
        }
      }

      setVarsByNote(nextVarsMap);
      persistNotes(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    recomputeFromIndex,
    persistNotes,
    saveNoteVars,
  ]);

  // Debounced updateLine
  const updateLine = useCallback(
    (noteId: string, lineId: string, input: string) => {
      if (
        !marketData.lastUpdated ||
        Date.now() - marketData.lastUpdated > EXCHANGE_CACHE_TTL
      ) {
        marketData.refresh();
      }

      // keep last call
      pendingUpdate.current = { noteId, lineId, input };
      if (updateTimer.current) clearTimeout(updateTimer.current);

      updateTimer.current = setTimeout(() => {
        const payload = pendingUpdate.current;
        pendingUpdate.current = null;
        if (!payload) return;

        setNotes((previousNotes) => {
          const nextNotes: Note[] = [];
          let changedVars = false;
          const nextVarsMap: Record<string, VarsMap> = { ...varsByNote };

          for (const note of previousNotes) {
            if (note.id !== payload.noteId) {
              nextNotes.push(note);
              continue;
            }

            // apply new input
            const idx = note.lines.findIndex((l) => l.id === payload.lineId);
            if (idx < 0) {
              nextNotes.push(note);
              continue;
            }

            const patched = note.lines.map((ln, i) =>
              i === idx ? { ...ln, input: payload.input } : ln
            );

            const { nextNote, varsOut } = recomputeFromIndex(
              { ...note, lines: patched },
              idx, // recompute from changed index
              varsByNote[note.id] ?? {}
            );

            nextNotes.push(nextNote);

            if (!varsEqual(varsByNote[note.id] || {}, varsOut)) {
              changedVars = true;
              nextVarsMap[note.id] = varsOut;
              saveNoteVars(note.id, varsOut);
            }
          }

          if (changedVars) setVarsByNote(nextVarsMap);
          persistNotes(nextNotes);
          return nextNotes;
        });
      }, 120); // debounce window
    },
    [marketData, persistNotes, recomputeFromIndex, saveNoteVars, varsByNote]
  );

  const addLine = useCallback(
    (noteId: string) => {
      setNotes((previousNotes) => {
        const targetNote = previousNotes.find((note) => note.id === noteId);
        if (targetNote && targetNote.lines.length >= MAX_LINES_PER_SHEET) {
          Alert.alert(
            "Maximum calculations reached",
            `You can only have ${MAX_LINES_PER_SHEET} calculations per sheet.`,
            [{ text: "OK" }]
          );
          return previousNotes;
        }

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
    setVarsByNote((prev) => ({ ...prev, [newNote.id]: {} }));
    saveNoteVars(newNote.id, {});
    persistNotes(updatedNotes);
  }, [isPremium, notes, persistNotes, saveNoteVars]);

  const deleteNote = useCallback(
    (noteId: string) => {
      setNotes((previousNotes) => {
        const targetIndex = previousNotes.findIndex((n) => n.id === noteId);
        if (targetIndex === 0) {
          return previousNotes; // keep first sheet
        }

        const filteredNotes = previousNotes.filter(
          (note) => note.id !== noteId
        );

        setVarsByNote((prev) => {
          const { [noteId]: _, ...rest } = prev;
          return rest;
        });
        removeNoteVars(noteId);

        if (filteredNotes.length === 0) {
          const initialNote = createBlankNote(1);
          setActiveNoteId(initialNote.id);
          setVarsByNote({ [initialNote.id]: {} });
          saveNoteVars(initialNote.id, {});
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
    [activeNoteId, persistNotes, removeNoteVars, saveNoteVars]
  );

  const setPremium = useCallback(async (value: boolean) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.premium,
        value ? "true" : "false"
      );
    } catch (e) {
      console.warn("Failed to persist premium flag", e);
    }
    setIsPremium(value);
  }, []);

  const downgradeToFree = useCallback(async () => {
    await setPremium(false);
    setNotes((previousNotes) => {
      const first = previousNotes[0] ?? createBlankNote(1);
      const ensuredLines =
        first.lines && first.lines.length > 0
          ? [first.lines[0]]
          : [createLine()];
      const firstNote: Note = {
        ...first,
        title: "Sheet",
        lines: ensuredLines,
        lastModified: new Date().toISOString(),
      };

      const nextNotes = [firstNote];
      setActiveNoteId(firstNote.id);
      persistNotes(nextNotes);

      const keepId = firstNote.id;
      setVarsByNote({ [keepId]: varsByNote[keepId] ?? {} });
      previousNotes
        .filter((n) => n.id !== keepId)
        .forEach((n) => removeNoteVars(n.id));

      return nextNotes;
    });
  }, [persistNotes, removeNoteVars, setPremium, varsByNote]);

  const deleteLine = useCallback(
    (noteId: string, lineId: string) => {
      setNotes((previousNotes) => {
        const updatedNotes = previousNotes.map((note) => {
          if (note.id !== noteId) return note;
          if (note.lines.length <= 1) return note;

          const idx = note.lines.findIndex((l) => l.id === lineId);
          const nextLines = note.lines.filter((l) => l.id !== lineId);
          const safeLines = nextLines.length > 0 ? nextLines : [createLine()];

          const { nextNote, varsOut } = recomputeFromIndex(
            { ...note, lines: safeLines },
            Math.max(0, idx), // recompute from removed index
            varsByNote[note.id] ?? {}
          );

          if (!varsEqual(varsByNote[note.id] || {}, varsOut)) {
            setVarsByNote((prev) => ({ ...prev, [noteId]: varsOut }));
            saveNoteVars(noteId, varsOut);
          }

          return nextNote;
        });

        persistNotes(updatedNotes);
        return updatedNotes;
      });
    },
    [persistNotes, recomputeFromIndex, saveNoteVars, varsByNote]
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
    deleteLine,
    setPremium,
    downgradeToFree,
  };
};
