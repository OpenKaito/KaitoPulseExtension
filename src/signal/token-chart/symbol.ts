
const CASHTAG_SYMBOL_RE = /^[A-Z0-9]{1,20}$/;

export function normalizeCashtagSymbol(text: string | null | undefined): string | null {
  if (!text) return null;
  const stripped = text.trim().replace(/^\$/, "").toUpperCase();
  return CASHTAG_SYMBOL_RE.test(stripped) ? stripped : null;
}
