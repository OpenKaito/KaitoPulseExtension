import { stableHash } from "../hash";

const AVATAR_COLORS = ["#f7931a", "#627eea", "#00d4aa", "#ff6b9d", "#845ef7", "#20c997", "#fa5252", "#4dabf7"];

export function monogramColor(symbol: string): string {
  const seed = parseInt(stableHash(symbol), 36) >>> 0;
  return AVATAR_COLORS[seed % AVATAR_COLORS.length];
}

export function monogramLetter(symbol: string): string {
  return symbol.charAt(0).toUpperCase();
}
