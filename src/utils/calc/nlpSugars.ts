// Natural-language sugars: fractions, "per", "each", "at", basic ranges.

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
