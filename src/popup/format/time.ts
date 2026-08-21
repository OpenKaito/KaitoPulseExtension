
function shortDate(date: Date): string {
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function epochOf(iso: string | null | undefined): number | null {
  return parse(iso)?.getTime() ?? null;
}

export function shortDateOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const date = parse(dateOnly ? `${iso}T12:00:00` : iso);
  return date ? shortDate(date) : null;
}

export function formatAgo(iso: string | null | undefined): string | null {
  const date = parse(iso);
  if (!date) return null;

  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : shortDate(date);
}

export function formatUpdated(iso: string | null | undefined): string | null {
  const ago = formatAgo(iso);
  return ago == null ? null : `Updated ${ago}`;
}

export function formatCalculated(iso: string | null | undefined): string | null {
  const date = parse(iso);
  if (!date) return null;
  const time = date.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `Calculated ${shortDate(date)}, ${time}`;
}

export function formatVerifiedOn(iso: string | null | undefined): string | null {
  const date = parse(iso);
  return date ? `Verified ${shortDate(date)}` : null;
}
