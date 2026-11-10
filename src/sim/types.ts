/** Schadensarten als Bitmaske (für Immunitäten). */
export const DMG = {
  NORMAL: 0,
  SHARP: 1,
  EXPLOSION: 2,
  FROST: 4,
  ENERGY: 8,
  FIRE: 16,
} as const;

export const DMG_NAMES: Record<number, string> = {
  0: 'Normal',
  1: 'Scharf',
  2: 'Explosion',
  4: 'Frost',
  8: 'Energie',
  16: 'Feuer',
};

/** Gegner-Eigenschaften (Bitflags). */
export const FLAG = {
  CAMO: 1,
  REGROW: 2,
  FORTIFIED: 4,
} as const;
