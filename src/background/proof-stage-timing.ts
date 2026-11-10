export type StageMark = { stage: string; at: number };

export function recordStage(marks: StageMark[], stage: string, at: number): StageMark[] {
  if (marks.at(-1)?.stage === stage) return marks;
  return [...marks, { stage, at }];
}

function seconds(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(1);
}

export function formatStageTiming(marks: StageMark[], startedAt: number, endAt: number): string {
  if (marks.length === 0) return '';
  const parts = marks.map((mark, index) => {
    const next = marks[index + 1]?.at ?? endAt;
    return `${mark.stage}:${seconds(next - mark.at)}`;
  });
  return `timing=${seconds(endAt - startedAt)}s[${parts.join(',')}]`;
}
