import { type Component } from 'solid-js';
import partnerLockupUrl from './assets/kaito-yaps-news.svg?inline';
import { DataColumn } from './DataColumn';
import { IdentityColumn } from './IdentityColumn';
import type { SocialCardData } from './view-model';

export const SOCIAL_CARD_SNAP_ID = 'kaito-social-card-snap-target';

export const SOCIAL_CARD_WIDTH = 882;
export const SOCIAL_CARD_HEIGHT = 524;

const SystemBar: Component = () => (
  <div class="sc-sysbar">
    <div class="sc-sysbar__text">
      <span>KAITO</span>
      <span class="sc-sysbar__lower">(Based on last 12M data, updated every Sunday)</span>
    </div>
    <img class="sc-sysbar__logo" src={partnerLockupUrl} alt="Kaito · Yaps · News" />
  </div>
);

export const SocialCard: Component<{ data: SocialCardData }> = (props) => (
  <div id={SOCIAL_CARD_SNAP_ID} class="sc-card" data-scope={props.data.scope}>
    {}
    <div class="sc-glow" aria-hidden="true">
      <div class="sc-glow__ellipse" />
    </div>

    <div class="sc-card__body">
      <IdentityColumn data={props.data} />
      <DataColumn data={props.data} />
    </div>
    <SystemBar />

    {}
    <div class="sc-card__stroke" aria-hidden="true" />
  </div>
);
