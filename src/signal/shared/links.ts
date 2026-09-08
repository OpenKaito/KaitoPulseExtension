export function hyperliquidAddressUrl(address: string | null | undefined): string | undefined {
  return address ? `https://hypurrscan.io/address/${address}#perps` : undefined;
}

export function hyperliquidCoinIconUrl(pair: string): string {
  const symbol = pair.split('/')[0].replace(/^k(?=[A-Z])/, '');
  return `https://app.hyperliquid.xyz/coins/${symbol}.svg`;
}
