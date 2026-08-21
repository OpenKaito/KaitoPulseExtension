
export function hyperliquidAddressUrl(address: string): string {
  return `https://hypurrscan.io/address/${address}#perps`;
}

export function hyperliquidCoinIconUrl(pair: string): string {
  const symbol = pair.split('/')[0];
  return `https://app.hyperliquid.xyz/coins/${symbol}.svg`;
}
