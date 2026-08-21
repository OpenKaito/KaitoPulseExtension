
export function createAdFlagButtonElement(tweetId: string, isDark: boolean): HTMLElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = isDark ? "signal-ad-flag-btn signal-ad-flag-btn--dark" : "signal-ad-flag-btn";
  btn.dataset.signalAdFlagTweetId = tweetId;
  btn.textContent = "Ad?";
  btn.setAttribute("aria-label", "Report a Paid Partnership violation");
  return btn;
}

export function setAdFlagButtonState(btn: HTMLElement, flagged: boolean): void {
  btn.classList.toggle("signal-ad-flag-btn--flagged", flagged);
}
