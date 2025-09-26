// datetime.ts — parsing leve de frases de data/duração

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

export const formatDateResult = (d: Date): string => {
  // ISO curto: YYYY-MM-DD HH:mm
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(
    d.getDate()
  )} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// ---------- BETWEEN ----------
export const isBetweenExpression = (s: string): boolean =>
  /\bbetween\s+.+?\s+and\s+.+/i.test(s);

const parseLooseDate = (token: string): Date | null => {
  // tenta ISO, YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
  const t = token.trim();
  // ISO/Date.parse fallback
  const byNative = new Date(t);
  if (!isNaN(byNative.getTime())) return byNative;

  // DD/MM/YYYY
  const br = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (br) {
    const d = parseInt(br[1], 10),
      m = parseInt(br[2], 10) - 1,
      y = parseInt(br[3], 10);
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) return dt;
  }

  return null;
};

export const evalBetweenExpression = (
  s: string
): null | {
  ms: number;
  days: number;
  hours: number;
  weeks: number;
  aISO: string;
  bISO: string;
  formatted: string;
} => {
  const m = s.match(/\bbetween\s+(.+?)\s+and\s+(.+)\b/i);
  if (!m) return null;
  const a = parseLooseDate(m[1]);
  const b = parseLooseDate(m[2]);
  if (!a || !b) return null;
  const ms = Math.abs(b.getTime() - a.getTime());
  const days = ms / 86400000;
  const hours = ms / 3600000;
  const weeks = days / 7;
  const formatted = `${Math.round(days)} days (${weeks.toFixed(1)} weeks)`;
  return {
    ms,
    days,
    hours,
    weeks,
    aISO: a.toISOString(),
    bISO: b.toISOString(),
    formatted,
  };
};

// ---------- NEXT WEEKDAY / RELATIVE OPS ----------
const nextWeekday = (start: Date, name: string): Date => {
  const idx = WEEKDAYS.indexOf(name.toLowerCase());
  if (idx < 0) return start;
  const d0 = start.getDay();
  const delta = (idx + 7 - d0) % 7 || 7;
  const out = new Date(start);
  out.setDate(out.getDate() + delta);
  return out;
};

const addRel = (d: Date, op: string, n: number): Date => {
  const out = new Date(d);
  if (op === "d") out.setDate(out.getDate() + n);
  else if (op === "w") out.setDate(out.getDate() + n * 7);
  else if (op === "m") out.setMonth(out.getMonth() + n);
  else if (op === "y") out.setFullYear(out.getFullYear() + n);
  return out;
};

const workdaysFrom = (start: Date, n: number): Date => {
  let count = 0;
  const out = new Date(start);
  while (count < n) {
    out.setDate(out.getDate() + 1);
    const dow = out.getDay();
    if (dow !== 0 && dow !== 6) count++; // pula dom(0)/sab(6)
  }
  return out;
};

// ---------- Public API expected by evaluator ----------
export const isDateExpression = (s: string): boolean => {
  return (
    isBetweenExpression(s) ||
    /\bnext\s+(?:sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(
      s
    ) ||
    /\bworkdays?\s*\(\s*\-?\d+\s*\)\s+from\s+(today|tomorrow|yesterday|\d{4}-\d{2}-\d{2})\b/i.test(
      s
    ) ||
    /\btoday\b/i.test(s) ||
    /\bnow\b/i.test(s) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(s)
  );
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const resolveAnchor = (tok: string): Date => {
  const today = startOfDay(new Date());
  const t = tok.toLowerCase();
  if (t === "today") return today;
  if (t === "tomorrow") return new Date(today.getTime() + 86400000);
  if (t === "yesterday") return new Date(today.getTime() - 86400000);
  // assume ISO YYYY-MM-DD
  const d = startOfDay(new Date(tok));
  return isNaN(d.getTime()) ? today : d;
};

export const parseDateExpression = (s: string): null | { date: Date } => {
  const now = new Date();

  // today / now
  if (/\b(now|today)\b/i.test(s)) return { date: now };

  // next <weekday> [+ N(d|w|m|y)]
  const mNext = s.match(
    /\bnext\s+(sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
  );
  if (mNext) {
    const target = mNext[1]
      .replace(/^sun$/i, "sunday")
      .replace(/^mon$/i, "monday")
      .replace(/^tue$/i, "tuesday")
      .replace(/^wed$/i, "wednesday")
      .replace(/^thu$/i, "thursday")
      .replace(/^fri$/i, "friday")
      .replace(/^sat$/i, "saturday");
    let d = nextWeekday(now, target);
    // optional "+ 3w" etc
    const mPlus = s.match(/\+\s*(\d+)\s*([dwmy])/i);
    if (mPlus) {
      d = addRel(d, mPlus[2].toLowerCase(), parseInt(mPlus[1], 10));
    }
    return { date: d };
  }

  // workdays(n) from today
  const mW = s.match(
    /\bworkdays?\s*\(\s*(\-?\d+)\s*\)\s+from\s+(today|tomorrow|yesterday|\d{4}-\d{2}-\d{2})\b/i
  );
  if (mW) {
    const n = parseInt(mW[1], 10);
    const anchor = resolveAnchor(mW[2]);
    return { date: workdaysFrom(anchor, n) };
  }

  // ISO date literal
  const mISO = s.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (mISO) {
    const d = new Date(mISO[1]);
    if (!isNaN(d.getTime())) return { date: d };
  }

  return null;
};

export const parseDateOperations = (
  _s: string
): Array<{ op: "add"; unit: "d" | "w" | "m" | "y"; n: number }> => {
  // já cobrimos no parse principal; manter compat com assinatura
  const ops: Array<{ op: "add"; unit: "d" | "w" | "m" | "y"; n: number }> = [];
  const mPlus = _s.match(/\+\s*(\d+)\s*([dwmy])/i);
  if (mPlus)
    ops.push({
      op: "add",
      unit: mPlus[2].toLowerCase() as any,
      n: parseInt(mPlus[1], 10),
    });
  return ops;
};

export const applyDateOperations = (
  d: Date,
  ops: Array<{ op: "add"; unit: "d" | "w" | "m" | "y"; n: number }>
): Date => {
  let out = new Date(d);
  for (const o of ops) {
    out = addRel(out, o.unit, o.n);
  }
  return out;
};
