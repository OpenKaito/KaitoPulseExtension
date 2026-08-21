import { logDev } from './env';

export function guard<A extends unknown[]>(
  fn: (...args: A) => void,
  where: string,
): (...args: A) => void {
  return (...args: A) => {
    try {
      fn(...args);
    } catch (error) {
      logDev(`callback failed: ${where}`, error);
    }
  };
}

export function logLocalError(error: unknown, where: string): void {
  logDev(`operation failed: ${where}`, error);
}

export function logLocalWarning(message: string, where: string, extra?: Record<string, unknown>): void {
  logDev(`warning: ${where}: ${message}`, extra);
}
