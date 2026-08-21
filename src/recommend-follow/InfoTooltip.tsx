import { createSignal, createUniqueId, Show, type JSX } from 'solid-js';
import { InfoIcon } from '@/verify/ui/icons';

export function InfoTooltip(props: { text: string }): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const descriptionId = createUniqueId();

  return (
    <span class="rf-tooltip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        class="rf-tooltip__trigger"
        aria-describedby={descriptionId}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <InfoIcon size={16} />
      </button>
      <span id={descriptionId} class="rf-visually-hidden">
        {props.text}
      </span>
      <Show when={open()}>
        <span class="rf-tooltip__bubble" aria-hidden="true">
          <span class="rf-tooltip__box">{props.text}</span>
          <span class="rf-tooltip__arrow">
            <svg viewBox="0 0 27 8" width="27" height="8" fill="none">
              <path
                d="M12.1976 7.05379L6.37454 1.35468C5.8139 0.805971 5.06063 0.498691 4.27616 0.498691L0.469056 0.498692C0.20998 0.498693 -3.36875e-05 0.288652 4.05317e-09 0.0295764V0.00130671H0.5L14 0H26.5012C26.7767 0 27.0024 0.270641 26.7707 0.419677C26.693 0.469683 26.6005 0.498693 26.5012 0.498693L23.2771 0.498693C22.4611 0.498693 21.6803 0.831096 21.1147 1.41928L15.7482 6.99995C14.7852 8.00138 13.1905 8.02556 12.1976 7.05379Z"
                fill="#2A3242"
              />
              <path
                d="M27.0002 0.501308L23.5622 0.501307C22.7666 0.501307 22.0035 0.805066 21.4409 1.34576L15.7681 6.79759C14.7918 7.73588 13.2089 7.73588 12.2326 6.79759L6.55981 1.34576C5.99721 0.805068 5.23414 0.501308 4.4385 0.501308L0.000244145 0.501307"
                stroke="#474F5C"
              />
            </svg>
          </span>
        </span>
      </Show>
    </span>
  );
}
