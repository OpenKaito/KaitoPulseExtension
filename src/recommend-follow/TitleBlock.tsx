import type { JSX } from 'solid-js';

export function TitleBlock(props: { title: JSX.Element; subtitle: JSX.Element }): JSX.Element {
  return (
    <div class="rf-header rf-header--loose rf-header--flush">
      {props.title}
      <p class="rf-header__subtitle">{props.subtitle}</p>
    </div>
  );
}
