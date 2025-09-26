export const LIMITS = {
  MAX_EXPR_LEN: 10_000, // caracteres
  MAX_PARENS_DEPTH: 64, // segurança contra nesting patológico
  MAX_LIST_ITEMS: 10_000, // "sum(…)" com lista
  MAX_RANGE_TERMS: 100_000, // "1..N" expandido
};

export const checkExpressionGuards = (s: string): string | null => {
  if (s.length > LIMITS.MAX_EXPR_LEN) return "Expression too long";

  // profundidade de parênteses
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth > LIMITS.MAX_PARENS_DEPTH) return "Too many nested parentheses";
    if (depth < -1) return "Unbalanced parentheses";
  }
  if (depth !== 0) return "Unbalanced parentheses";

  // listas: conta vírgulas no maior parêntese nível 1
  const mList = s.match(/\(([^()]*)\)/g);
  if (mList) {
    for (const seg of mList) {
      const items = seg.split(",").length;
      if (items > LIMITS.MAX_LIST_ITEMS) return "List too large";
    }
  }

  // ranges "a..b" — estima termos quando inteiros
  const r = s.match(/\b(-?\d+)\s*\.\.\s*(-?\d+)\b/);
  if (r) {
    const a = parseInt(r[1], 10),
      b = parseInt(r[2], 10);
    const terms = Math.abs(b - a) + 1;
    if (Number.isFinite(terms) && terms > LIMITS.MAX_RANGE_TERMS)
      return "Range too large";
  }

  return null;
};
