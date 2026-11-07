/**
 * The initials shown on a tile, and the tint behind them.
 *
 * A tile gives a profile or a board something to recognise at a glance. It is decoration, never the
 * only thing naming the row: the full name is always written beside it, the letters are hidden from
 * screen readers, and High contrast mode replaces the tint with a plain bordered tile.
 */

/** The soft backgrounds a tile's initials can sit on. */
export const MONOGRAM_TINTS: { background: string; foreground: string }[] = [
  { background: '#E3F2FD', foreground: '#0B4A6F' },
  { background: '#E8F5E9', foreground: '#1B5E20' },
  { background: '#FFF3E0', foreground: '#8A4B00' },
  { background: '#F3E5F5', foreground: '#5B2C6F' },
  { background: '#FCE4EC', foreground: '#8E1B3A' },
  { background: '#E0F7FA', foreground: '#00636B' },
];

/**
 * The one or two letters shown on a tile.
 *
 * Two initials where the name has two words ("Personal Care" -> "PC"), otherwise the first two
 * letters. A blank name still returns something so a tile is never empty.
 */
export function initials(text: string): string {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

/** A stable tint per id, so a tile keeps the same colour as long as the row exists. */
export function monogramTint(seed: string): { background: string; foreground: string } {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash + seed.charCodeAt(index)) % MONOGRAM_TINTS.length;
  }
  return MONOGRAM_TINTS[hash];
}
