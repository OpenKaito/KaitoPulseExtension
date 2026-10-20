import type { SignalProtocol } from './types';
import type { IconRegistry } from '@/shared/icon-registry';
import hyperliquidIcon from './assets/hyperliquid.png?inline';
import polymarketIcon from './assets/polymarket.png?inline';
import fomoIcon from './assets/fomo.png?inline';
import pumpfunIcon from './assets/pumpfun.png?inline';
import binanceIcon from './assets/binance.png?inline';
import okxIcon from './assets/okx.png?inline';
import bybitIcon from './assets/bybit.png?inline';
import variationalIcon from './assets/variational.png?inline';
import lighterIcon from './assets/lighter.png?inline';
import krakenIcon from './assets/kraken.png?inline';
import mexcIcon from './assets/mexc.png?inline';
import gateIcon from './assets/gate.png?inline';
import bitgetIcon from './assets/bitget.png?inline';

type ChipOnlyPlatform = 'kraken' | 'mexc' | 'gate' | 'bitget';

export const PROTOCOL_ICON_DATA_URI: Partial<IconRegistry<SignalProtocol | ChipOnlyPlatform>> = {
  hyperliquid: hyperliquidIcon,
  polymarket: polymarketIcon,
  fomo: fomoIcon,
  pumpfun: pumpfunIcon,
  binance: binanceIcon,
  okx: okxIcon,
  bybit: bybitIcon,
  variational: variationalIcon,
  lighter: lighterIcon,
  kraken: krakenIcon,
  mexc: mexcIcon,
  gate: gateIcon,
  bitget: bitgetIcon,
};
