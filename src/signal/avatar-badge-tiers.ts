
export type SmartFollowerTier = "elite" | "strong" | "normal" | "no-sf" | "no-data";

export function getSmartFollowerTier(sf: number | null): SmartFollowerTier {
  if (sf === null || !Number.isFinite(sf)) return "no-data";
  if (sf >= 1000) return "elite";
  if (sf >= 200) return "strong";
  if (sf >= 10) return "normal";
  return "no-sf";
}

export interface RingStop {
  offset: number;
  color: string;
}

export interface RingLayer {
  stops: readonly RingStop[];
  opacity: number;
  strokeWidth: number;
}

export interface RingStyle {
  main: RingLayer;

  glow?: RingLayer & { blurStdDeviation: number };
}

export interface TierPalette {
  ring: RingStyle | null;
  pillBg: string;
  pillBorder: string;

  pillBlur: boolean | number;
  text: string;
  fontWeight: 500 | 600;
}

const BRAND_RING_STOPS: readonly RingStop[] = [
  { offset: 0, color: "#32FFDC" },
  { offset: 1, color: "#2496FF" },
];

const STRONG_RING: RingStyle = {
  main: { stops: BRAND_RING_STOPS, opacity: 0.3, strokeWidth: 1.5 },
};
const NORMAL_RING: RingStyle = {
  main: { stops: BRAND_RING_STOPS, opacity: 0.3, strokeWidth: 1 },
};

const NO_SF_LIGHT: TierPalette = {
  ring: null,
  pillBg: "#EDEBEB",
  pillBorder: "#CBCBCB",
  pillBlur: false,
  text: "rgba(1, 1, 1, 0.6)",
  fontWeight: 600,
};
const NO_SF_DARK: TierPalette = {
  ring: null,

  pillBg:
    "linear-gradient(133.8035031313802deg, rgba(214, 214, 214, 0.3) 6.5263%, rgba(129, 129, 129, 0.3) 89.229%)",
  pillBorder: "rgba(206, 206, 206, 0.6)",
  pillBlur: true,
  text: "rgba(255, 255, 255, 0.8)",
  fontWeight: 500,
};

const PALETTES: Record<SmartFollowerTier, { light: TierPalette; dark: TierPalette }> = {
  elite: {
    light: {
      ring: {

        main: { stops: BRAND_RING_STOPS, opacity: 0.5, strokeWidth: 2 },
      },
      pillBg: "linear-gradient(156.85901655504932deg, #32FFDC 16.173%, #2496FF 152.24%)",
      pillBorder: "#32FFDC",
      pillBlur: false,
      text: "#010101",
      fontWeight: 600,
    },
    dark: {
      ring: {

        main: { stops: BRAND_RING_STOPS, opacity: 0.3, strokeWidth: 2 },
      },
      pillBg:
        "linear-gradient(163.93362150379153deg, rgba(14, 119, 101, 0.9) 15.811%, rgba(7, 76, 140, 0.9) 99.738%)",
      pillBorder: "rgba(38, 168, 248, 0.4)",
      pillBlur: 5,
      text: "rgba(255, 255, 255, 0.9)",
      fontWeight: 500,
    },
  },
  strong: {
    light: {
      ring: STRONG_RING,
      pillBg: "#94FBE9",
      pillBorder: "#90EFDF",
      pillBlur: false,
      text: "#010101",
      fontWeight: 600,
    },
    dark: {
      ring: STRONG_RING,
      pillBg: "rgba(13, 120, 93, 0.6)",
      pillBorder: "rgba(206, 206, 206, 0.6)",
      pillBlur: true,
      text: "rgba(255, 255, 255, 0.9)",
      fontWeight: 500,
    },
  },
  normal: {
    light: {
      ring: NORMAL_RING,
      pillBg: "#DFF4EC",
      pillBorder: "#B9E9D4",
      pillBlur: false,
      text: "#010101",
      fontWeight: 600,
    },
    dark: {
      ring: NORMAL_RING,
      pillBg: "rgba(15, 74, 56, 0.8)",
      pillBorder: "#417766",
      pillBlur: true,
      text: "rgba(255, 255, 255, 0.9)",
      fontWeight: 500,
    },
  },
  "no-sf": {
    light: NO_SF_LIGHT,
    dark: NO_SF_DARK,
  },

  "no-data": {
    light: NO_SF_LIGHT,
    dark: NO_SF_DARK,
  },
};

export function getTierPalette(tier: SmartFollowerTier, isDark: boolean): TierPalette {
  return isDark ? PALETTES[tier].dark : PALETTES[tier].light;
}
