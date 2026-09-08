export const ACCOUNT_VALUE_LABEL = 'Account Value';

export const POSITIONS_VALUE_LABEL = 'Positions Value';
export const PREDICTIONS_LABEL = 'Predictions';
export const TRADES_LABEL = 'Trades';
export const PROFIT_LOSS_ALL_TIME_LABEL = 'Profit/Loss (All-Time)';
export const PROFIT_LOSS_30D_LABEL = 'Profit/Loss (30D)';
export const VIEW_IN_PROFILE_LABEL = 'View in profile ↗';

export const SEE_DETAILS_LABEL = 'See details';

export const GROUP_ACCOUNT_VALUE_LABEL = 'Total Account Value';
export const GROUP_UPNL_LABEL = 'Total UPnL';

export const GROUP_PROFIT_LOSS_ALL_TIME_LABEL = 'Total P/L (All-Time)';

export const ANONYMOUS_WALLET_LABEL = 'Address';

export const WALLET_DETAIL_LOADING = 'Loading positions…';

export function accountsHeading(count: number, platform: string): string {
  return `${count} ${platform} Account${count === 1 ? '' : 's'}`;
}

export const TOTAL_ACCOUNT_VALUE_LABEL = 'Account Value';
export const TOTAL_ALL_TIME_PNL_LABEL = 'All-Time P&L';
