import type { JSX } from 'solid-js';
import { InfoTooltip } from './InfoTooltip';

export function AccountsHeading(): JSX.Element {
  return (
    <div class="rf-section__heading">
      <h2 class="rf-section__title">Recommended Accounts</h2>
      <p class="rf-accounts-caption">
        <InfoTooltip text="Based on posts you viewed or interacted with, such as opening posts, media, profiles, or links." />
        Based on your activity over the last 7 days · Updated daily
      </p>
    </div>
  );
}
