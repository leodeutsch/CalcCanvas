import { makeLRU } from "./memo";

type Pair = [RegExp, string];

const UNIT_ALIASES: Pair[] = [
  // comprimento
  [/\bquil[oô]metros?\b/gi, " km "],
  [/\bkilometres?\b/gi, " km "],
  [/\bmetros?\b/gi, " m "],
  [/\bmetres?\b/gi, " m "],
  [/\bcentimetros?\b/gi, " cm "],
  [/\bcentimetres?\b/gi, " cm "],
  [/\bmilimetros?\b/gi, " mm "],
  [/\bmilimetres?\b/gi, " mm "],
  [/\bp[ée]s\b/gi, " ft "],
  [/\bp[ée]\b/gi, " ft "], // pé singular
  [/\bpolegadas?\b/gi, " in "],
  [/\bjardas?\b/gi, " yd "],
  [/\bmilhas?\b/gi, " mi "],

  // massa
  [/\bgramas?\b/gi, " g "],
  [/\bquilogramas?\b/gi, " kg "],
  [/\blibras?\b/gi, " lb "],
  [/\bon[cç]as?\b/gi, " oz "],

  // volume
  [/\blitros?\b/gi, " l "],
  [/\bmillilitros?\b/gi, " ml "],
  [/\bmililitros?\b/gi, " ml "],
  [/\bgalo[eõ]es?\b/gi, " gal "], // se vier a suportar gal futuramente

  // velocidade
  [/\bkmh\b/gi, " km/h "],
  [/\bkph\b/gi, " km/h "],
  [/\bmph\b/gi, " mph "],

  // temperatura
  [/\bcel(si(u|o))?s\b/gi, " c "],
  [/\bfahrenheit\b/gi, " f "],
  [/\bkelvin\b/gi, " k "],

  // tempo
  [/\bsegundos?\b/gi, " s "],
  [/\bminutos?\b/gi, " min "],
  [/\bhoras?\b/gi, " h "],
  [/\bdias?\b/gi, " d "],
  [/\bsemanas?\b/gi, " wk "],
];

const CURRENCY_ALIASES: Pair[] = [
  [/\breais?\b/gi, " BRL "],
  [/\breal\b/gi, " BRL "],
  [/\bd[oó]lares?\b/gi, " USD "],
  [/\beuros?\b/gi, " EUR "],
  [/\blibras?\b/gi, " GBP "],
  [/\byen(es)?\b/gi, " JPY "],
  [/\bfrancos?\b/gi, " CHF "],
];

const cache = makeLRU<string, string>(512);

export const normalizeUnitAndCurrencyAliases = (input: string): string => {
  const hit = cache.get(input);
  if (hit) return hit;

  let s = ` ${input} `;
  for (const [re, rep] of UNIT_ALIASES) s = s.replace(re, rep);
  for (const [re, rep] of CURRENCY_ALIASES) s = s.replace(re, rep);
  s = s.replace(/\s+/g, " ").trim();

  cache.set(input, s);
  return s;
};
