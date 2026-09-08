import type { HoverCardStatsView, SmartFollowerStat } from './types';
import { verifiedBadge } from './shared/icons';

export function createHoverCardStatsElement(isDark: boolean): HTMLElement {
  const root = document.createElement('div');
  root.className = 'signal-hc-stats';
  applyTheme(root, isDark);
  root.append(buildSkeletonHeading(), buildSkeletonGrid());
  return root;
}

function buildSkeletonHeading(): HTMLElement {
  const heading = document.createElement('div');
  heading.className = 'signal-hc-stats__sk signal-hc-stats__sk--heading';
  return heading;
}

function buildSkeletonGrid(): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'signal-hc-stats__grid';
  grid.append(buildSkeletonRow(2), buildSkeletonRow(1));
  return grid;
}

function buildSkeletonRow(count: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'signal-hc-stats__row';
  for (let i = 0; i < count; i++) row.append(buildSkeletonCell());
  return row;
}

function buildSkeletonCell(): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'signal-hc-stats__cell';
  const label = document.createElement('span');
  label.className = 'signal-hc-stats__sk signal-hc-stats__sk--label';
  const value = document.createElement('span');
  value.className = 'signal-hc-stats__sk signal-hc-stats__sk--value';
  cell.append(value, label);
  return cell;
}

export const EMPTY_HOVER_CARD_STATS: HoverCardStatsView = { categories: [] };

export function isHoverCardStatsEmpty(view: HoverCardStatsView): boolean {
  return !view.verified && !view.active && view.categories.length === 0;
}

export function renderFollowerStats(
  container: HTMLElement,
  view: HoverCardStatsView,
  isDark: boolean,
): void {
  applyTheme(container, isDark);
  container.replaceChildren();
  if (isHoverCardStatsEmpty(view)) return;

  const verifiedRows = [view.verified, view.active].filter(
    (stat): stat is SmartFollowerStat => stat != null,
  );
  if (verifiedRows.length > 0) {
    container.append(buildStatsGrid(verifiedRows, 1));
    return;
  }

  const grid = buildStatsGrid(view.categories, 2);
  container.append(buildHeading(), grid);
  fixOverflowingRows(grid);
}

function fixOverflowingRows(grid: HTMLElement): void {
  for (const row of grid.children) {
    const cells = Array.from(row.children);
    if (cells.length < 2) continue;
    if (cells.some((cell) => cell.scrollWidth > cell.clientWidth)) {
      row.classList.add('signal-hc-stats__row--stack');
    }
  }
}

function applyTheme(container: HTMLElement, isDark: boolean): void {
  container.style.setProperty('--hc-label', isDark ? '#71767c' : '#546571');
  container.style.setProperty('--hc-value', isDark ? '#e7e9ea' : '#0f1419');
  container.style.setProperty('--hc-sk-rgb', isDark ? '255 255 255' : '0 0 0');
}

function buildHeading(): HTMLElement {
  const heading = document.createElement('div');
  heading.className = 'signal-hc-stats__heading';
  heading.textContent = 'Kaito Smart Followers';
  return heading;
}

function buildStatsGrid(stats: SmartFollowerStat[], perRow: number): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'signal-hc-stats__grid';
  for (let i = 0; i < stats.length; i += perRow) {
    grid.append(buildStatsRow(stats.slice(i, i + perRow)));
  }
  return grid;
}

function buildStatsRow(pair: SmartFollowerStat[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'signal-hc-stats__row';
  for (const stat of pair) row.append(buildCell(stat));
  return row;
}

function buildCell(stat: SmartFollowerStat): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'signal-hc-stats__cell';
  cell.append(buildValueRow(stat), buildLabel(stat.label));

  if (stat.verifiedBadge) cell.append(verifiedBadge('signal-hc-stats__badge'));
  return cell;
}

function buildLabel(text: string): HTMLElement {
  const label = document.createElement('span');
  label.className = 'signal-hc-stats__label';
  label.textContent = text;
  return label;
}

function buildValueRow(stat: SmartFollowerStat): HTMLElement {
  const row = document.createElement('div');
  row.className = 'signal-hc-stats__valuerow';
  const value = document.createElement('span');
  value.className = 'signal-hc-stats__value';
  value.textContent = stat.value;
  row.append(value);
  return row;
}
