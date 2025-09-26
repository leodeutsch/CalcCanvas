import type { MarketDataState } from "../../hooks/useMarketData";
import { evaluateInput, type EvalContext } from "../evaluator"; // ajuste o caminho
import {
  exportVarsFromSheet,
  getAllVars,
  parseAssignmentLine,
  setVar,
} from "./varStore";

export type CommandResult =
  | { kind: "assign"; name: string; stored: boolean }
  | { kind: "import"; sheet: string; count: number }
  | { kind: "calc"; evaluation: ReturnType<typeof evaluateInput> };

const IMPORT_RE = /^\s*import\s+vars\s+from\s+["'](.+?)["']\s*$/i;

export const evaluateLineOrCommand = (
  rawLine: string,
  marketData: MarketDataState,
  previousValues: number[],
  sheetId?: string,
  options?: Parameters<typeof evaluateInput>[3]
): CommandResult => {
  const line = rawLine.trim();

  // 1) Assignment: "foo = 300 g  # note"
  const assign = parseAssignmentLine(line);
  if (assign) {
    setVar(assign.name, assign.value, { sheetId });
    return { kind: "assign", name: assign.name, stored: true };
  }

  // 2) Import vars: 'import vars from "SheetX"'
  const m = line.match(IMPORT_RE);
  if (m) {
    const fromSheet = m[1];
    const vars = exportVarsFromSheet(fromSheet);
    // mescla com as vars do sheet atual (ficará a cargo do caller passar merged no ctx)
    Object.entries(vars).forEach(([k, v]) => setVar(k, v, { sheetId }));
    const count = Object.keys(vars).length;
    return { kind: "import", sheet: fromSheet, count };
  }

  // 3) Cálculo normal (passa todas as variáveis do sheet como ctx.variables)
  const vars = getAllVars({ sheetId });
  const ctx: EvalContext = { previousValues, variables: vars };
  const evaluation = evaluateInput(line, marketData, ctx, options);
  return { kind: "calc", evaluation };
};
