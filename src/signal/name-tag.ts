import type { BadgeTrading } from '@/shared/social-card';
import {
  ACCOUNT_SIZE_DOT_CELLS,
  ACCOUNT_SIZE_DOT_R,
  accountSizeTierFromBucket,
  formatAccountSize,
  type AccountSizeTier,
} from '@/shared/account-size';
import type { NameTagEntry, NameTagProfile, SignalProtocol } from './types';
import { platformMarkSrc } from '@/shared/platform-brand';
import { PROTOCOL_LABEL } from './protocol-labels';
import { SIGNAL_PROTOCOLS, isSignalProtocol } from './platforms';
import {
  getCombinedNameTagPalette,
  getSingleNameTagPalette,
  type NameTagPalette,
} from './name-tag-colors';

export function createNameTagElement(profile: NameTagProfile): HTMLElement {
  const root = document.createElement('div');
  root.className = 'signal-name-tag';
  root.dataset.signalNameTag = profile.id;
  renderEntries(root, profile.entries, false);
  return root;
}

interface RenderedNameTag {
  entries: NameTagEntry[];
  isDark: boolean;
  trading?: BadgeTrading;
}

const rendered = new WeakMap<HTMLElement, RenderedNameTag>();

export function setNameTagProtocols(
  tag: HTMLElement,
  entries: NameTagEntry[],
  isDark: boolean,
  trading?: BadgeTrading,
): void {
  rendered.set(tag, { entries, isDark, trading });
  renderEntries(tag, entries, isDark, trading);
}

export function syncNameTagTheme(scope: ParentNode, isDark: boolean): number {
  let changed = 0;
  for (const tag of scope.querySelectorAll<HTMLElement>('.signal-name-tag')) {
    const last = rendered.get(tag);
    if (!last || last.isDark === isDark) continue;
    setNameTagProtocols(tag, last.entries, isDark, last.trading);
    changed += 1;
  }
  return changed;
}

function renderEntries(
  root: HTMLElement,
  entries: NameTagEntry[],
  isDark: boolean,
  trading?: BadgeTrading,
): void {
  root.replaceChildren();
  root.classList.toggle('signal-name-tag--light', !isDark);

  const chip = trading ? buildTradingChip(trading) : null;
  if (chip) root.append(chip);

  const merged = mergeProtocols(entries, trading);

  const useSingleLayout = merged.length === 1 && merged[0].positionsCount != null;
  if (useSingleLayout) {
    root.append(buildSinglePill(merged[0], isDark));
  } else {
    for (const entry of merged) root.append(buildCombinedPill(entry, isDark));
  }

  const labels = merged.map((e) => PROTOCOL_LABEL[e.protocol]).join(', ');
  const size = trading?.bucket ? `, account value ${trading.bucket}` : '';
  root.setAttribute('aria-label', `Kaito on-chain signal: ${labels}${size}`);
}

function buildTradingChip(trading: BadgeTrading): HTMLElement | null {
  const tier = accountSizeTierFromBucket(trading.bucket);
  if (tier == null) return null;

  const chip = document.createElement('div');
  chip.className = 'signal-name-tag__pill signal-name-tag__pill--value';
  chip.append(createDotsGlyph(tier));
  const label = document.createElement('span');
  label.className = 'signal-name-tag__value-label';

  label.textContent = formatAccountSize(tier);
  chip.append(label);
  return chip;
}

function mergeProtocols(entries: NameTagEntry[], trading?: BadgeTrading): NameTagEntry[] {
  if (!trading?.platforms.length) return entries;
  const seen = new Set(entries.map((e) => e.protocol));
  const extra = trading.platforms
    .filter(isSignalProtocol)
    .filter((protocol) => !seen.has(protocol))
    .sort((a, b) => SIGNAL_PROTOCOLS.indexOf(a) - SIGNAL_PROTOCOLS.indexOf(b))
    .map((protocol) => ({ protocol, positionsCount: null }));
  return extra.length ? [...entries, ...extra] : entries;
}

function createDotsGlyph(tier: AccountSizeTier): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'signal-name-tag__dots');
  ACCOUNT_SIZE_DOT_CELLS.forEach((cell, i) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', String(cell.cx));
    c.setAttribute('cy', String(cell.cy));
    c.setAttribute('r', String(ACCOUNT_SIZE_DOT_R));
    c.setAttribute('fill', i < tier ? 'var(--nt-dot-on, #9aa6b2)' : 'var(--nt-dot-off, #3a424c)');
    svg.append(c);
  });
  return svg;
}

function buildSinglePill(entry: NameTagEntry, isDark: boolean): HTMLElement {
  const palette = getSingleNameTagPalette(entry.protocol, isDark);
  const pill = document.createElement('div');
  pill.className = 'signal-name-tag__pill signal-name-tag__pill--single';
  applyFill(pill, palette);
  pill.append(createProtocolIcon(entry.protocol, 16, palette, true));

  pill.append(createCountLabel(entry.positionsCount as number));
  return pill;
}

function buildCombinedPill(entry: NameTagEntry, isDark: boolean): HTMLElement {
  const palette = getCombinedNameTagPalette(entry.protocol, isDark);

  const bare = entry.positionsCount == null;
  const pill = document.createElement('div');
  pill.className = bare
    ? 'signal-name-tag__pill signal-name-tag__pill--combined signal-name-tag__pill--bare'
    : 'signal-name-tag__pill signal-name-tag__pill--combined';
  if (!bare) applyFill(pill, palette);
  pill.append(
    createProtocolIcon(
      entry.protocol,
      15,
      bare ? { ...palette, iconBorder: undefined } : palette,
      false,
    ),
  );
  if (entry.positionsCount != null) pill.append(createCountLabel(entry.positionsCount));
  return pill;
}

function applyFill(pill: HTMLElement, palette: NameTagPalette): void {
  pill.style.setProperty('--nt-bg', palette.bg);
  pill.style.setProperty('--nt-text', palette.text);
}

function createProtocolIcon(
  protocol: SignalProtocol,
  size: number,
  palette: NameTagPalette,
  overlay: boolean,
): HTMLElement {
  const tile = document.createElement('span');
  tile.className = overlay
    ? 'signal-name-tag__icon signal-name-tag__icon--overlay'
    : 'signal-name-tag__icon';
  tile.style.width = `${size}px`;
  tile.style.height = `${size}px`;
  tile.style.setProperty('--nt-icon-border', palette.iconBorder ?? 'transparent');
  if (overlay) tile.style.setProperty('--nt-icon-shadow', palette.iconShadow ?? 'none');

  const img = document.createElement('img');
  img.className = 'signal-name-tag__img';
  img.src = platformMarkSrc(protocol);
  img.alt = PROTOCOL_LABEL[protocol];
  img.decoding = 'async';
  img.draggable = false;

  tile.append(img);
  return tile;
}

function createCountLabel(count: number): HTMLElement {
  const label = document.createElement('span');
  label.className = 'signal-name-tag__count';
  label.textContent = `${count} ${count === 1 ? 'position' : 'positions'}`;
  return label;
}
