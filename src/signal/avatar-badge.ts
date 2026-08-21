import type { AvatarSignalProfile } from "@/signal/types";
import {
  getTierPalette,
  type RingLayer,
  type RingStyle,
  type SmartFollowerTier,
} from "./avatar-badge-tiers";

const SVG_NS = "http://www.w3.org/2000/svg";

const KAITO_LOGO_PATH =
  "M2.51256 1.54422C2.51256 1.65634 2.51256 1.7124 2.52367 1.75867C2.55896 1.90566 2.67373 2.02043 2.82073 2.05572C2.86699 2.06683 2.92305 2.06683 3.03518 2.06683H3.99811C4.04721 2.06683 4.07177 2.06683 4.09531 2.06404C4.16894 2.05533 4.23872 2.02642 4.29694 1.98052C4.31556 1.96585 4.33292 1.94848 4.36765 1.91376L4.83855 1.44285C4.87328 1.40813 4.89064 1.39076 4.90532 1.37215C4.95122 1.31392 4.98012 1.24414 4.98884 1.17052C4.99162 1.14697 4.99162 1.12242 4.99162 1.07331V0.522613C4.99162 0.41049 4.99162 0.354429 5.00273 0.308163C5.03802 0.161168 5.15279 0.0463978 5.29979 0.0111076C5.34605 0 5.40212 0 5.51424 0H6.14405C6.25618 0 6.31224 0 6.3585 0.0111076C6.5055 0.0463978 6.62027 0.161168 6.65556 0.308163C6.66667 0.354429 6.66667 0.41049 6.66667 0.522613V1.15243C6.66667 1.26455 6.66667 1.32061 6.65556 1.36688C6.62027 1.51387 6.5055 1.62864 6.3585 1.66393C6.31224 1.67504 6.25618 1.67504 6.14405 1.67504H5.61743C5.56833 1.67504 5.54377 1.67504 5.52023 1.67783C5.4466 1.68654 5.37682 1.71545 5.3186 1.76134C5.29998 1.77602 5.28262 1.79338 5.24789 1.82811L4.72821 2.34778C4.69349 2.38251 4.67612 2.39987 4.66144 2.41849C4.61554 2.47671 4.58664 2.54649 4.57792 2.62012C4.57514 2.64366 4.57514 2.66822 4.57514 2.71733V3.95665C4.57514 4.00576 4.57514 4.03032 4.57792 4.05386C4.58664 4.12749 4.61554 4.19727 4.66144 4.25549C4.67612 4.27411 4.69348 4.29147 4.72821 4.3262L5.24056 4.83855C5.27529 4.87328 5.29265 4.89064 5.31127 4.90532C5.36949 4.95122 5.43928 4.98012 5.5129 4.98884C5.53645 4.99162 5.561 4.99162 5.61011 4.99162H6.14405C6.25618 4.99162 6.31224 4.99162 6.3585 5.00273C6.5055 5.03802 6.62027 5.15279 6.65556 5.29979C6.66667 5.34605 6.66667 5.40212 6.66667 5.51424V6.14405C6.66667 6.25618 6.66667 6.31224 6.65556 6.3585C6.62027 6.5055 6.5055 6.62027 6.3585 6.65556C6.31224 6.66667 6.25618 6.66667 6.14405 6.66667H5.51424C5.40212 6.66667 5.34605 6.66667 5.29979 6.65556C5.15279 6.62027 5.03802 6.5055 5.00273 6.3585C4.99162 6.31224 4.99162 6.25618 4.99162 6.14405V5.60069C4.99162 5.55158 4.99162 5.52702 4.98884 5.50348C4.98012 5.42985 4.95122 5.36007 4.90532 5.30185C4.89064 5.28323 4.87328 5.26587 4.83855 5.23114L4.33562 4.72821C4.30089 4.69348 4.28353 4.67612 4.26491 4.66144C4.20669 4.61554 4.13691 4.58664 4.06328 4.57792C4.03974 4.57514 4.01519 4.57514 3.96608 4.57514H3.03518C2.92305 4.57514 2.86699 4.57514 2.82073 4.58625C2.67373 4.62154 2.55896 4.73631 2.52367 4.8833C2.51256 4.92957 2.51256 4.98563 2.51256 5.09775V6.14405C2.51256 6.25618 2.51256 6.31224 2.50146 6.3585C2.46617 6.5055 2.35139 6.62027 2.2044 6.65556C2.15813 6.66667 2.10207 6.66667 1.98995 6.66667H0.522613C0.41049 6.66667 0.354429 6.66667 0.308163 6.65556C0.161168 6.62027 0.0463978 6.5055 0.0111076 6.3585C0 6.31224 0 6.25618 0 6.14405V4.67672C0 4.56459 0 4.50853 0.0111076 4.46227C0.0463978 4.31527 0.161168 4.2005 0.308163 4.16521C0.354429 4.1541 0.41049 4.1541 0.522613 4.1541H1.54423C1.65635 4.1541 1.71242 4.1541 1.75868 4.143C1.90568 4.10771 2.02045 3.99294 2.05574 3.84594C2.06684 3.79967 2.06684 3.74361 2.06684 3.63149V3.03518C2.06684 2.92305 2.06684 2.86699 2.05574 2.82073C2.02045 2.67373 1.90568 2.55896 1.75868 2.52367C1.71242 2.51256 1.65635 2.51256 1.54423 2.51256H0.522613C0.41049 2.51256 0.354429 2.51256 0.308163 2.50146C0.161168 2.46617 0.0463978 2.35139 0.0111076 2.2044C0 2.15813 0 2.10207 0 1.98995V0.522613C0 0.41049 0 0.354429 0.0111076 0.308163C0.0463978 0.161168 0.161168 0.0463978 0.308163 0.0111076C0.354429 0 0.41049 0 0.522613 0H1.98995C2.10207 0 2.15813 0 2.2044 0.0111076C2.35139 0.0463978 2.46617 0.161168 2.50146 0.308163C2.51256 0.354429 2.51256 0.41049 2.51256 0.522613V1.54422Z";

let gradientSeq = 0;

function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

function createRingLayer(
  shape: "circle" | "square",
  layer: RingLayer,
  defs: SVGElement,
  blurStdDeviation?: number,
): SVGElement {
  const id = gradientSeq++;
  const gradientId = `signal-avatar-ring-${id}`;
  const grad = svg("linearGradient", {
    id: gradientId,
    x1: "8.69565",
    y1: "7.06522",
    x2: "52.7174",
    y2: "45.6522",
    gradientUnits: "userSpaceOnUse",
  });
  grad.append(
    ...layer.stops.map((stop) =>
      svg(
        "stop",
        stop.offset === 0
          ? { "stop-color": stop.color }
          : { offset: String(stop.offset), "stop-color": stop.color },
      ),
    ),
  );
  defs.append(grad);

  const stroke: Record<string, string> = {
    stroke: `url(#${gradientId})`,
    "stroke-opacity": String(layer.opacity),
    "stroke-width": String(layer.strokeWidth),
    fill: "none",
  };
  if (blurStdDeviation !== undefined) {

    const filterId = `signal-avatar-ring-glow-${id}`;
    const filter = svg("filter", {
      id: filterId,
      x: "-20%",
      y: "-20%",
      width: "140%",
      height: "140%",
    });
    filter.append(svg("feGaussianBlur", { stdDeviation: String(blurStdDeviation) }));
    defs.append(filter);
    stroke.filter = `url(#${filterId})`;
  }

  return shape === "square"
    ? svg("rect", { x: "1", y: "1", width: "48", height: "48", rx: "2", ry: "2", ...stroke })
    : svg("circle", { cx: "25", cy: "25", r: "24", ...stroke });
}

function createRingSvg(shape: "circle" | "square", ring: RingStyle): SVGElement {
  const root = svg("svg", {
    viewBox: "0 0 50 50",
    fill: "none",
    preserveAspectRatio: "xMidYMid meet",
    "aria-hidden": "true",
  });
  const defs = svg("defs", {});
  root.append(defs);

  if (ring.glow) {
    root.append(createRingLayer(shape, ring.glow, defs, ring.glow.blurStdDeviation));
  }
  root.append(createRingLayer(shape, ring.main, defs));

  return root;
}

function createLogoSvg(): SVGElement {
  const root = svg("svg", {
    viewBox: "0 0 10 10",
    fill: "none",
    "aria-hidden": "true",
    class: "signal-avatar-badge__logo",
  });
  const group = svg("g", { transform: "translate(1.6667 1.6667)" });

  group.append(svg("path", { d: KAITO_LOGO_PATH }));
  root.append(group);
  return root;
}

export function createAvatarSignalBadgeElement(
  profile: AvatarSignalProfile,
): HTMLElement {
  const root = document.createElement("div");
  root.dataset.signalAvatarBadge = profile.tweetId;
  const shape = profile.avatarShape === "square" ? "square" : "circle";

  const classes = ["signal-avatar-badge", "signal-avatar-badge--hidden"];
  if (shape === "square") classes.push("signal-avatar-badge--square");
  if (profile.avatarSize === "compact")
    classes.push("signal-avatar-badge--compact");
  if (profile.avatarSize === "large")
    classes.push("signal-avatar-badge--large");
  root.className = classes.join(" ");

  const ring = document.createElement("div");
  ring.className = "signal-avatar-badge__ring";

  const label = document.createElement("div");
  label.className = "signal-avatar-badge__label";
  const value = document.createElement("span");
  value.className = "signal-avatar-badge__value";
  value.textContent = profile.value;
  label.append(createLogoSvg(), value);

  root.append(ring, label);
  return root;
}

export function setAvatarBadgeValue(badge: HTMLElement, value: string): void {
  const valueEl = badge.querySelector(".signal-avatar-badge__value");
  if (valueEl) valueEl.textContent = value;
}

export function updateAvatarBadgeTier(
  badge: HTMLElement,
  tier: SmartFollowerTier,
  isDark: boolean,
): void {
  const palette = getTierPalette(tier, isDark);
  badge.classList.remove("signal-avatar-badge--hidden");

  const ringContainer = badge.querySelector<HTMLElement>(".signal-avatar-badge__ring");
  if (ringContainer) {
    ringContainer.replaceChildren();
    if (palette.ring) {
      const shape = badge.classList.contains("signal-avatar-badge--square")
        ? "square"
        : "circle";
      ringContainer.append(createRingSvg(shape, palette.ring));
    }
  }

  const label = badge.querySelector<HTMLElement>(".signal-avatar-badge__label");
  if (label) {
    label.style.setProperty("--sab-pill-bg", palette.pillBg);
    label.style.setProperty("--sab-pill-border", palette.pillBorder);

    const blurPx =
      palette.pillBlur === false ? 0 : palette.pillBlur === true ? 2 : palette.pillBlur;
    label.style.setProperty("--sab-pill-blur", blurPx ? `blur(${blurPx}px)` : "none");
    label.style.setProperty("color", palette.text);
    label.style.setProperty("--sab-weight", String(palette.fontWeight));
  }
}
