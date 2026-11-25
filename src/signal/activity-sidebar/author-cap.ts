export const MAX_CONSECUTIVE_PER_AUTHOR = 2;

export function capConsecutiveByAuthor<T extends { handle: string }>(
  rows: T[],
  max: number,
  weightOf: (row: T) => number = () => 0,
): T[] {
  const out: T[] = [];
  let i = 0;
  while (i < rows.length) {
    const handle = rows[i].handle || '';
    if (handle === '') {
      out.push(rows[i]);
      i += 1;
      continue;
    }
    let j = i;
    while (j < rows.length && (rows[j].handle || '') === handle) j += 1;
    const run = rows.slice(i, j);
    if (run.length <= max) {
      out.push(...run);
    } else {
      const keep = new Set(
        run
          .map((row, idx) => {
            const w = weightOf(row);
            return { idx, w: Number.isFinite(w) ? w : 0 };
          })
          .sort((a, b) => b.w - a.w || a.idx - b.idx)
          .slice(0, max)
          .map((x) => x.idx),
      );
      run.forEach((row, idx) => {
        if (keep.has(idx)) out.push(row);
      });
    }
    i = j;
  }
  return out;
}
