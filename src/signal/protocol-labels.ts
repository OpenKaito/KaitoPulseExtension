import type { SignalProtocol } from './types';
import { SIGNAL_PLATFORMS, SIGNAL_PROTOCOLS } from './platforms';

export const PROTOCOL_LABEL = Object.fromEntries(
  SIGNAL_PROTOCOLS.map((protocol) => [protocol, SIGNAL_PLATFORMS[protocol].label]),
) as Record<SignalProtocol, string>;
