
export const GRAPHQL_PREFETCH_REQUEST_MESSAGE = 'kaitoXGraphqlPrefetchRequest';

export type GraphqlPrefetchRequestMessage = {
  source: typeof GRAPHQL_PREFETCH_REQUEST_MESSAGE;
  operation: string;
};

export function isGraphqlPrefetchRequest(data: unknown): data is GraphqlPrefetchRequestMessage {
  if (typeof data !== 'object' || data === null) return false;
  const message = data as { source?: unknown; operation?: unknown };
  return message.source === GRAPHQL_PREFETCH_REQUEST_MESSAGE && typeof message.operation === 'string';
}
