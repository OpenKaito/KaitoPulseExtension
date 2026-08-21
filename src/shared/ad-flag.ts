
export type AdFlagWriteResult = {
  flagged: boolean;
  reason: string | null;
  count: number;
};

export type AdFlagQueryItem = {
  count: number;

  my_reason?: string;
};

export type AdFlagQueryResponse = {
  items: Record<string, AdFlagQueryItem>;
};
