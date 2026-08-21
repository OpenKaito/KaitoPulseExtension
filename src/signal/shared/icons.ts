import { el, svg } from "./dom";
import { PROTOCOL_ICON_DATA_URI, PROTOCOL_LABEL } from "../protocol-icons";
import { KAITO_K_MARK_PATH, KAITO_LETTER_PATHS } from "@/shared/kaito-lockup-paths";

export function brandIcon(protocol: keyof typeof PROTOCOL_ICON_DATA_URI): HTMLElement {
  const wrap = el("div", "signal-popover__brand");
  const img = el("img", "signal-popover__brand-icon");
  img.src = PROTOCOL_ICON_DATA_URI[protocol];
  img.alt = PROTOCOL_LABEL[protocol];
  img.width = 24;
  img.height = 24;
  img.draggable = false;
  wrap.append(img);
  return wrap;
}

export function protocolChip(protocol: keyof typeof PROTOCOL_ICON_DATA_URI): HTMLElement {
  const wrap = el("div", "signal-popover__chip");
  const img = el("img", "signal-popover__chip-icon");
  img.src = PROTOCOL_ICON_DATA_URI[protocol];
  img.alt = "";
  img.width = 16;
  img.height = 16;
  img.draggable = false;
  const label = el("span", "signal-popover__chip-label");
  label.textContent = PROTOCOL_LABEL[protocol];
  wrap.append(img, label);
  return wrap;
}

export function checkIcon(): SVGElement {
  const root = svg("svg", {
    class: "signal-popover__verified-check",
    viewBox: "0 0 10 10",
    fill: "none",
    "aria-hidden": "true",
  });
  root.append(
    svg("path", {
      d: "M1.1619 5.76143C0.977914 5.56834 0.977883 5.26482 1.16183 5.07169L1.26487 4.9635C1.46189 4.75664 1.79189 4.75661 1.98894 4.96345L2.88717 5.90629C3.28128 6.31996 3.94127 6.31991 4.33532 5.90618L8.01106 2.04682C8.2081 1.83993 8.53814 1.83993 8.73518 2.04682L8.83825 2.15503C9.02217 2.34813 9.02217 2.65158 8.83827 2.84469L4.33583 7.57253C3.94181 7.98628 3.28182 7.98636 2.88769 7.57271L1.1619 5.76143Z",
      fill: "#07080a",
    }),
  );
  return root;
}

export function kaitoLockup(): SVGElement {
  const root = svg("svg", {
    class: "signal-popover__user-logo",
    viewBox: "0 0 72.0005 13.8685",
    fill: "none",
    "aria-hidden": "true",
    role: "img",
  });
  root.append(
    svg("path", { d: KAITO_K_MARK_PATH, fill: "#32ffdc" }),
    svg("path", {
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: KAITO_LETTER_PATHS[0],
      fill: "var(--sg-text-strong, #07080a)",
    }),
    ...KAITO_LETTER_PATHS.slice(1).map((d) => svg("path", { d, fill: "var(--sg-text-strong, #07080a)" })),
  );
  return root;
}

export function triangle(direction: "up" | "down"): SVGElement {
  const root = svg("svg", {
    class: "signal-popover__triangle",
    viewBox: "0 0 12 12",
    fill: "none",
    "aria-hidden": "true",
  });
  const points = direction === "up" ? "6,3 10,9 2,9" : "6,9 10,3 2,3";
  root.append(svg("polygon", { points, fill: "currentColor" }));
  return root;
}

export function closeIcon(): SVGElement {
  const root = svg("svg", {
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": "true",
  });
  root.append(
    svg("path", {
      d: "M4 4 12 12M12 4 4 12",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linecap": "round",
    }),
  );
  return root;
}

export function moreIcon(): SVGElement {
  const root = svg("svg", {
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": "true",
  });
  root.append(
    ...[3.25, 8, 12.75].map((cy) =>
      svg("circle", { cx: "8", cy: String(cy), r: "1.35", fill: "currentColor" }),
    ),
  );
  return root;
}

export function chevron(direction: "down" | "right"): SVGElement {
  const root = svg("svg", {
    class: "signal-popover__chev",
    viewBox: "0 0 12 12",
    fill: "none",
    "aria-hidden": "true",
  });
  const d = direction === "down" ? "M3 4.5 6 7.5 9 4.5" : "M4.5 3 7.5 6 4.5 9";
  root.append(
    svg("path", {
      d,
      stroke: "currentColor",
      "stroke-width": "1.2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
  );
  return root;
}
