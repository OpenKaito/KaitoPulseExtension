import { createSignal, createEffect, For, Show, Switch, Match, type Accessor, type Setter, type JSX } from "solid-js";
import { render } from "solid-js/web";
import type { TokenChartResult, TokenChartPeriod } from "@/shared/token-chart";
import { SentimentChart } from "./sentiment-chart";
import { TokenChartSkeleton, TokenChartError } from "./popover-states";
import { getTokenChart } from "./store";
import { hostPrefersDark } from "../host-theme";
import { positionFloating } from "../shared/floating-position";
import { attachDismissWatcher } from "../shared/dismiss";
import { createShadowHost, markTopLayerHost, promoteToTopLayer } from "../shared/shadow-host";
import { kaitoLockup, closeIcon, moreIcon } from "../shared/icons";
import { resolveImageSrc, sendKaitoMessage } from "../messaging";
import { showCompletionToast } from "../shared/toast";
import { setSurface } from "../settings";
import { monogramColor, monogramLetter } from "./avatar";
import popoverCss from "./popover.css?inline";
import sentimentChartCss from "./sentiment-chart.css?inline";

type PopoverStatus = "idle" | "loading" | "loaded" | "error";

const OPEN_DELAY = 120;
const CLOSE_DELAY = 200;

const OFF_COMMIT_DELAY = 1000;

const PERIODS: TokenChartPeriod[] = ["7D", "30D", "3M", "6M", "12M"];
const DEFAULT_PERIOD: TokenChartPeriod = "12M";

function blockNativeCashtagHover(event: Event): void {
  event.stopPropagation();
}

export async function loadTokenChart(
  symbol: string,
  period: TokenChartPeriod,

  entity?: string,
): Promise<TokenChartResult> {
  const result = await getTokenChart(symbol, period, entity);
  if (!result) throw new Error("token-chart returned no data");
  return result;
}

type PopoverEntry = {
  symbol: string;
  name: string;
  logo?: string;
  load: (period: TokenChartPeriod) => Promise<TokenChartResult>;

  results: Map<TokenChartPeriod, TokenChartResult>;
};

function TokenAvatar(props: { symbol: Accessor<string | null>; logo: Accessor<string | null> }): JSX.Element {
  const [src, setSrc] = createSignal<string | null>(null);
  const [failed, setFailed] = createSignal(false);

  createEffect(() => {
    const url = props.logo();
    setSrc(null);
    setFailed(false);
    if (!url) return;
    resolveImageSrc(url, 32)
      .then((resolved) => {
        if (props.logo() === url) setSrc(resolved);
      })
      .catch(() => {
        if (props.logo() === url) setFailed(true);
      });
  });

  const showLogo = () => !failed() && src();

  return (
    <div
      class="token-chart-popover__avatar"
      style={showLogo() ? undefined : { background: monogramColor(props.symbol() ?? "") }}
    >
      <Show when={showLogo()} fallback={monogramLetter(props.symbol() ?? "?")}>
        {(resolvedSrc) => <img class="token-chart-popover__avatar-img" src={resolvedSrc()} alt="" draggable={false} />}
      </Show>
    </div>
  );
}

function TokenChartPanel(props: {
  ref: (el: HTMLDivElement) => void;
  symbol: Accessor<string | null>;
  name: Accessor<string | null>;
  logo: Accessor<string | null>;
  status: Accessor<PopoverStatus>;
  data: Accessor<TokenChartResult | null>;
  period: Accessor<TokenChartPeriod>;
  onPeriodChange: (period: TokenChartPeriod) => void;
  onRetry: () => void;
  onDismiss: (event: MouseEvent) => void;
  menuOpen: Accessor<boolean>;
  onToggleMenu: () => void;
  onOpenSettings: () => void;
  chartsOn: Accessor<boolean>;
  onToggleCharts: () => void;

  actionsRef: (el: HTMLDivElement) => void;
  dark: boolean;
}): JSX.Element {
  return (
    <div class="token-chart-popover" role="dialog" ref={props.ref}>
      <div class="token-chart-popover__header">
        <div class="token-chart-popover__identity">
          <TokenAvatar symbol={props.symbol} logo={props.logo} />
          <div class="token-chart-popover__identity-text">
            <span class="token-chart-popover__name">{props.name()}</span>
            <span class="token-chart-popover__symbol">{props.symbol()}</span>
          </div>
        </div>
        <div class="token-chart-popover__header-right">
          <div class="token-chart-popover__brand">
            <span class="token-chart-popover__brand-label">Powered by</span>
            <span class="token-chart-popover__brand-lockup">{kaitoLockup()}</span>
          </div>
          {}
          <div class="token-chart-popover__actions" ref={props.actionsRef}>
            <button
              type="button"
              class="token-chart-popover__icon-btn"
              aria-label="More options"
              title="More options"
              aria-haspopup="menu"
              aria-expanded={props.menuOpen()}
              onClick={props.onToggleMenu}
            >
              {moreIcon()}
            </button>
            <button
              type="button"
              class="token-chart-popover__icon-btn token-chart-popover__icon-btn--close"
              aria-label="Close"
              title="Close"
              onClick={props.onDismiss}
            >
              {closeIcon()}
            </button>
            {}
            <Show when={props.menuOpen()}>
              <div class="token-chart-popover__menu" role="group" aria-label="Chart options">
                {}
                <button
                  type="button"
                  class="token-chart-popover__menu-item token-chart-popover__menu-item--switch"
                  role="switch"
                  aria-checked={props.chartsOn()}
                  disabled={!props.chartsOn()}
                  onClick={props.onToggleCharts}
                >
                  <span class="token-chart-popover__menu-text">
                    <span class="token-chart-popover__menu-title">Show chart on hover</span>
                    <span class="token-chart-popover__menu-desc">Turn off to hide these cards on X</span>
                  </span>
                  <span
                    class="token-chart-popover__switch"
                    classList={{ "token-chart-popover__switch--on": props.chartsOn() }}
                    aria-hidden="true"
                  >
                    <span class="token-chart-popover__switch-thumb" />
                  </span>
                </button>
                {}
                <button type="button" class="token-chart-popover__menu-item" onClick={props.onOpenSettings}>
                  <span class="token-chart-popover__menu-title">Settings</span>
                </button>
              </div>
            </Show>
          </div>
        </div>
      </div>
      <div class="token-chart-popover__body">
        <div class="token-chart-popover__chart-header">
          <span class="token-chart-popover__chart-title">Price and Sentiment</span>
          <div class="token-chart-popover__periods">
            <For each={PERIODS}>
              {(p) => (
                <button
                  type="button"
                  class="token-chart-popover__period"
                  classList={{ "token-chart-popover__period--active": props.period() === p }}
                  onClick={() => props.onPeriodChange(p)}
                >
                  {p}
                </button>
              )}
            </For>
          </div>
        </div>
        <div class="token-chart-popover__chart" aria-busy={props.status() === "loading" ? "true" : undefined}>
          <Switch>
            <Match when={props.status() === "loading"}>
              <TokenChartSkeleton />
            </Match>
            <Match when={props.status() === "error"}>
              <TokenChartError onRetry={props.onRetry} />
            </Match>
            <Match when={props.status() === "loaded"}>
              <Show when={props.data()}>
                {(d) => <SentimentChart points={d().points} meta={d().meta} dark={props.dark} period={props.period()} />}
              </Show>
            </Match>
          </Switch>
        </div>
        <div class="token-chart-popover__legend">
          <Show when={!props.data() || props.data()!.meta.priceAvailable}>
            <span class="token-chart-popover__legend-item">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <line x1="2.666" y1="8" x2="13.333" y2="8" stroke="var(--sg-text-strong)" stroke-opacity="0.6" stroke-width="1.333" />
                <circle cx="8" cy="8" r="2.667" fill="#D9D9D9" />
              </svg>
              Price
            </span>
          </Show>
          <Show when={!props.data() || props.data()!.meta.sentimentAvailable}>
            <span class="token-chart-popover__legend-item">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <line x1="2.666" y1="8" x2="13.333" y2="8" stroke="var(--sg-text-strong)" stroke-width="1.333" />
                <path d="M10.665 8a2.667 2.667 0 0 1-5.333 0z" fill="#D8494A" />
                <path d="M10.665 8a2.667 2.667 0 0 0-5.333 0z" fill="#28AF7F" />
              </svg>
              Sentiment
            </span>
          </Show>
        </div>
      </div>
    </div>
  );
}

export class TokenChartPopover {
  private readonly document: Document;
  private readonly window: Window;
  private readonly entries = new WeakMap<HTMLElement, PopoverEntry>();

  private rootEl: HTMLElement | null = null;
  private host: HTMLElement | null = null;
  private dispose: (() => void) | null = null;
  private currentTag: HTMLElement | null = null;
  private destroyed = false;

  private loadSeq = 0;

  private onOpenHook?: () => void;

  private status!: Accessor<PopoverStatus>;
  private setStatus!: Setter<PopoverStatus>;
  private data!: Accessor<TokenChartResult | null>;
  private setData!: Setter<TokenChartResult | null>;
  private symbol!: Accessor<string | null>;
  private setSymbol!: Setter<string | null>;
  private name!: Accessor<string | null>;
  private setName!: Setter<string | null>;
  private logo!: Accessor<string | null>;
  private setLogo!: Setter<string | null>;
  private period!: Accessor<TokenChartPeriod>;
  private setPeriod!: Setter<TokenChartPeriod>;
  private dark!: Accessor<boolean>;
  private setDark!: Setter<boolean>;
  private menuOpen!: Accessor<boolean>;
  private setMenuOpen!: Setter<boolean>;

  private chartsOn!: Accessor<boolean>;
  private setChartsOn!: Setter<boolean>;
  private offTimer: ReturnType<typeof setTimeout> | undefined;

  private actionsEl: HTMLElement | null = null;
  private stopMenuDismissWatcher: (() => void) | null = null;

  private suppressedTag: HTMLElement | null = null;

  private hoverRects: { tag: DOMRect; pop: DOMRect } | null = null;
  private pointerInsidePopover = false;
  private openTimer: ReturnType<typeof setTimeout> | undefined;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private stopDismissWatcher: (() => void) | null = null;

  constructor(doc: Document = document) {
    this.document = doc;
    this.window = doc.defaultView ?? window;
    [this.status, this.setStatus] = createSignal<PopoverStatus>("idle");
    [this.data, this.setData] = createSignal<TokenChartResult | null>(null);
    [this.symbol, this.setSymbol] = createSignal<string | null>(null);
    [this.name, this.setName] = createSignal<string | null>(null);
    [this.logo, this.setLogo] = createSignal<string | null>(null);
    [this.period, this.setPeriod] = createSignal<TokenChartPeriod>(DEFAULT_PERIOD);
    [this.dark, this.setDark] = createSignal<boolean>(false);
    [this.menuOpen, this.setMenuOpen] = createSignal<boolean>(false);
    [this.chartsOn, this.setChartsOn] = createSignal<boolean>(true);
  }

  setOnOpen(cb: () => void): void {
    this.onOpenHook = cb;
  }

  register(
    anchor: HTMLElement,
    symbol: string,
    name: string,
    logo: string | undefined,
    load: (period: TokenChartPeriod) => Promise<TokenChartResult>,
  ): void {
    if (this.destroyed) return;
    const existing = this.entries.get(anchor);

    const reusable = existing?.symbol === symbol;
    if (existing && !reusable && this.currentTag === anchor) this.close();

    if (!reusable && this.suppressedTag === anchor) this.suppressedTag = null;
    this.entries.set(anchor, {
      symbol,
      name,
      logo,
      load,
      results: reusable ? existing!.results : new Map(),
    });
    anchor.addEventListener("mouseenter", this.onTagEnter);
    anchor.addEventListener("mouseleave", this.onTagLeave);
    anchor.addEventListener("mouseover", blockNativeCashtagHover);
    anchor.addEventListener("pointerover", blockNativeCashtagHover);
  }

  unregister(anchor: HTMLElement): void {
    anchor.removeEventListener("mouseenter", this.onTagEnter);
    anchor.removeEventListener("mouseleave", this.onTagLeave);
    anchor.removeEventListener("mouseover", blockNativeCashtagHover);
    anchor.removeEventListener("pointerover", blockNativeCashtagHover);
    this.entries.delete(anchor);
    if (this.suppressedTag === anchor) this.suppressedTag = null;
    if (this.currentTag === anchor) this.close();
  }

  private onTagEnter = (event: Event): void => {
    const tag = event.currentTarget as HTMLElement;

    if (this.suppressedTag && this.suppressedTag !== tag) this.suppressedTag = null;
    this.cancelClose();
    if (this.suppressedTag === tag) return;
    if (this.currentTag === tag && this.rootEl?.classList.contains("token-chart-popover--open")) {
      return;
    }
    this.cancelOpen();
    this.openTimer = setTimeout(() => this.open(tag), OPEN_DELAY);
  };

  private onTagLeave = (event: Event): void => {
    if (this.suppressedTag === event.currentTarget) this.suppressedTag = null;
    this.cancelOpen();
  };

  private onPointerMove = (event: MouseEvent): void => {
    const rects = this.hoverRects;
    this.pointerInsidePopover = !!rects && this.withinRect(rects.pop, event.clientX, event.clientY);

    if (this.menuOpen()) {
      this.cancelClose();
      return;
    }
    if (this.pointerInside(event.clientX, event.clientY)) {
      this.cancelClose();
    } else {
      this.scheduleClose();
    }
  };

  private withinRect(r: DOMRect, x: number, y: number): boolean {
    const T = 8;
    return x >= r.left - T && x <= r.right + T && y >= r.top - T && y <= r.bottom + T;
  }

  private pointerInside(x: number, y: number): boolean {
    const rects = this.hoverRects;
    if (!rects) return false;
    return this.withinRect(rects.pop, x, y) || this.withinRect(rects.tag, x, y);
  }

  private open(tag: HTMLElement): void {
    const entry = this.entries.get(tag);
    if (!entry) return;
    this.onOpenHook?.();

    this.cancelClose();

    this.invalidateLoads();

    this.closeMenu();

    this.clearOffTimer();
    this.setChartsOn(true);

    this.ensureElement();

    promoteToTopLayer(this.host!);
    this.currentTag = tag;
    this.pointerInsidePopover = false;
    const dark = hostPrefersDark(this.document);
    this.rootEl!.classList.toggle("token-chart-popover--dark", dark);
    this.setDark(dark);
    this.setSymbol(entry.symbol);
    this.setPeriod(DEFAULT_PERIOD);
    this.setName(entry.name);
    this.setLogo(entry.logo ?? null);

    this.paintCachedOrLoading(entry, DEFAULT_PERIOD);
    this.startLoad(tag, entry, DEFAULT_PERIOD);

    this.position(tag.getBoundingClientRect());
    this.rootEl!.classList.add("token-chart-popover--open");
    this.attachViewportListeners();
  }

  private invalidateLoads(): void {
    this.loadSeq++;
  }

  private paintCachedOrLoading(entry: PopoverEntry, period: TokenChartPeriod): void {
    const cached = entry.results.get(period);
    if (cached) {
      this.applyMetaIdentity(cached);
      this.setData(cached);
      this.setStatus("loaded");
    } else {
      this.setData(null);
      this.setStatus("loading");
    }
  }

  private startLoad(tag: HTMLElement, entry: PopoverEntry, period: TokenChartPeriod): void {
    const seq = ++this.loadSeq;
    entry.load(period).then(
      (data) => {

        if (data.symbol === entry.symbol) entry.results.set(period, data);
        if (seq !== this.loadSeq || this.currentTag !== tag || !this.isOpen()) return;
        this.applyMetaIdentity(data);
        this.setData(data);
        this.setStatus("loaded");
        this.position(tag.getBoundingClientRect());
      },
      (error) => {
        console.error("[token-chart] failed to load", error);
        if (seq !== this.loadSeq || this.currentTag !== tag || !this.isOpen()) return;

        if (this.data()) return;
        this.setStatus("error");
        this.position(tag.getBoundingClientRect());
      },
    );
  }

  private applyMetaIdentity(data: TokenChartResult): void {
    if (data.meta.name) this.setName(data.meta.name);
    if (data.meta.logo) this.setLogo(data.meta.logo);
  }

  private isOpen(): boolean {
    return this.rootEl?.classList.contains("token-chart-popover--open") ?? false;
  }

  private retry = (): void => {
    const tag = this.currentTag;
    const entry = tag ? this.entries.get(tag) : undefined;
    if (!tag || !entry) return;
    const period = this.period();
    this.paintCachedOrLoading(entry, period);
    this.startLoad(tag, entry, period);
    this.position(tag.getBoundingClientRect());
  };

  private onPeriodChange = (period: TokenChartPeriod): void => {
    const tag = this.currentTag;
    const entry = tag ? this.entries.get(tag) : undefined;
    if (!tag || !entry) return;
    this.setPeriod(period);
    this.paintCachedOrLoading(entry, period);
    this.startLoad(tag, entry, period);
    this.position(tag.getBoundingClientRect());
  };

  private dismiss = (event: MouseEvent): void => {
    const tag = this.currentTag;
    const overAnchor = !!this.hoverRects && this.withinRect(this.hoverRects.tag, event.clientX, event.clientY);
    this.close();
    if (overAnchor) this.suppressedTag = tag;
  };

  private toggleMenu = (): void => {
    if (this.menuOpen()) {

      this.closeMenu();
      return;
    }
    this.setMenuOpen(true);
    this.stopMenuDismissWatcher = attachDismissWatcher(this.window, this.document, () => this.actionsEl, {
      onOutsideClick: (event) => {
        this.closeMenu();

        if (!this.pointerInside(event.clientX, event.clientY)) this.close();
      },
    });
  };

  private closeMenu(): void {
    this.stopMenuDismissWatcher?.();
    this.stopMenuDismissWatcher = null;
    this.setMenuOpen(false);
  }

  private openSettings = (): void => {
    this.closeMenu();
    this.close();

    void sendKaitoMessage({ target: "kaitoExtension", action: "openOptions" })
      .then((response) => {
        if ("error" in response && response.error) throw new Error(response.error);
      })
      .catch((error: unknown) => {
        console.error("[token-chart] failed to open settings", error);
        showCompletionToast("error", "Could not open settings. Try again.");
      });
  };

  private toggleCharts = (): void => {
    if (!this.chartsOn()) return;
    this.setChartsOn(false);
    this.offTimer = setTimeout(this.commitChartsOff, OFF_COMMIT_DELAY);
  };

  private commitChartsOff = (): void => {
    this.offTimer = undefined;
    this.closeMenu();
    this.close();
    void setSurface("tokenChart.feed", false)

      .then(() => showCompletionToast("success", "Turned off. Reopen it from the Kaito popup → ⚙ → Settings."))
      .catch((error: unknown) => {
        console.error("[token-chart] failed to turn off cashtag charts", error);

        this.setChartsOn(true);
        showCompletionToast("error", "Could not turn this off. Try again.");
      });
  };

  private clearOffTimer(): boolean {
    if (this.offTimer === undefined) return false;
    clearTimeout(this.offTimer);
    this.offTimer = undefined;
    return true;
  }

  close = (): void => {

    this.closeMenu();

    if (this.clearOffTimer()) this.setChartsOn(true);
    if (!this.rootEl) return;
    this.invalidateLoads();
    this.rootEl.classList.remove("token-chart-popover--open");

    this.currentTag = null;
    this.hoverRects = null;
    this.pointerInsidePopover = false;
    this.detachViewportListeners();
  };

  private ensureElement(): HTMLElement {
    if (this.rootEl) return this.rootEl;
    const { host, shadow } = createShadowHost([popoverCss, sentimentChartCss]);
    this.dispose = render(
      () => (
        <TokenChartPanel
          ref={(el) => (this.rootEl = el)}
          symbol={this.symbol}
          name={this.name}
          logo={this.logo}
          status={this.status}
          data={this.data}
          period={this.period}
          onPeriodChange={this.onPeriodChange}
          onRetry={this.retry}
          onDismiss={this.dismiss}
          menuOpen={this.menuOpen}
          onToggleMenu={this.toggleMenu}
          onOpenSettings={this.openSettings}
          chartsOn={this.chartsOn}
          onToggleCharts={this.toggleCharts}
          actionsRef={(el) => (this.actionsEl = el)}
          dark={this.dark()}
        />
      ),
      shadow,
    );
    markTopLayerHost(host);
    this.document.body.appendChild(host);
    this.host = host;
    return this.rootEl!;
  }

  private position(tagRect: DOMRect): void {
    const root = this.rootEl;
    if (!root) return;
    const { left, top } = positionFloating(tagRect, { width: root.offsetWidth, height: root.offsetHeight }, this.window);
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
    this.hoverRects = { tag: tagRect, pop: root.getBoundingClientRect() };
  }

  private attachViewportListeners(): void {
    this.document.addEventListener("mousemove", this.onPointerMove);
    this.stopDismissWatcher = attachDismissWatcher(this.window, this.document, () => this.rootEl, {
      onScroll: () => {
        if (this.pointerInsidePopover) return;
        this.close();
      },
      onResize: () => this.close(),
    });
  }

  private detachViewportListeners(): void {
    this.document.removeEventListener("mousemove", this.onPointerMove);
    this.stopDismissWatcher?.();
    this.stopDismissWatcher = null;
  }

  private cancelOpen(): void {
    if (this.openTimer !== undefined) {
      clearTimeout(this.openTimer);
      this.openTimer = undefined;
    }
  }

  private cancelClose(): void {
    if (this.closeTimer !== undefined) {
      clearTimeout(this.closeTimer);
      this.closeTimer = undefined;
    }
  }

  private scheduleClose(): void {
    this.cancelClose();
    this.closeTimer = setTimeout(this.close, CLOSE_DELAY);
  }

  destroy(): void {
    this.destroyed = true;
    this.invalidateLoads();
    this.cancelOpen();
    this.cancelClose();
    this.clearOffTimer();
    this.detachViewportListeners();
    this.dispose?.();
    if (this.host) {
      this.host.remove();
      this.host = null;
    }
    this.rootEl = null;
    this.actionsEl = null;
    this.currentTag = null;
    this.suppressedTag = null;
    this.setData(null);
  }
}
