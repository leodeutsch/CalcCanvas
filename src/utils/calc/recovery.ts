export type RecoveryInfo = {
  suggestions: string[];
  partial: Array<{ expr: string; value: number }>;
  unknownTokens: string[];
  normalizedExpression?: string;
};

const UNKNOWN_WORDS = /[A-Za-z_]+/g;

/** Extrai termos alfabéticos “desconhecidos” */
export const findUnknownTokens = (input: string): string[] => {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(UNKNOWN_WORDS);
  while ((m = re.exec(input))) {
    const w = m[0].toLowerCase();
    // ignora conectores comuns
    if (
      [
        "and",
        "of",
        "on",
        "off",
        "each",
        "per",
        "at",
        "to",
        "in",
        "from",
        "next",
        "between",
        "and",
      ].includes(w)
    )
      continue;
    if (w.length > 1) out.add(w);
  }
  return Array.from(out).slice(0, 8);
};

/** Tenta avaliar subexpressões numéricas separadas por palavras desconhecidas */
export const evaluatePartials = (
  sanitized: string,
  mathEval: (s: string) => number
): Array<{ expr: string; value: number }> => {
  // Quebra onde restaram letras (depois da sanitização do chamador)
  const chunks = sanitized
    .split(/[A-Za-z_]+/)
    .map((c) => c.trim())
    .filter(Boolean);
  const out: Array<{ expr: string; value: number }> = [];
  for (const ch of chunks) {
    try {
      if (!/[\d()]/.test(ch)) continue;
      const v = mathEval(ch);
      if (Number.isFinite(v)) out.push({ expr: ch, value: v });
    } catch {}
    if (out.length >= 5) break;
  }
  return out;
};

/** Sugestões genéricas úteis pro domínio do app */
export const buildSuggestions = (input: string): string[] => {
  const s: string[] = [];

  // Deals
  if (/\bfor\s+\d/.test(input) && /\b\d+(\.\d+)?\s+[a-z]/i.test(input)) {
    s.push("Tente algo como: `5 bags for 400 USD` → ou `5 @ 80 USD`.");
  }
  if (
    /\b@\s*\d/.test(input) &&
    !/\/(kg|g|lb|oz|l|ml|m|cm|mm)\b/i.test(input) &&
    /\b(kg|g|lb|oz|l|ml|m|cm|mm)\b/i.test(input)
  ) {
    s.push(
      "Para preço por unidade física, use `/kg`, `/g`, `/l`, etc. Ex.: `2.5 kg @ 15 BRL/kg`."
    );
  }

  // Percent
  if (/%/.test(input) && !/\bof\b|\bon\b|\boff\b/i.test(input)) {
    s.push("Percentuais: use `10% of 250` ou `15% on 200` ou `20% off 300`.");
  }

  // Ranges & lists
  if (/\b\d+\s*\.\.\s*\d+/.test(input)) {
    s.push("Para somar intervalo: `sum 1..10`. Média: `avg 1..10`.");
  }
  if (/\b\d+\s*,\s*\d+/.test(input)) {
    s.push("Listas: `sum 2, 5, 9` ou `avg 2, 5, 9`.");
  }

  // Dates
  if (/between\s+/i.test(input)) {
    s.push("Datas: `between 2024-01-03 and 2025-02-10` retorna a duração.");
  }
  if (/next\s+/i.test(input)) {
    s.push("Datas relativas: `next monday + 3w`.");
  }
  return s.slice(0, 5);
};
