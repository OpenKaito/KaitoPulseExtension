import { createSignal, type Accessor, type Setter, Show, Switch, Match, type JSX } from "solid-js";
import { render } from "solid-js/web";
import type { SignalPopoverData, SignalProfileSnapshot, SignalProtocol } from "./types";
import { HyperliquidCard, PolymarketCard, UserHeader } from "./shared/cards";
import { createLogger } from "./logger";
import { hostPrefersDark } from "./host-theme";
import { hoverCardToPopoverData } from "./social-card-map";
import { PopoverSkeleton, PopoverError } from "./name-tag-popover-states";
import { PopoverTotalsRow } from "./name-tag-popover-totals";
import { getHoverCard } from "./hover-card-store";
import { positionFloating } from "./shared/floating-position";
import { attachDismissWatcher } from "./shared/dismiss";
import popoverCss from "./name-tag-popover.css?inline";

import popoverV2Css from "./name-tag-popover-v2.css?inline";
import { createShadowHost } from "./shared/shadow-host";

type ExpandedCard = "hyperliquid" | "polymarket" | null;
type PopoverStatus = "idle" | "loading" | "loaded" | "error";

const OPEN_DELAY = 120;
const CLOSE_DELAY = 200;

const ALL_SIGNAL_PROTOCOLS: SignalProtocol[] = ["hyperliquid", "polymarket"];

export async function loadPopoverData(twitterId: string): Promise<SignalPopoverData> {
  const result = await getHoverCard(twitterId);
  if (!result) {
    throw new Error("hover-card returned no data");
  }
  return hoverCardToPopoverData(result);
}

type PopoverEntry = {
  load: () => Promise<SignalPopoverData>;

  resolveProfile?: () => SignalProfileSnapshot | undefined;
  data?: SignalPopoverData;
  inflight?: Promise<SignalPopoverData>;

  platforms?: SignalProtocol[];
};

function PopoverPanel(props: {
  ref: (el: HTMLDivElement) => void;
  profile: Accessor<SignalProfileSnapshot | undefined>;
  status: Accessor<PopoverStatus>;
  data: Accessor<SignalPopoverData | null>;

  platforms: Accessor<SignalProtocol[]>;
  expanded: Accessor<ExpandedCard>;

  hyperliquidPeriod: Accessor<string>;
  onToggle: (card: "hyperliquid" | "polymarket") => void;
  onSelectHyperliquidPeriod: (period: string) => void;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div class="signal-popover" role="dialog" ref={props.ref}>
      <Show when={props.profile()}>
        {(profile) => (
          <UserHeader
            profile={profile()}
            bioPending={() => props.status() === "idle" || props.status() === "loading"}
            bio={() => props.data()?.bio}
          />
        )}
      </Show>
      {}
      <Show when={props.status() === "loaded" && props.data()?.totals}>
        {(totals) => <PopoverTotalsRow totals={totals()} />}
      </Show>
      <div class="signal-popover__body" aria-busy={props.status() === "loading" ? "true" : undefined}>
        <Switch>
          <Match when={props.status() === "loading"}>
            <PopoverSkeleton platforms={props.platforms} />
          </Match>
          <Match when={props.status() === "error"}>
            <PopoverError onRetry={props.onRetry} />
          </Match>
          <Match when={props.status() === "loaded"}>
            <Show when={props.data()?.hyperliquid}>
              {(hl) => (
                <HyperliquidCard
                  data={hl()}
                  expanded={props.expanded() === "hyperliquid"}
                  period={props.hyperliquidPeriod()}
                  onToggle={() => props.onToggle("hyperliquid")}
                  onSelectPeriod={props.onSelectHyperliquidPeriod}
                />
              )}
            </Show>
            <Show when={props.data()?.polymarket}>
              {(pm) => (
                <PolymarketCard
                  data={pm()}
                  expanded={props.expanded() === "polymarket"}
                  onToggle={() => props.onToggle("polymarket")}
                />
              )}
            </Show>
          </Match>
        </Switch>
      </div>
    </div>
  );
}

export class NameTagPopover {
  private readonly logger = createLogger("popover");
  private readonly document: Document;
  private readonly window: Window;
  private readonly entries = new WeakMap<HTMLElement, PopoverEntry>();

  private rootEl: HTMLElement | null = null;
  private host: HTMLElement | null = null;
  private dispose: (() => void) | null = null;
  private currentTag: HTMLElement | null = null;

  private status!: Accessor<PopoverStatus>;
  private setStatus!: Setter<PopoverStatus>;
  private data!: Accessor<SignalPopoverData | null>;
  private setData!: Setter<SignalPopoverData | null>;
  private platforms!: Accessor<SignalProtocol[]>;
  private setPlatforms!: Setter<SignalProtocol[]>;
  private expanded!: Accessor<ExpandedCard>;
  private setExpanded!: Setter<ExpandedCard>;
  private hyperliquidPeriod!: Accessor<string>;
  private setHyperliquidPeriod!: Setter<string>;
  private profile!: Accessor<SignalProfileSnapshot | undefined>;
  private setProfile!: Setter<SignalProfileSnapshot | undefined>;

  private hoverRects: { tag: DOMRect; pop: DOMRect } | null = null;

  private pointerInsidePopover = false;
  private openTimer: ReturnType<typeof setTimeout> | undefined;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private stopDismissWatcher: (() => void) | null = null;

  private onOpenHook?: () => void;

  constructor(doc: Document = document) {
    this.document = doc;
    this.window = doc.defaultView ?? window;
    [this.status, this.setStatus] = createSignal<PopoverStatus>("idle");
    [this.data, this.setData] = createSignal<SignalPopoverData | null>(null);
    [this.platforms, this.setPlatforms] = createSignal<SignalProtocol[]>(ALL_SIGNAL_PROTOCOLS);
    [this.expanded, this.setExpanded] = createSignal<ExpandedCard>(null);
    [this.hyperliquidPeriod, this.setHyperliquidPeriod] = createSignal<string>("ALL");
    [this.profile, this.setProfile] = createSignal<SignalProfileSnapshot | undefined>(undefined);
  }

  setOnOpen(cb: () => void): void {
    this.onOpenHook = cb;
  }

  register(
    tag: HTMLElement,
    load: () => Promise<SignalPopoverData>,
    resolveProfile?: () => SignalProfileSnapshot | undefined,
  ): void {

    const existing = this.entries.get(tag);
    this.entries.set(tag, {
      load,
      resolveProfile,
      data: existing?.data,
      inflight: existing?.inflight,
      platforms: existing?.platforms,
    });
    tag.addEventListener("mouseenter", this.onTagEnter);
    tag.addEventListener("mouseleave", this.onTagLeave);
  }

  updatePlatforms(tag: HTMLElement, protocols: SignalProtocol[]): void {
    const entry = this.entries.get(tag);
    if (!entry) return;
    entry.platforms = protocols;
    if (this.currentTag === tag && this.status() === "loading") {
      this.setPlatforms(protocols);

      this.position(tag.getBoundingClientRect());
    }
  }

  unregister(tag: HTMLElement): void {
    tag.removeEventListener("mouseenter", this.onTagEnter);
    tag.removeEventListener("mouseleave", this.onTagLeave);
    this.entries.delete(tag);
    if (this.currentTag === tag) this.close();
  }

  private onTagEnter = (event: Event): void => {
    const tag = event.currentTarget as HTMLElement;
    this.cancelClose();
    if (this.currentTag === tag && this.rootEl?.classList.contains("signal-popover--open")) {
      return;
    }
    this.cancelOpen();
    this.openTimer = setTimeout(() => this.open(tag), OPEN_DELAY);
  };

  private onTagLeave = (): void => {
    this.cancelOpen();
  };

  private onPointerMove = (event: MouseEvent): void => {
    const rects = this.hoverRects;
    this.pointerInsidePopover = !!rects && this.withinRect(rects.pop, event.clientX, event.clientY);
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

    try {
      this.ensureElement();
      this.currentTag = tag;
      this.setHyperliquidPeriod("ALL");
      this.pointerInsidePopover = false;

      this.rootEl!.classList.toggle("signal-popover--dark", hostPrefersDark(this.document));

      this.setProfile(entry.resolveProfile?.());

      if (entry.data) {
        this.setData(entry.data);
        this.setStatus("loaded");
        this.setExpanded(null);
      } else {
        this.setData(null);
        this.setPlatforms(entry.platforms ?? ALL_SIGNAL_PROTOCOLS);
        this.setStatus("loading");
        this.setExpanded(null);
        this.loadInto(tag, entry);
      }

      this.position(tag.getBoundingClientRect());
      this.scrollToExpandedCard();
      this.rootEl!.classList.add("signal-popover--open");
      this.attachViewportListeners();
    } catch (error) {
      this.logger.error("failed to open popover", error);
    }
  }

  private loadInto(tag: HTMLElement, entry: PopoverEntry): void {
    if (entry.inflight) return;

    const promise = entry.load();
    entry.inflight = promise;

    promise.then(
      (data) => {
        entry.data = data;
        entry.inflight = undefined;
        if (this.currentTag !== tag || !this.isOpen()) return;
        this.setData(data);
        this.setStatus("loaded");
        this.setExpanded(null);
        this.position(tag.getBoundingClientRect());
        this.scrollToExpandedCard();
      },
      (error) => {
        entry.inflight = undefined;
        this.logger.error("failed to load popover data", error);
        if (this.currentTag !== tag || !this.isOpen()) return;
        this.setStatus("error");
        this.position(tag.getBoundingClientRect());
      },
    );
  }

  private isOpen(): boolean {
    return this.rootEl?.classList.contains("signal-popover--open") ?? false;
  }

  private toggle = (card: Exclude<ExpandedCard, null>): void => {
    this.setExpanded((prev) => (prev === card ? null : card));
    if (this.currentTag) this.position(this.currentTag.getBoundingClientRect());
  };

  private selectPeriod = (period: string): void => {
    this.setHyperliquidPeriod(period);
  };

  private scrollToExpandedCard(): void {
    const root = this.rootEl;
    if (!root) return;
    const card = this.expanded();
    if (!card || card === "hyperliquid") {
      root.scrollTop = 0;
      return;
    }
    const target = root.querySelector<HTMLElement>(`.signal-popover__card--${card}`);
    const header = root.querySelector<HTMLElement>(".signal-popover__user");
    if (!target) return;

    root.scrollTop = Math.max(0, target.offsetTop - (header?.offsetHeight ?? 0));
  }

  private retry = (): void => {
    const tag = this.currentTag;
    const entry = tag ? this.entries.get(tag) : undefined;
    if (tag && entry) {

      this.setPlatforms(entry.platforms ?? ALL_SIGNAL_PROTOCOLS);
      this.setStatus("loading");
      this.loadInto(tag, entry);
      this.position(tag.getBoundingClientRect());
    }
  };

  close = (): void => {
    if (!this.rootEl) return;
    this.rootEl.classList.remove("signal-popover--open");
    this.currentTag = null;
    this.setExpanded(null);
    this.hoverRects = null;
    this.pointerInsidePopover = false;
    this.detachViewportListeners();
  };

  private ensureElement(): HTMLElement {
    if (this.rootEl) return this.rootEl;
    const { host, shadow } = createShadowHost(popoverCss + "\n" + popoverV2Css);
    this.dispose = render(
      () => (
        <PopoverPanel
          ref={(el) => (this.rootEl = el)}
          profile={this.profile}
          status={this.status}
          data={this.data}
          platforms={this.platforms}
          expanded={this.expanded}
          hyperliquidPeriod={this.hyperliquidPeriod}
          onToggle={this.toggle}
          onSelectHyperliquidPeriod={this.selectPeriod}
          onRetry={this.retry}
        />
      ),
      shadow,
    );
    this.document.body.appendChild(host);
    this.host = host;
    return this.rootEl!;
  }

  private position(tagRect: DOMRect): void {
    const root = this.rootEl;
    if (!root) return;

    const { left, top } = positionFloating(
      tagRect,
      { width: root.offsetWidth, height: root.offsetHeight },
      this.window,
    );
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
    this.cancelOpen();
    this.cancelClose();
    this.detachViewportListeners();
    this.dispose?.();
    if (this.host) {
      this.host.remove();
      this.host = null;
    }
    this.rootEl = null;
    this.currentTag = null;
    this.setData(null);
    this.setExpanded(null);
  }
}
