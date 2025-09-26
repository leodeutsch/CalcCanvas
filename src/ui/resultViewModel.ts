import type { CalculationResult, ResultConversion } from "../types";

export type ResultVM = {
  primary: { formatted: string; unit?: string; type: string };
  chips: Array<{ unit: string; display: string }>;
  // “escopo” sugerido para salvar a sticky quando usuário tocar num chip
  stickyScope?: { kind: "var"; name: string } | { kind: "type"; type: string };
};

/**
 * Aplica preferências de unidade (se disponíveis) sem reavaliar o cálculo.
 * Estratégia: se houver uma conversão com a unidade preferida, promove-a a "primary".
 * Mantém `formatted` e `display` do evaluator (sem parse numérico).
 */
export async function buildResultVM(
  raw: CalculationResult,
  opts?: {
    sheetId: string;
    sticky: {
      getPreferredUnit(
        scope: { kind: "var"; name: string } | { kind: "type"; type: string }
      ): Promise<string | null>;
    };
    variableName?: string; // quando o resultado vem de var atribuída (para escopo var)
  }
): Promise<ResultVM> {
  const { type } = raw;
  const originalUnit = raw.unit;
  const chips = raw.conversions ?? [];

  // define escopos candidatos
  const scopes: Array<
    { kind: "var"; name: string } | { kind: "type"; type: string }
  > = [];
  if (opts?.variableName) scopes.push({ kind: "var", name: opts.variableName });
  scopes.push({ kind: "type", type }); // fallback por tipo

  // resolve primeira sticky unit disponível
  let desired: string | null = null;
  if (opts?.sticky) {
    for (const sc of scopes) {
      const pref = await opts.sticky.getPreferredUnit(sc as any);
      if (pref) {
        desired = pref;
        break;
      }
    }
  }

  // se desejada existe entre os chips, promovemos
  if (
    desired &&
    chips.some((c) => c.unit.toLowerCase() === desired!.toLowerCase())
  ) {
    const chosen: ResultConversion | undefined = chips.find(
      (c) => c.unit.toLowerCase() === desired!.toLowerCase()
    );
    const rest = chips.filter((c) => c !== chosen);
    return {
      primary: {
        formatted: chosen!.display.split(" ")[0],
        unit: chosen!.unit,
        type,
      },
      chips: [
        // o original vira chip adicional (se tiver unit)
        ...(originalUnit
          ? [
              {
                unit: originalUnit,
                display: `${raw.formatted} ${originalUnit}`,
              },
            ]
          : []),
        ...rest,
      ],
      stickyScope: scopes[0],
    };
  }

  // fallback: mantém original como primary
  return {
    primary: { formatted: raw.formatted, unit: originalUnit, type },
    chips,
    stickyScope: scopes[0],
  };
}
