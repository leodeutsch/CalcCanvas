export const guessVarFromExpr = (
  expr: string,
  knownVars: string[]
): string | null => {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sorted = [...knownVars].sort((a, b) => b.length - a.length);
  return (
    sorted.find((name) => new RegExp(`\\b${esc(name)}\\b`, "i").test(expr)) ||
    null
  );
};
