import type { TokenProtocol } from '../types';

const TOKEN_PROFILE_BASE: Record<TokenProtocol, string> = {
  fomo: 'https://fomo.family/profile/',
  pumpfun: 'https://pump.fun/profile/',
};

export function tokenProfileUrl(
  protocol: TokenProtocol,
  handle: string | null | undefined,
): string | undefined {
  const name = handle?.replace(/^@/, '') ?? '';
  return name ? `${TOKEN_PROFILE_BASE[protocol]}${encodeURIComponent(name)}` : undefined;
}

export function hyperliquidAddressUrl(address: string | null | undefined): string | undefined {
  return address ? `https://hypurrscan.io/address/${address}#perps` : undefined;
}

export function hyperliquidCoinIconUrl(pair: string): string {
  const symbol = pair.split('/')[0].replace(/^k(?=[A-Z])/, '');
  return `https://app.hyperliquid.xyz/coins/${symbol}.svg`;
}
