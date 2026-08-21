export type DebugRequestSource = 'extension-api' | 'signal-proxy' | 'image-proxy';

export type DebugRequestEntry = {
  id: string;
  source: DebugRequestSource;
  method: string;
  url: string;
  path?: string;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  status?: number;
  ok?: boolean;
  requestBody?: unknown;
  responseBody?: unknown;
  error?: string;
};

export type DebugRequestSnapshot = {
  entries: DebugRequestEntry[];
};
