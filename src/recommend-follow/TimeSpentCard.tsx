import type { JSX } from 'solid-js';
import { formatTimeSpent } from './format-time-spent';
import timeSpentIcon from './assets/time-spent-icon.svg';

export function TimeSpentCard(props: { seconds: number }): JSX.Element {
  return (
    <div class="rf-time-card">
      <div class="rf-time-card__group">
        <span class="rf-time-card__icon" aria-hidden="true">
          <img src={timeSpentIcon} alt="" width={40} height={40} />
        </span>
        <span class="rf-time-card__text">
          <h2 class="rf-time-card__title">Time spent on X</h2>
          <span class="rf-time-card__caption">Last 24h · Updates every 5 min</span>
        </span>
      </div>
      <span class="rf-time-card__value">{formatTimeSpent(props.seconds)}</span>
    </div>
  );
}
