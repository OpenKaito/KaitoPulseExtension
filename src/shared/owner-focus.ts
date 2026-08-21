
export type OwnerFocusCallbacks = [
  isOwnerDocumentFocused: () => boolean,
  addOwnerWindowFocusListener: (listener: () => void) => () => void,
  addOwnerVisibilityListener: (listener: () => void) => () => void,
];

export function ownerFocusCallbacks(doc: Document): OwnerFocusCallbacks {
  const ownerWindow = doc.defaultView ?? window;
  return [
    () => doc.visibilityState === 'visible' && doc.hasFocus(),
    (listener) => {
      ownerWindow.addEventListener('focus', listener);
      return () => ownerWindow.removeEventListener('focus', listener);
    },
    (listener) => {
      doc.addEventListener('visibilitychange', listener);
      return () => doc.removeEventListener('visibilitychange', listener);
    },
  ];
}
