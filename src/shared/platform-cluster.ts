import { platformMarkSrc } from './platform-brand';

export type PlatformCluster = {
  icons: { platform: string; src: string }[];

  collapsed: boolean;
};

export const PLATFORM_MARKS_MAX = 4;

export function buildPlatformCluster(
  platforms: readonly string[],
  max = PLATFORM_MARKS_MAX,
): PlatformCluster {
  const unique = [...new Set(platforms)];
  return {
    icons: unique.map((platform) => ({ platform, src: platformMarkSrc(platform) })),
    collapsed: unique.length > max,
  };
}
