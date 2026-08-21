
const SVG_NS = "http://www.w3.org/2000/svg";

function createInfoIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "signal-ad-flag-notice__icon");

  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", "8");
  circle.setAttribute("cy", "8");
  circle.setAttribute("r", "7");
  circle.setAttribute("stroke", "currentColor");
  circle.setAttribute("stroke-width", "1.3");

  const dot = document.createElementNS(SVG_NS, "circle");
  dot.setAttribute("cx", "8");
  dot.setAttribute("cy", "5");
  dot.setAttribute("r", "0.9");
  dot.setAttribute("fill", "currentColor");

  const stem = document.createElementNS(SVG_NS, "rect");
  stem.setAttribute("x", "7.25");
  stem.setAttribute("y", "7");
  stem.setAttribute("width", "1.5");
  stem.setAttribute("height", "5");
  stem.setAttribute("rx", "0.75");
  stem.setAttribute("fill", "currentColor");

  svg.append(circle, dot, stem);
  return svg;
}

export function createAdFlagNoticeElement(tweetId: string, count: number): HTMLElement {
  const row = document.createElement("div");
  row.className = "signal-ad-flag-notice";
  row.dataset.signalAdFlagNoticeTweetId = tweetId;

  const text = document.createElement("span");
  text.className = "signal-ad-flag-notice__text";

  row.append(createInfoIcon(), text);
  setAdFlagNoticeCount(row, count);
  return row;
}

export function setAdFlagNoticeCount(el: HTMLElement, count: number): void {
  const text = el.querySelector(".signal-ad-flag-notice__text");
  if (text) {
    text.textContent = `Flagged by ${count} Kaito user${count === 1 ? "" : "s"}`;
  }
  el.style.display = count > 0 ? "flex" : "none";
}
