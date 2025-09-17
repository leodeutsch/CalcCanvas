export type DateOperation = {
  type: "add" | "subtract";
  value: number;
  unit: string;
};

const UNIT_ALIASES: Record<string, string> = {
  day: "day",
  days: "day",
  d: "day",
  week: "week",
  weeks: "week",
  w: "week",
  month: "month",
  months: "month",
  mo: "month",
  year: "year",
  years: "year",
  y: "year",
  hour: "hour",
  hours: "hour",
  h: "hour",
  minute: "minute",
  minutes: "minute",
  min: "minute",
};

const UNIT_TO_MILLISECONDS: Record<string, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  minute: 60 * 1000,
};

const DATE_KEYWORDS = ["today", "tomorrow", "yesterday"];

const parseDateKeyword = (keyword: string, reference: Date): Date => {
  switch (keyword.toLowerCase()) {
    case "today":
      return reference;
    case "tomorrow":
      return new Date(reference.getTime() + UNIT_TO_MILLISECONDS.day);
    case "yesterday":
      return new Date(reference.getTime() - UNIT_TO_MILLISECONDS.day);
    default:
      return reference;
  }
};

export const parseDateExpression = (
  expression: string,
  reference = new Date()
): { date: Date; consumed: string } | null => {
  const lower = expression.toLowerCase();

  // Direct ISO date or natural keyword
  for (const keyword of DATE_KEYWORDS) {
    if (lower.startsWith(keyword)) {
      return { date: parseDateKeyword(keyword, reference), consumed: keyword };
    }
  }

  // Check for explicit date format (YYYY-MM-DD)
  const isoMatch = expression.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    const parsed = new Date(isoMatch[1]);
    if (!isNaN(parsed.getTime())) {
      return { date: parsed, consumed: isoMatch[1] };
    }
  }

  // TODO: extend with more natural date parsing if needed.
  return null;
};

export const parseDateOperations = (expression: string): DateOperation[] => {
  const operations: DateOperation[] = [];
  const regex = /(\+|\-)\s*(\d+(?:\.\d+)?)\s*([a-z]+)/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(expression))) {
    const [, operator, valueRaw, unitRaw] = match;
    const normalizedUnit = UNIT_ALIASES[unitRaw.toLowerCase()];
    if (!normalizedUnit) {
      continue;
    }

    operations.push({
      type: operator === "-" ? "subtract" : "add",
      value: Number.parseFloat(valueRaw),
      unit: normalizedUnit,
    });
  }

  return operations;
};

export const applyDateOperations = (date: Date, operations: DateOperation[]): Date => {
  return operations.reduce((current, operation) => {
    const multiplier = operation.type === "subtract" ? -1 : 1;
    const unitMillis = UNIT_TO_MILLISECONDS[operation.unit];
    if (!unitMillis) {
      return current;
    }

    const delta = operation.value * unitMillis * multiplier;
    return new Date(current.getTime() + delta);
  }, date);
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ordinal = (value: number) => {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) {
    return `${value}th`;
  }
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
};

export const formatDateResult = (date: Date): string => {
  const month = MONTH_NAMES[date.getMonth()];
  const day = ordinal(date.getDate());
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
};

export const isDateExpression = (input: string): boolean => {
  const lower = input.trim().toLowerCase();
  return DATE_KEYWORDS.some((keyword) => lower.includes(keyword)) || /\d{4}-\d{2}-\d{2}/.test(lower);
};
