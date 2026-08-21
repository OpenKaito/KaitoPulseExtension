import type { SignalProtocol } from "./types";

export interface NameTagPalette {
  bg: string;
  text: string;

  iconBorder?: string;

  iconShadow?: string;
}

type ProtocolTheme = Record<SignalProtocol, { light: NameTagPalette; dark: NameTagPalette }>;

const COMBINED_PALETTES: ProtocolTheme = {
  hyperliquid: {
    light: { bg: "#c2fff5", text: "#0f1419" },
    dark: { bg: "#05241d", text: "#8bd6c5", iconBorder: "#20675c" },
  },
  polymarket: {
    light: { bg: "#d5deff", text: "#0f1419" },
    dark: { bg: "#152354", text: "#8da7ff" },
  },

};

const SINGLE_PALETTES: ProtocolTheme = {
  hyperliquid: {
    light: { bg: "#c2fff5", text: "#0f1419", iconShadow: "2px 0 4px rgba(0, 0, 0, 0.12)" },
    dark: { bg: "#05251e", text: "#8bd6c5", iconBorder: "#20675c", iconShadow: "2px 0 4px #0c211c" },
  },
  polymarket: {
    light: { bg: "#c0ceff", text: "#0f1419" },
    dark: { bg: "#101d4c", text: "#8da7ff" },
  },

};

export function getCombinedNameTagPalette(protocol: SignalProtocol, isDark: boolean): NameTagPalette {
  return isDark ? COMBINED_PALETTES[protocol].dark : COMBINED_PALETTES[protocol].light;
}

export function getSingleNameTagPalette(protocol: SignalProtocol, isDark: boolean): NameTagPalette {
  return isDark ? SINGLE_PALETTES[protocol].dark : SINGLE_PALETTES[protocol].light;
}
