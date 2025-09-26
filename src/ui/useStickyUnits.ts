import { useCallback, useEffect, useRef, useState } from "react";
import { kvGet, kvSet } from "../storage/kv";

export type StickyScope =
  | { kind: "var"; name: string } // preferência por variável
  | { kind: "type"; type: string }; // preferência por tipo (mass, length, currency, ...)

const keyOf = (sheetId: string, scope: StickyScope) =>
  scope.kind === "var"
    ? `cc:unitPref:${sheetId}:var:${scope.name.toLowerCase()}`
    : `cc:unitPref:${sheetId}:type:${scope.type.toLowerCase()}`;

type Cache = Record<string, string>;

export const useStickyUnits = (sheetId: string) => {
  const [cache, setCache] = useState<Cache>({});
  const sheetRef = useRef(sheetId);

  // Se o sheetId mudar, limpamos o cache em memória para não vazar preferências entre folhas.
  useEffect(() => {
    if (sheetRef.current !== sheetId) {
      sheetRef.current = sheetId;
      setCache({});
    }
  }, [sheetId]);

  const getPreferredUnit = useCallback(
    async (scope: StickyScope): Promise<string | null> => {
      const key = keyOf(sheetId, scope);
      if (key in cache) return cache[key];

      try {
        const v = await kvGet(key);
        if (typeof v === "string") {
          setCache((prev) => (prev[key] === v ? prev : { ...prev, [key]: v }));
          return v;
        }
      } catch {
        // silencioso: não quebrar a UI por falha de storage
      }
      return null;
    },
    [cache, sheetId]
  );

  const setPreferredUnit = useCallback(
    async (scope: StickyScope, unit: string) => {
      const key = keyOf(sheetId, scope);
      try {
        await kvSet(key, unit);
        setCache((prev) =>
          prev[key] === unit ? prev : { ...prev, [key]: unit }
        );
      } catch {
        // silencioso
      }
    },
    [sheetId]
  );

  return { getPreferredUnit, setPreferredUnit };
};
