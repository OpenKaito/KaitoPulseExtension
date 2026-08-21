
export const PROOF_ARMED_SESSION_KEY = 'kaito.proofArmed';

export const PROOF_ARMED_ATTR = 'data-kaito-proof-armed';

export const PROOF_RUNTIME_TEARDOWN_EVENT = 'kaito-proof-runtime-teardown-v1';

export function isProofArmed(): boolean {
  try {
    if (window.sessionStorage.getItem(PROOF_ARMED_SESSION_KEY) === '1') return true;
  } catch {

  }
  return document.documentElement?.hasAttribute(PROOF_ARMED_ATTR) === true;
}

export function whenProofArmed(onArmed: () => void): () => void {
  if (isProofArmed()) {
    onArmed();
    return () => undefined;
  }
  const root = document.documentElement;
  if (!root) return () => undefined;
  const observer = new MutationObserver(() => {
    if (!isProofArmed()) return;
    observer.disconnect();
    onArmed();
  });
  observer.observe(root, { attributes: true, attributeFilter: [PROOF_ARMED_ATTR] });
  return () => observer.disconnect();
}

export function markProofArmed(doc: Document): void {
  try {
    doc.defaultView?.sessionStorage.setItem(PROOF_ARMED_SESSION_KEY, '1');
  } catch {

  }
  doc.documentElement?.setAttribute(PROOF_ARMED_ATTR, '1');
}

export function clearProofArmed(doc: Document): void {
  try {
    doc.defaultView?.sessionStorage.removeItem(PROOF_ARMED_SESSION_KEY);
  } catch {

  }
  doc.documentElement?.removeAttribute(PROOF_ARMED_ATTR);
}
