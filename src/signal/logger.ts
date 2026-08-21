import { ENV } from '@/lib/env';

type LogLevel = 'log' | 'info' | 'warn' | 'error';

const APP_NAMESPACE = 'signal-ext';

let enabledNamespaces = new Set<string>();

function enableNamespaces(input: string) {
  enabledNamespaces.clear();

  const patterns = input
    .split(/[\s,]+/)
    .map(p => p.trim())
    .filter(Boolean);

  for (const pattern of patterns) {
    enabledNamespaces.add(pattern);
  }
}

function isEnabled(ns: string): boolean {
  if (enabledNamespaces.size === 0) return false;

  if (enabledNamespaces.has(ns)) return true;

  const wildcardPattern = `${APP_NAMESPACE}:*`;
  if (enabledNamespaces.has(wildcardPattern)) return true;

  return false;
}

if (ENV.isDev) {
  enableNamespaces(`${APP_NAMESPACE}:*`);
}

function levelStyle(level: LogLevel): string {
  switch (level) {
    case 'warn':
      return 'color:#b8860b;font-weight:600';
    case 'error':
      return 'color:#dc143c;font-weight:600';
    case 'info':
      return 'color:#228b22;font-weight:600';
    default:
      return 'color:#2e8b57';
  }
}

export function createLogger(namespace: string) {
  const baseNs = `signal-ext:${namespace}`;

  function build(level: LogLevel) {

    const enabled = isEnabled(baseNs) || isEnabled(`${baseNs}:${level}`);

    if (!enabled) {

      return () => { };
    }

    const raw =
      (console[level] as ((...args: unknown[]) => void) | undefined)?.bind(console)
      ?? console.log.bind(console);

    const prefix = `%c[${baseNs}${level !== 'log' ? ':' + level : ''}]`;
    const style = levelStyle(level);

    return raw.bind(console, prefix, style);
  }

  return {
    log: build('log'),
    info: build('info'),
    warn: build('warn'),
    error: build('error'),
  };
}

export function enableLogs(namespaces: string) {
  enableNamespaces(namespaces);
}

export function disableLogs() {
  enabledNamespaces.clear();
}

export const logger = createLogger('app');
