export type DimKind =
  | "currency"
  | "mass"
  | "length"
  | "area"
  | "volume"
  | "temperature"
  | "data"
  | "css"
  | "speed"
  | "angle"
  | "duration"
  | "dimensionless";

const RE = {
  currency: /\b([A-Z]{3})\b/g, // já canônicas (USD, BRL, EUR…)
  mass: /\b(mg|g|kg|lb|oz)\b/gi,
  length: /\b(mm|cm|m|km|in|ft|yd|mi)\b/gi,
  area: /\b(mm2|cm2|m2|km2|in2|ft2|yd2|mi2|mm²|cm²|m²|km²|in²|ft²|yd²|mi²)\b/gi,
  volume: /\b(mm3|cm3|m3|in3|ft3|yd3|km3|ml|l|m³|cm³|mm³|in³|ft³|yd³|km³)\b/gi,
  temperature: /\b(c|°c|f|°f|k|°k)\b/gi,
  data: /\b(b|kb|mb|gb|tb|kib|mib|gib|tib)\b/gi,
  css: /\b(px|pt|em)\b/gi,
  speed: /\b(m\/s|km\/h|kph|mph|kn)\b/gi,
  angle: /\b(deg|rad|turn|degrees|radians|turns)\b/gi,
  duration: /\b(ms|s|sec|min|h|hr|d|day|days|wk|week|weeks)\b/gi,
};

const PLUS_MINUS = /(^|[^*\/])\s[+\-]\s/;
const TIMES = /\*/;
const DIV = /\//;

export type DimAnalysis = {
  kindsFound: Set<DimKind>;
  hasAddSub: boolean;
  hasMul: boolean;
  hasDiv: boolean;
  composite?: string; // ex.: "BRL/kg", "kg·m", "m/s"
  addSubConflicts?: Array<{ left: DimKind; right: DimKind }>;
};

/** Mapeia tokens encontrados → kinds */
const detectKinds = (s: string): Set<DimKind> => {
  const kinds = new Set<DimKind>();
  const addIf = (re: RegExp, kind: DimKind) => {
    re.lastIndex = 0;
    if (re.test(s)) kinds.add(kind);
  };
  addIf(RE.currency, "currency");
  addIf(RE.mass, "mass");
  addIf(RE.area, "area");
  addIf(RE.volume, "volume");
  addIf(RE.length, "length");
  addIf(RE.temperature, "temperature");
  addIf(RE.data, "data");
  addIf(RE.css, "css");
  addIf(RE.speed, "speed");
  addIf(RE.angle, "angle");
  addIf(RE.duration, "duration");
  if (kinds.size === 0) kinds.add("dimensionless");
  return kinds;
};

/** Define compatibilidade de +/−: só mesmo kind pode somar/subtrair */
const isAdditiveCompatible = (a: DimKind, b: DimKind): boolean => a === b;

/** Tenta inferir uma “composite label” simples para * e / */
const inferComposite = (s: string): string | undefined => {
  // heurística simples: ache primeiro par unidade / unidade ou unidade * unidade
  const unitToken =
    "(?:[A-Z]{3}|mm|cm|m|km|in|ft|yd|mi|mg|g|kg|lb|oz|ml|l|px|pt|em|b|kb|mb|gb|tb|kib|mib|gib|tib|deg|rad|turn|m\\/s|km\\/h|mph|kn)";
  const rDiv = new RegExp(
    `\\b${unitToken}\\b\\s*\\/\\s*\\b${unitToken}\\b`,
    "i"
  );
  const rMul = new RegExp(
    `\\b${unitToken}\\b\\s*\\*\\s*\\b${unitToken}\\b`,
    "i"
  );
  const m1 = s.match(rDiv);
  if (m1) return m1[0].replace(/\s+/g, "");
  const m2 = s.match(rMul);
  if (m2) return m2[0].replace(/\s+/g, "").replace("*", "·");
  return undefined;
};

export const analyzeDimensions = (inputOriginal: string): DimAnalysis => {
  const s = ` ${inputOriginal} `;
  const kindsFound = detectKinds(s);
  const hasAddSub = PLUS_MINUS.test(` ${s} `);
  const hasMul = TIMES.test(s);
  const hasDiv = DIV.test(s);

  const addSubConflicts: Array<{ left: DimKind; right: DimKind }> = [];
  if (hasAddSub && kindsFound.size > 1) {
    // conflitos: qualquer par de kinds distintos
    const kinds = Array.from(kindsFound);
    for (let i = 0; i < kinds.length; i++) {
      for (let j = i + 1; j < kinds.length; j++) {
        if (!isAdditiveCompatible(kinds[i], kinds[j])) {
          addSubConflicts.push({ left: kinds[i], right: kinds[j] });
        }
      }
    }
  }

  const composite = hasMul || hasDiv ? inferComposite(s) : undefined;

  return {
    kindsFound,
    hasAddSub,
    hasMul,
    hasDiv,
    composite,
    addSubConflicts: addSubConflicts.length ? addSubConflicts : undefined,
  };
};
