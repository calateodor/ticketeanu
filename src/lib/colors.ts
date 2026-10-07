// Paleta site-ului e fixă (docs/directie-vizuala.md). Culoarea organizatorului nu intră în gradient;
// ea apare doar pe butonul de rezervare, pe bara de jos și pe cipuri.

export const SITE = {
  night: "#120A1F",
  night2: "#1B1030",
  flame: "#FF7A1A",
  neon: "#FF2E8A",
  violet: "#7B2FE0",
  deep: "#3B1D8F",
  lime: "#E9FF4F",
  muted: "#B9A9D6",
} as const;

export const SITE_GRADIENT = `linear-gradient(160deg, ${SITE.flame} 0%, ${SITE.neon} 40%, ${SITE.violet} 78%, ${SITE.deep} 100%)`;

// Pentru text pe gradient (titlurile cu „fără oameni.”): aceeași curgere, pe orizontală.
export const TEXT_GRADIENT = `linear-gradient(90deg, ${SITE.flame}, ${SITE.neon} 45%, ${SITE.violet})`;
