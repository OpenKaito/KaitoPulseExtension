import { For, type Component } from 'solid-js';

export const TabSkeleton: Component<{ rows?: number }> = (props) => (
  <ul class="rf-list rf-list--flush" aria-hidden="true">
    <For each={Array.from({ length: props.rows ?? 4 })}>
      {() => (
        <li>
          <div class="rf-row rf-row--capped">
            <span class="rf-sk rf-sk--avatar" />
            <div class="rf-row__info">
              <div class="rf-row__top">
                <div class="rf-row__name-line">
                  <span class="rf-sk rf-sk--name" />
                  <span class="rf-sk rf-sk--handle" />
                </div>
                <span class="rf-sk rf-sk--button" />
              </div>
            </div>
          </div>
        </li>
      )}
    </For>
  </ul>
);
