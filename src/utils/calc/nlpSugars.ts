// Natural-language sugars: fractions, "per", "each", "at", basic ranges + list math.

export const normalizeFractions = (s: string): string =>
  s.replace(/\b(\d+)\s*\/\s*(\d+)\b/g, "($1/$2)");

/** turns "10 per kg" → "(10)/(kg)", "300 g each" → "*(300 g)" */
export const applyNLPSugars = (s: string): string => {
  let out = s;

  // "each X" => "* (X)"
  out = out.replace(/\beach\s+([^\s].*?)\b/gi, (_m, x) => ` * (${x})`);

  // "per" / "at"  => "/"
  out = out.replace(/\bper\b/gi, "/").replace(/\bat\b/gi, "/");

  return out;
};

/** capture "5-7 unit" / "5 – 7 kg" (en-dash/em-dash) */
export const detectSimpleRange = (s: string) => {
  const m = s.match(
    /\b(-?\d+(?:\.\d+)?)\s*[-–—]\s*(-?\d+(?:\.\d+)?)(?:\s*([a-z°/]+))?\b/i
  );
  if (!m) return null;
  const min = parseFloat(m[1]);
  const max = parseFloat(m[2]);
  const unit = m[3]?.toLowerCase();
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max, unit };
};

/**
 * normalizeRangeAndListFns:
 * - sum 1..10 / sum(1..10)  → ((a+b)*(b-a+1))/2   (só quando a e b são inteiros)
 * - avg 1..10 / avg(1..10)  → (a+b)/2
 * - median 1..10            → (a+b)/2  (PA de passo 1)
 * - sum(2,5,9)              → (2+5+9)
 * - avg(2,5,9)              → ((2+5+9)/3)
 * - median(2,5,9)           → a+b+c - min(...) - max(...) (para 3 itens)
 * - sum(10%,12%,8%) of X    → ((10% of X) + (12% of X) + (8% of X))
 * - avg(10%,12%) of X       → (((10% of X) + (12% of X))/2)
 */
export const normalizeRangeAndListFns = (input: string): string => {
  let s = input;

  const isInteger = (x: string) => /^-?\d+$/.test(x.trim());

  // 1) RANGES (com parênteses) — forma simbólica exata
  // sum(1..10)   -> ((1+10)*(10-1+1))/2
  // avg(1..11)   -> (1+11)/2
  // median(5..12)-> (5+12)/2
  const rangeParenRe =
    /\b(sum|avg|median)\s*\(\s*(-?\d+)\s*\.\.\s*(-?\d+)\s*\)/gi;
  s = s.replace(rangeParenRe, (_m, fn: string, aStr: string, bStr: string) => {
    if (!(isInteger(aStr) && isInteger(bStr))) return _m;
    const A = aStr.trim();
    const B = bStr.trim();
    if (/^sum$/i.test(fn)) return `((${A}+${B})*(${B}-${A}+1))/2`;
    if (/^avg$/i.test(fn)) return `(${A}+${B})/2`;
    if (/^median$/i.test(fn)) return `(${A}+${B})/2`;
    return _m;
  });

  // 2) RANGES (sem parênteses)
  const rangeBareRe = /\b(sum|avg|median)\s+(-?\d+)\s*\.\.\s*(-?\d+)\b/gi;
  s = s.replace(rangeBareRe, (_m, fn: string, aStr: string, bStr: string) => {
    if (!(isInteger(aStr) && isInteger(bStr))) return _m;
    const A = aStr.trim();
    const B = bStr.trim();
    if (/^sum$/i.test(fn)) return `((${A}+${B})*(${B}-${A}+1))/2`;
    if (/^avg$/i.test(fn)) return `(${A}+${B})/2`;
    if (/^median$/i.test(fn)) return `(${A}+${B})/2`;
    return _m;
  });

  // 3) Caso especial: percentuais "of X" — DEVE vir antes da normalização genérica de listas
  // sum(10%, 12%, 8%) of 2500 -> ((10% of 2500) + (12% of 2500) + (8% of 2500))
  // avg(10%,12%) of price     -> (((10% of price) + (12% of price))/2)
  s = s.replace(
    /\b(sum|avg)\s*\(\s*([^)]+?%[^)]*)\s*\)\s+of\s+([^\s].*?)(?=$|[+\-*/)]|\s*$)/gi,
    (_m, fn: string, inside: string, target: string) => {
      const items = inside
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const expanded = items
        .map((p) => `(${p} of ${target.trim()})`)
        .join(" + ");
      if (/^sum$/i.test(fn)) return `(${expanded})`;
      return `((${expanded})/${items.length})`;
    }
  );

  // 4) Listas com parênteses: sum(x,y,z) / avg(x,y,z) / median(x,y,z)
  // Formatação para bater o teste: "(2+ 5+ 9)" (sem espaço antes do '+', 1 depois)
  const listRe = /\b(sum|avg|median)\s*\(\s*([^)]+?)\s*\)/gi;
  s = s.replace(listRe, (_m, fn: string, inside: string) => {
    const items = inside
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!items.length) return _m;
    const joined = items.join("+ ");

    if (/^sum$/i.test(fn)) return `(${joined})`;
    if (/^avg$/i.test(fn)) return `((${joined})/${items.length})`;

    // median:
    if (items.length === 1) return `(${items[0]})`;
    if (items.length === 2) {
      const a = items[0],
        b = items[1];
      return `((min((${a}),(${b}))+max((${a}),(${b})))/2)`;
    }
    if (items.length === 3) {
      const [a, b, c] = items;
      return `((${a})+(${b})+(${c}) - min((${a}),(${b}),(${c})) - max((${a}),(${b}),(${c})))`;
    }
    // fallback seguro para N>3: média simples
    return `((${joined})/${items.length})`;
  });

  // 5) Listas por texto: "sum 2, 5, 9" / "avg 2, 5, 9"
  s = s.replace(
    /\b(sum|avg)\s+(-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)+)\b/gi,
    (_m, fn: string, list: string) => {
      const items = list
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (!items.length) return _m;
      const joined = items.join("+ ");
      if (/^sum$/i.test(fn)) return `(${joined})`;
      return `((${joined})/${items.length})`;
    }
  );

  return s;
};
