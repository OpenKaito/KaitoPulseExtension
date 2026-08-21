import { createMemo, onCleanup, onMount, Show, For, type JSX } from "solid-js";
import type { ChartPoint } from "../types";

let chartSeq = 0;
const W = 240;
const H = 30;
const PAD = 2;

export function Sparkline(props: {
  points: ChartPoint[];
  onScrub?: (point: ChartPoint | null) => void;
}): JSX.Element {
  const gradientId = `signal-popover-spark-${chartSeq++}`;

  const isDegenerate = createMemo(() => props.points.length < 2);
  const values = createMemo(() => props.points.map((p) => p.v));
  const min = createMemo(() => Math.min(...values()));
  const max = createMemo(() => Math.max(...values()));
  const span = createMemo(() => max() - min() || 1);
  const coords = createMemo(() =>
    values().map((v, i) => {
      const x = (i / (values().length - 1)) * W;
      const y = H - PAD - ((v - min()) / span()) * (H - PAD * 2);
      return [x, y] as const;
    }),
  );
  const lineD = createMemo(() =>
    coords()
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(" "),
  );

  let wrapRef!: HTMLDivElement;
  let svgRef!: SVGSVGElement;
  let crosshairRef!: SVGLineElement;
  let dotRef!: HTMLDivElement;

  let frame = 0;
  let clientX = 0;

  const paint = (): void => {
    frame = 0;
    if (isDegenerate()) return;
    const rect = svgRef.getBoundingClientRect();
    if (rect.width === 0) return;
    const cs = coords();
    const lastIndex = cs.length - 1;
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const i = Math.round(frac * lastIndex);
    const [ux, uy] = cs[i];

    crosshairRef.setAttribute("x1", String(ux));
    crosshairRef.setAttribute("x2", String(ux));
    dotRef.style.left = `${(ux / W) * 100}%`;
    dotRef.style.top = `${(uy / H) * 100}%`;
    props.onScrub?.(props.points[i]);
  };
  const onMove = (event: MouseEvent): void => {
    if (isDegenerate()) return;
    clientX = event.clientX;
    wrapRef.classList.add("is-hovering");
    if (frame === 0) frame = requestAnimationFrame(paint);
  };
  const onLeave = (): void => {
    if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    wrapRef.classList.remove("is-hovering");
    props.onScrub?.(null);
  };

  onMount(() => {
    wrapRef.addEventListener("mouseenter", onMove);
    wrapRef.addEventListener("mousemove", onMove);
    wrapRef.addEventListener("mouseleave", onLeave);
  });
  onCleanup(() => {
    if (frame !== 0) cancelAnimationFrame(frame);
    wrapRef.removeEventListener("mouseenter", onMove);
    wrapRef.removeEventListener("mousemove", onMove);
    wrapRef.removeEventListener("mouseleave", onLeave);
  });

  return (
    <div class="signal-popover__chartwrap" ref={wrapRef}>
      <Show
        when={!isDegenerate()}
        fallback={
          <svg class="signal-popover__chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" fill="none" aria-hidden="true">
            <path
              d={`M0 ${(H / 2).toFixed(1)} L${W} ${(H / 2).toFixed(1)}`}
              stroke="#10c2a3"
              stroke-width="1.5"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
          </svg>
        }
      >
        <svg ref={svgRef} class="signal-popover__chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#10c2a3" stop-opacity="0.18" />
              <stop offset="1" stop-color="#10c2a3" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d={`${lineD()} L${W} ${H} L0 ${H} Z`} fill={`url(#${gradientId})`} />
          <path
            d={lineD()}
            stroke="#10c2a3"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
          <line ref={crosshairRef} class="signal-popover__crosshair" x1="0" x2="0" y1="0" y2={H} vector-effect="non-scaling-stroke" />
        </svg>
        <div class="signal-popover__chartdot" ref={dotRef} />
      </Show>
    </div>
  );
}

export function ChartGroup(props: {
  charts: Record<string, ChartPoint[]>;
  selected?: string;
  card?: "hyperliquid" | "polymarket";
  wide?: boolean;
  pnlLabel?: string;
  pnlValue?: string;
  pnlValueModifier?: "loss" | "gain";
  onSelectPeriod?: (period: string) => void;
}): JSX.Element {
  const periodKeys = createMemo(() => Object.keys(props.charts));
  const selected = createMemo(() => props.selected ?? periodKeys()[periodKeys().length - 1]);

  let valueRef!: HTMLDivElement;
  let dateRef!: HTMLSpanElement;

  const valueClassFor = (modifier: "loss" | "gain" | undefined): string =>
    `signal-popover__pnl-value signal-popover__num${modifier ? ` signal-popover__value--${modifier}` : ""}`;

  const handleScrub = (point: ChartPoint | null): void => {
    if (point) {
      valueRef.className = valueClassFor(point.v < 0 ? "loss" : "gain");
      valueRef.textContent = point.label;
      dateRef.textContent = point.time;
    } else {
      valueRef.className = valueClassFor(props.pnlValueModifier);
      valueRef.textContent = props.pnlValue ?? "";
      dateRef.textContent = "";
    }
  };

  return (
    <div class={`signal-popover__chartgroup${props.wide ? " signal-popover__chartgroup--wide" : ""}`}>
      <div class="signal-popover__pnlrow">
        <div class="signal-popover__pnl-label">{props.pnlLabel ?? "PnL"}</div>
        <div class="signal-popover__toggles">
          <For each={periodKeys()}>
            {(period) => {
              const active = () => period === selected();
              return (
                <div
                  class={`signal-popover__toggle${active() ? " signal-popover__toggle--active" : ""}`}
                  role={props.card ? "button" : undefined}
                  aria-pressed={props.card ? (active() ? "true" : "false") : undefined}
                  onClick={props.card ? () => props.onSelectPeriod?.(period) : undefined}
                >
                  {period === "ALL" ? "All" : period}
                </div>
              );
            }}
          </For>
        </div>
      </div>
      <Show when={props.pnlValue != null}>
        <div class="signal-popover__pnl-valuerow">
          <div ref={valueRef} class={valueClassFor(props.pnlValueModifier)}>
            {props.pnlValue}
          </div>
          <span ref={dateRef} class="signal-popover__pnl-date" />
        </div>
      </Show>
      <Sparkline
        points={props.charts[selected()] ?? []}
        onScrub={props.pnlValue != null ? handleScrub : undefined}
      />
    </div>
  );
}
