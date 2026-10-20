export function formatTimeSpent(seconds: number): string {
  if (seconds === 0) return '0';
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  return remainderMinutes > 0 ? `${hours} hr ${remainderMinutes} min` : `${hours} hr`;
}

export function timeSpentDisplay(seconds: number | null): {
  value: string;
  caption: string;
  empty: boolean;
} {
  if (seconds === null || seconds <= 0) {
    return { value: '—', caption: 'Tracked on desktop only', empty: true };
  }
  return {
    value: formatTimeSpent(seconds),
    caption: 'Last 24h · Updates every 5 min',
    empty: false,
  };
}
