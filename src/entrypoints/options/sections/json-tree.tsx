import 'json-formatter-js/dist/json-formatter.css';
import JSONFormatter from 'json-formatter-js';
import { createEffect, createSignal, on, Show, type Component } from 'solid-js';

export type TruncatedSnapshot = { truncated: true; chars: number; preview: string };

export function isTruncatedSnapshot(value: unknown): value is TruncatedSnapshot {
  const v = value as Record<string, unknown> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    v.truncated === true &&
    typeof v.chars === 'number' &&
    typeof v.preview === 'string'
  );
}

export function formatTruncated(snapshot: TruncatedSnapshot): string {
  const shown = snapshot.preview.length.toLocaleString('en-US');
  const total = snapshot.chars.toLocaleString('en-US');
  return `// truncated: showing first ${shown} of ${total} chars\n${snapshot.preview}`;
}

function copyTextFor(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (isTruncatedSnapshot(value)) return value.preview;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export const JsonTree: Component<{ value: unknown; rebuildKey: string }> = (props) => {
  let container: HTMLDivElement | undefined;
  let formatter: JSONFormatter | undefined;
  const [hasTree, setHasTree] = createSignal(false);

  const [allExpanded, setAllExpanded] = createSignal(false);
  const [copied, setCopied] = createSignal(false);

  const rebuild = (): void => {
    if (!container) return;
    container.replaceChildren();
    formatter = undefined;
    setAllExpanded(false);
    const value = props.value;
    if (value === undefined) {
      container.textContent = 'undefined';
      setHasTree(false);
      return;
    }
    if (isTruncatedSnapshot(value)) {
      const pre = document.createElement('pre');
      pre.className = 'debug-json-truncated';
      pre.textContent = formatTruncated(value);
      container.appendChild(pre);
      setHasTree(false);
      return;
    }
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    formatter = new JSONFormatter(value, 1, dark ? { theme: 'dark' } : {});
    container.appendChild(formatter.render());
    setHasTree(true);
  };

  createEffect(on(() => props.rebuildKey, rebuild));

  const toggleExpandAll = (): void => {
    if (!formatter) return;
    const next = !allExpanded();
    formatter.openAtDepth(next ? Infinity : 0);
    setAllExpanded(next);
  };

  const copy = (): void => {
    const text = copyTextFor(props.value);
    if (text === undefined) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {},
    );
  };

  return (
    <div class="debug-json-panel">
      <div class="debug-json-toolbar">
        <button
          type="button"
          class="debug-button debug-json-button"
          disabled={props.value === undefined}
          onClick={copy}
        >
          {copied() ? 'Copied' : 'Copy'}
        </button>
        <Show when={hasTree()}>
          <button type="button" class="debug-button debug-json-button" onClick={toggleExpandAll}>
            {allExpanded() ? 'Collapse all' : 'Expand all'}
          </button>
        </Show>
      </div>
      <div class="debug-json" ref={container} />
    </div>
  );
};
