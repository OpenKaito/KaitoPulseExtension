import { PROTOCOL_ICON_DATA_URI } from '@/signal/protocol-icons';

export type PlatformCluster = {

  icons: { platform: string; src: string }[];

  overflow: number;
};

export function buildPlatformCluster(platforms: readonly string[], max: number): PlatformCluster {
  const unique = [...new Set(platforms)];
  const icons: { platform: string; src: string }[] = [];
  for (const platform of unique) {
    if (icons.length >= max) break;
    const src = PROTOCOL_ICON_DATA_URI[platform as keyof typeof PROTOCOL_ICON_DATA_URI];
    if (src) icons.push({ platform, src });
  }
  return { icons, overflow: unique.length - icons.length };
}
