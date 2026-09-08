import type { SignalProtocol } from './types';
import type { IconRegistry } from '@/shared/icon-registry';
import hyperliquidIcon from './assets/hyperliquid.png?inline';
import polymarketIcon from './assets/polymarket.png?inline';

export const PROTOCOL_ICON_DATA_URI: IconRegistry<SignalProtocol> = {
  hyperliquid: hyperliquidIcon,
  polymarket: polymarketIcon,
};
