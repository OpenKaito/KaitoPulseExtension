
import type { SocialCardScope } from '@/shared/voices-social-card';

const SHARE_COPY: Record<SocialCardScope, string> = {
  crypto: 'still here. locked in. forever growing.\nCT - my corner of the internet.\nget yours: {link}',
  ai: "we're living through the most exciting technological shift of our lifetime.\nhere's my part in it.\nget yours: {link}",
  trading: "every trade and every thesis tells a story.\nhere's mine, documented in public.\nget yours: {link}",
};

export const buildShareText = (scope: SocialCardScope, link: string): string =>
  SHARE_COPY[scope].replace('{link}', link);

export const buildShareIntentUrl = (scope: SocialCardScope, link: string): string =>
  `https://twitter.com/intent/tweet?text=${encodeURIComponent(buildShareText(scope, link))}`;

export function shareCardOnX(scope: SocialCardScope, link: string | null | undefined): boolean {
  if (!link) return false;
  window.open(buildShareIntentUrl(scope, link), '_blank', 'noopener');
  return true;
}
