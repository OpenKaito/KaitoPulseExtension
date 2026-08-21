
import jetBrainsMonoWoff2 from 'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbV2o-flEEny0FZhsfKu5WU4xD7OwGtT0rU.woff2?remote-inline';
import shareTechMonoWoff2 from 'https://fonts.gstatic.com/s/sharetechmono/v16/J7aHnp1uDWRBEqV98dVQztYldFcLowEFA87Heg.woff2?remote-inline';

import rethinkSansWoff2 from 'https://fonts.gstatic.com/s/rethinksans/v7/AMOWz4SDuXOMCPfdoglY9JQEVFi34dpL4w.woff2?remote-inline';

const STYLE_ID = 'kaito-social-card-fonts';

const FACES: { family: string; weight: string; src: string }[] = [
  { family: 'JetBrains Mono', weight: '100 800', src: jetBrainsMonoWoff2 },
  { family: 'Share Tech Mono', weight: '400', src: shareTechMonoWoff2 },
  { family: 'Rethink Sans', weight: '400 800', src: rethinkSansWoff2 },
];

let started = false;

export function ensureCardFonts(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (!started) {
    started = true;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = FACES.map(
      ({ family, weight, src }) =>
        `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(${src}) format('woff2');}`,
    ).join('\n');
    document.head.appendChild(style);
  }

  return document.fonts.ready.then(() => undefined);
}
