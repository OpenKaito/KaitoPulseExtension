
import type { SocialCardScope } from '@/shared/voices-social-card';

export type WordmarkKind = 'crypto-svg' | 'ai-text' | 'trading-text';

export interface ScopeCopy {

  label: string;

  labelWord: string;
  wordmark: WordmarkKind;
}

export const SCOPE_COPY: Record<SocialCardScope, ScopeCopy> = {
  crypto: { label: 'Crypto', labelWord: 'crypto', wordmark: 'crypto-svg' },
  ai: { label: 'AI', labelWord: 'AI', wordmark: 'ai-text' },

  trading: { label: 'Stock Trading', labelWord: 'stock trading', wordmark: 'trading-text' },
};

export const TEAL_HEATMAP_COLORS = [
  'rgba(255,255,255,0.04)',
  '#144d43',
  '#178070',
  '#10C2A3',
  '#28d1b4',
  '#32ffdc',
] as const;
