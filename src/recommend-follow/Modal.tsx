import { onCleanup, onMount, type JSX } from 'solid-js';
import { CloseIcon } from '@/verify/ui/icons';

export function Modal(props: {
  onClose: () => void;
  showCloseButton?: boolean;
  labelledBy?: string;
  children: JSX.Element;
}): JSX.Element {
  let cardRef: HTMLDivElement | undefined;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') props.onClose();
  };
  onMount(() => document.addEventListener('keydown', onKeyDown));
  onCleanup(() => document.removeEventListener('keydown', onKeyDown));

  const onBackdropMouseDown = (event: MouseEvent): void => {
    if (cardRef && event.target instanceof Node && !cardRef.contains(event.target)) props.onClose();
  };

  return (
    <div class="rf-modal-backdrop" onMouseDown={onBackdropMouseDown}>
      <div class="rf-modal-card" role="dialog" aria-modal="true" aria-labelledby={props.labelledBy} ref={cardRef}>
        {props.showCloseButton !== false && (
          <button type="button" class="rf-modal-close" aria-label="Close" onClick={() => props.onClose()}>
            <CloseIcon size={16} />
          </button>
        )}
        {props.children}
      </div>
    </div>
  );
}
