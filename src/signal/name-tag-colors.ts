import type { SignalProtocol } from './types';

export interface NameTagPalette {
  bg: string;
  text: string;

  iconBorder?: string;

  iconShadow?: string;
}

const NEUTRAL_ICON_BORDER = {
  dark: 'rgb(255 255 255 / 10%)',
  light: 'rgb(15 20 25 / 14%)',
} as const;

function withIconBorder(palette: NameTagPalette, isDark: boolean): NameTagPalette {
  if (palette.iconBorder) return palette;
  return { ...palette, iconBorder: NEUTRAL_ICON_BORDER[isDark ? 'dark' : 'light'] };
}

type Theme = { light: NameTagPalette; dark: NameTagPalette };
type ProtocolTheme = Partial<Record<SignalProtocol, Theme>>;

const NEUTRAL_THEME: Theme = {
  light: { bg: '#e7e9ec', text: '#0f1419' },
  dark: { bg: '#1d2025', text: '#c9ced4' },
};

const COMBINED_PALETTES: ProtocolTheme = {
  hyperliquid: {
    light: { bg: '#c2fff5', text: '#0f1419' },
    dark: { bg: '#05241d', text: '#8bd6c5', iconBorder: '#20675c' },
  },
  polymarket: {
    light: { bg: '#c0ceff', text: '#0f1419' },
    dark: { bg: '#152354', text: '#8da7ff' },
  },
  fomo: {
    light: { bg: '#dfdcf7', text: '#0f1419' },
    dark: { bg: '#1c1846', text: '#aca4ee', iconBorder: '#3d3775' },
  },
  pumpfun: {
    light: { bg: '#d7f2e2', text: '#0f1419' },
    dark: { bg: '#0e2418', text: '#5fcb88', iconBorder: '#2a5c3e' },
  },
};

const SINGLE_PALETTES: ProtocolTheme = {
  hyperliquid: {
    light: { bg: '#c2fff5', text: '#0f1419', iconShadow: '2px 0 4px rgba(0, 0, 0, 0.12)' },
    dark: {
      bg: '#05251e',
      text: '#8bd6c5',
      iconBorder: '#20675c',
      iconShadow: '2px 0 4px #0c211c',
    },
  },
  polymarket: {
    light: { bg: '#c0ceff', text: '#0f1419' },
    dark: { bg: '#101d4c', text: '#8da7ff' },
  },
  fomo: {
    light: { bg: '#d4d0f4', text: '#0f1419', iconShadow: '2px 0 4px rgba(0, 0, 0, 0.12)' },
    dark: {
      bg: '#17133c',
      text: '#aca4ee',
      iconBorder: '#3d3775',
      iconShadow: '2px 0 4px #0e0b26',
    },
  },
  pumpfun: {
    light: { bg: '#cdeedb', text: '#0f1419', iconShadow: '2px 0 4px rgba(0, 0, 0, 0.12)' },
    dark: {
      bg: '#0b1f14',
      text: '#5fcb88',
      iconBorder: '#2a5c3e',
      iconShadow: '2px 0 4px #081409',
    },
  },
};

export function getCombinedNameTagPalette(
  protocol: SignalProtocol,
  isDark: boolean,
): NameTagPalette {
  const theme = COMBINED_PALETTES[protocol] ?? NEUTRAL_THEME;
  return withIconBorder(isDark ? theme.dark : theme.light, isDark);
}

export function getSingleNameTagPalette(protocol: SignalProtocol, isDark: boolean): NameTagPalette {
  const theme = SINGLE_PALETTES[protocol] ?? NEUTRAL_THEME;
  return withIconBorder(isDark ? theme.dark : theme.light, isDark);
}
