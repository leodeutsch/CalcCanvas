// Range sugar for sum/avg: sum(1..10), avg(#1..#5), sum(2..10 step 2)

type RangeSpec = { start: string; end: string; step?: string };

// Parses "a..b" or "a..b step s"
const parseRange = (s: string): RangeSpec | null => {
  const m = s.match(
    /^\s*([^.\s][^)]*?)\s*\.\.\s*([^)\s]+)(?:\s+step\s+([^)\s]+))?\s*$/i
  );
  if (!m) return null;
  return { start: m[1], end: m[2], step: m[3] };
};

// Expands sum( a..b [step s] ) to sum(a, a+s, ..., b) using arithmetic series formula when possible
export const expandSumRanges = (expr: string): string =>
  expr.replace(/\bsum\s*\(\s*([^)]*?)\s*\)/gi, (_m, inner) => {
    const r = parseRange(inner);
    if (!r) return `sum(${inner})`;

    const s = r.step ?? "1";
    const canNumber = (x: string) => /^-?\d+(\.\d+)?$/.test(x.trim());

    if (canNumber(r.start) && canNumber(r.end) && canNumber(s)) {
      const start = parseFloat(r.start),
        end = parseFloat(r.end),
        step = parseFloat(s);
      if (step === 0) return `sum(${inner})`;
      const n = Math.floor((end - start) / step) + 1;
      if (n <= 0 || !Number.isFinite(n)) return `sum(${inner})`;
      // arithmetic series: n/2 * (2a + (n-1)d)
      return `(${n}/2) * ((${2 * start}) + ((${n}-1)*${step}))`;
    }
    // fallback: sum(a, a+step, ..., end) not trivial → keep function, mathjs can handle sum(list)
    return `sum(${inner})`;
  });

// Expands avg( a..b [step s] ) to sum(...) / count
export const expandAvgRanges = (expr: string): string =>
  expr.replace(/\bavg\s*\(\s*([^)]*?)\s*\)/gi, (_m, inner) => {
    const r = parseRange(inner);
    if (!r) return `avg(${inner})`;

    const s = r.step ?? "1";
    const canNumber = (x: string) => /^-?\d+(\.\d+)?$/.test(x.trim());

    if (canNumber(r.start) && canNumber(r.end) && canNumber(s)) {
      const start = parseFloat(r.start),
        end = parseFloat(r.end),
        step = parseFloat(s);
      if (step === 0) return `avg(${inner})`;
      const n = Math.floor((end - start) / step) + 1;
      if (n <= 0 || !Number.isFinite(n)) return `avg(${inner})`;
      const sum = `(${n}/2) * ((${2 * start}) + ((${n}-1)*${step}))`;
      return `( ${sum} / ${n} )`;
    }
    return `avg(${inner})`;
  });
