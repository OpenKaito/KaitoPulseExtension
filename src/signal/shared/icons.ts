import { el, svg } from './dom';
import { PROTOCOL_LABEL } from '../protocol-labels';
import type { SignalProtocol } from '../types';
import { platformMarkSrc } from '@/shared/platform-brand';
import { KAITO_K_MARK_PATH, KAITO_LETTER_PATHS } from '@/shared/kaito-lockup-paths';
import { PNL_ARROW_POINTS, PNL_ARROW_VIEW_BOX, type PnlArrowDirection } from '@/shared/pnl-arrow';

export function brandIcon(protocol: SignalProtocol): HTMLElement {
  const wrap = el('div', 'signal-popover__brand');
  const img = el('img', 'signal-popover__brand-icon');
  img.dataset.platform = protocol;
  img.src = platformMarkSrc(protocol);
  img.alt = PROTOCOL_LABEL[protocol];
  img.width = 24;
  img.height = 24;
  img.draggable = false;
  wrap.append(img);
  return wrap;
}

export function protocolChip(protocol: SignalProtocol): HTMLElement {
  const wrap = el('div', 'signal-popover__chip');
  const img = el('img', 'signal-popover__chip-icon');
  img.dataset.platform = protocol;
  img.src = platformMarkSrc(protocol);
  img.alt = '';
  img.width = 16;
  img.height = 16;
  img.draggable = false;
  const label = el('span', 'signal-popover__chip-label');
  label.textContent = PROTOCOL_LABEL[protocol];
  wrap.append(img, label);
  return wrap;
}

export function checkIcon(): SVGElement {
  const root = svg('svg', {
    class: 'signal-popover__verified-check',
    viewBox: '0 0 10 10',
    fill: 'none',
    'aria-hidden': 'true',
  });
  root.append(
    svg('path', {
      d: 'M1.1619 5.76143C0.977914 5.56834 0.977883 5.26482 1.16183 5.07169L1.26487 4.9635C1.46189 4.75664 1.79189 4.75661 1.98894 4.96345L2.88717 5.90629C3.28128 6.31996 3.94127 6.31991 4.33532 5.90618L8.01106 2.04682C8.2081 1.83993 8.53814 1.83993 8.73518 2.04682L8.83825 2.15503C9.02217 2.34813 9.02217 2.65158 8.83827 2.84469L4.33583 7.57253C3.94181 7.98628 3.28182 7.98636 2.88769 7.57271L1.1619 5.76143Z',
      fill: '#07080a',
    }),
  );
  return root;
}

export const VERIFIED_BADGE_VIEWBOX = '0 0 14 14';
export const VERIFIED_BADGE_COLOR = '#1f9cf1';
export const VERIFIED_BADGE_PATH =
  'M6.17515 1.22472C6.38164 1.01849 6.65793 0.897148 6.94949 0.884621C7.24106 0.872095 ' +
  '7.52673 0.969296 7.75015 1.15705L7.82482 1.2253L8.93315 2.33305H10.5C10.7942 2.3331 ' +
  '11.0776 2.44433 11.2933 2.64445C11.509 2.84458 11.6411 3.11881 11.6631 3.41222L11.6666 ' +
  '3.49972V5.06655L12.775 6.17488C12.9814 6.38141 13.1028 6.65781 13.1153 6.94951C13.1279 ' +
  '7.24121 13.0306 7.52701 12.8426 7.75047L12.7744 7.82455L11.6661 8.93288V10.4997C11.6662 ' +
  '10.7941 11.555 11.0775 11.3549 11.2934C11.1547 11.5092 10.8804 11.6414 10.5869 ' +
  '11.6635L10.5 11.6664H8.93373L7.8254 12.7747C7.61888 12.9811 7.34247 13.1026 7.05077 ' +
  '13.1151C6.75907 13.1276 6.47327 13.0303 6.24982 12.8424L6.17573 12.7747L5.0674 ' +
  '11.6664H3.49998C3.20565 11.6665 2.92215 11.5553 2.70633 11.3552C2.49051 11.155 2.35831 ' +
  '10.8807 2.33623 10.5872L2.33332 10.4997V8.93288L1.22498 7.82455C1.0186 7.61803 0.897148 ' +
  '7.34162 0.88462 7.04992C0.872092 6.75822 0.969396 6.47242 1.15732 6.24897L1.22498 ' +
  '6.17488L2.33332 5.06655V3.49972C2.33337 3.20548 2.4446 2.92213 2.64472 2.70643C2.84484 ' +
  '2.49073 3.11908 2.35862 3.41248 2.33655L3.49998 2.33305H5.06682L6.17515 1.22472ZM8.79607 ' +
  '5.2398L6.3204 7.71547L5.28907 6.68413C5.17961 6.57475 5.03118 6.51334 4.87644 ' +
  '6.51339C4.7217 6.51344 4.57332 6.57497 4.46394 6.68442C4.35456 6.79388 4.29314 6.94231 ' +
  '4.2932 7.09705C4.29325 7.25179 4.35478 7.40017 4.46423 7.50955L5.86657 8.91188C5.92615 ' +
  '8.9715 5.9969 9.01879 6.07477 9.05106C6.15264 9.08332 6.23611 9.09993 6.3204 ' +
  '9.09993C6.40469 9.09993 6.48815 9.08332 6.56602 9.05106C6.64389 9.01879 6.71464 8.9715 ' +
  '6.77423 8.91188L9.6209 6.06463C9.72716 5.95462 9.78595 5.80726 9.78463 5.65432C9.7833 ' +
  '5.50137 9.72195 5.35506 9.61379 5.24691C9.50564 5.13875 9.35933 5.0774 9.20638 ' +
  '5.07607C9.05343 5.07474 8.90608 5.13354 8.79607 5.2398Z';

export function verifiedBadge(cls: string): SVGElement {
  const root = svg('svg', {
    class: cls,
    viewBox: VERIFIED_BADGE_VIEWBOX,
    fill: 'none',
    'aria-hidden': 'true',
  });
  root.append(
    svg('path', {
      'fill-rule': 'evenodd',
      'clip-rule': 'evenodd',
      d: VERIFIED_BADGE_PATH,
      fill: VERIFIED_BADGE_COLOR,
    }),
  );
  return root;
}

export function kaitoLockup(): SVGElement {
  const root = svg('svg', {
    class: 'signal-popover__user-logo',
    viewBox: '0 0 72.0005 13.8685',
    fill: 'none',
    'aria-hidden': 'true',
    role: 'img',
  });
  root.append(
    svg('path', { d: KAITO_K_MARK_PATH, fill: '#32ffdc' }),
    svg('path', {
      'fill-rule': 'evenodd',
      'clip-rule': 'evenodd',
      d: KAITO_LETTER_PATHS[0],
      fill: 'var(--sg-text-strong, #07080a)',
    }),
    ...KAITO_LETTER_PATHS.slice(1).map((d) =>
      svg('path', { d, fill: 'var(--sg-text-strong, #07080a)' }),
    ),
  );
  return root;
}

export function triangle(direction: PnlArrowDirection): SVGElement {
  const root = svg('svg', {
    class: 'signal-popover__triangle',
    viewBox: PNL_ARROW_VIEW_BOX,
    preserveAspectRatio: 'none',
    fill: 'none',
    'aria-hidden': 'true',
  });
  root.append(svg('polygon', { points: PNL_ARROW_POINTS[direction], fill: 'currentColor' }));
  return root;
}

export function closeIcon(): SVGElement {
  const root = svg('svg', {
    viewBox: '0 0 16 16',
    fill: 'none',
    'aria-hidden': 'true',
  });
  root.append(
    svg('path', {
      d: 'M4 4 12 12M12 4 4 12',
      stroke: 'currentColor',
      'stroke-width': '1.5',
      'stroke-linecap': 'round',
    }),
  );
  return root;
}

export function moreIcon(): SVGElement {
  const root = svg('svg', {
    viewBox: '0 0 16 16',
    fill: 'none',
    'aria-hidden': 'true',
  });
  root.append(
    ...[3.25, 8, 12.75].map((cy) =>
      svg('circle', { cx: '8', cy: String(cy), r: '1.35', fill: 'currentColor' }),
    ),
  );
  return root;
}

export function arrowOut(): SVGElement {
  const root = svg('svg', {
    class: 'signal-popover__acct-chip-arrow',
    viewBox: '0 0 6.4 6.4',
    fill: 'none',
    'aria-hidden': 'true',
  });
  root.append(
    svg('path', {
      d: 'M0.7 5.7L5.7 0.7M5.7 4.7V0.7H1.7',
      stroke: 'currentColor',
      'stroke-width': '1.4',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
  return root;
}

export function chevron(direction: 'down' | 'right'): SVGElement {
  const root = svg('svg', {
    class: 'signal-popover__chev',
    viewBox: '0 0 12 12',
    fill: 'none',
    'aria-hidden': 'true',
  });
  const d = direction === 'down' ? 'M3 4.5 6 7.5 9 4.5' : 'M4.5 3 7.5 6 4.5 9';
  root.append(
    svg('path', {
      d,
      stroke: 'currentColor',
      'stroke-width': '1.2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
  return root;
}
