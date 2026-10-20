export const ACCOUNT_VALUE_LABEL = 'Account Value';

export const UPNL_LABEL = 'UPnL';

export const POSITIONS_VALUE_LABEL = 'Positions Value';
export const PREDICTIONS_LABEL = 'Predictions';
export const TRADES_LABEL = 'Trades';
export const POINTS_LABEL = 'Points';
export const BUY_VOLUME_LABEL = 'Buy Volume';

export const POSITIONS_COUNT_LABEL = 'Positions';
export const REFERRED_TRADER_LABEL = 'referred trader';
export const REFERRED_TRADERS_LABEL = 'referred traders';
export const REFERRED_TRADERS_STAT_LABEL = 'Referred Users';
export const REFERRED_VOLUME_LABEL = 'Referred Volume';
export const PROFIT_LOSS_ALL_TIME_LABEL = 'Profit/Loss (All-Time)';
export const VIEW_IN_PROFILE_LABEL = 'View in profile ↗';

export const SEE_DETAILS_LABEL = 'See details';
export const SHOW_LABEL = 'Show';
export const COLLAPSE_LABEL = 'Collapse';

export function showingPositionsLabel(shown: number, total: number): string {
  return `Showing ${shown} of ${total} positions`;
}

export const GROUP_ACCOUNT_VALUE_LABEL = 'Total Account Value';
export const GROUP_UPNL_LABEL = 'Total UPnL';
export const GROUP_POSITIONS_VALUE_LABEL = 'Total Positions Value';

export const GROUP_PROFIT_LOSS_ALL_TIME_LABEL = 'Profit/Loss (All-Time)';

export const ANONYMOUS_WALLET_LABEL = 'Address';

export const ANONYMOUS_ACCOUNT_LABEL = 'Account';

export const WALLET_DETAIL_LOADING = 'Loading positions…';

export function accountsHeading(count: number, platform: string): string {
  return `${count} ${platform} Account${count === 1 ? '' : 's'}`;
}

export const TOTAL_ACCOUNT_VALUE_LABEL = 'Account Value';
export const TOTAL_ALL_TIME_PNL_LABEL = 'All-Time P&L';
export const TOTAL_REFERRAL_VOLUME_LABEL = 'Referral Volume';
