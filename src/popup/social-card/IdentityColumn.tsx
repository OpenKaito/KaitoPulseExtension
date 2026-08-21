import { For, Match, Switch, type Component } from 'solid-js';
import { exact } from './format';
import { SCOPE_COPY, type WordmarkKind } from './theme';
import type { SocialCardData } from './view-model';

const Wordmark: Component<{ kind: WordmarkKind }> = (props) => (
  <Switch>
    <Match when={props.kind === 'ai-text'}>
      <div class="sc-wordmark">
        <span class="sc-wordmark__ai">AI</span>
      </div>
    </Match>
    <Match when={props.kind === 'trading-text'}>
      <div class="sc-wordmark">
        <span class="sc-wordmark__trading">stock trading</span>
      </div>
    </Match>
    <Match when={props.kind === 'crypto-svg'}>
      <div class="sc-wordmark sc-wordmark--crypto">
        <CryptoWordmarkSvg />
      </div>
    </Match>
  </Switch>
);

const CryptoWordmarkSvg: Component = () => (
  <svg width="163" height="31" viewBox="0 0 163 31" fill="none" role="img" aria-label="crypto">
    <g filter="url(#sc-crypto-wm-filter)">
      <path
        d="M11.4518 23.4294C9.32154 23.4294 7.45388 23.1345 5.84886 22.5446C4.24384 21.933 3.0036 21.0919 2.12814 20.0215C1.25267 18.9292 0.814941 17.6621 0.814941 16.2203V11.9605C0.814941 10.4968 1.25267 9.22976 2.12814 8.15932C3.0036 7.08889 4.24384 6.25876 5.84886 5.66893C7.45388 5.05725 9.32154 4.75141 11.4518 4.75141C14.6327 4.75141 17.1715 5.35217 19.0684 6.55367C20.9652 7.75518 21.972 9.3936 22.0887 11.4689H15.5227C15.4352 10.7043 15.0267 10.1036 14.2971 9.66667C13.5967 9.22976 12.6483 9.0113 11.4518 9.0113C10.1386 9.0113 9.13186 9.26252 8.43148 9.76497C7.73111 10.2674 7.38093 10.9992 7.38093 11.9605V16.2203C7.38093 17.1597 7.73111 17.8915 8.43148 18.4158C9.13186 18.9183 10.1386 19.1695 11.4518 19.1695C12.6483 19.1695 13.5967 18.962 14.2971 18.5469C15.0267 18.11 15.4352 17.4983 15.5227 16.7119H22.0887C21.972 18.7872 20.9652 20.4256 19.0684 21.6271C17.1715 22.8286 14.6327 23.4294 11.4518 23.4294Z"
        fill="url(#sc-crypto-wm-grad)"
      />
      <path
        d="M29.7757 23.1017V5.0791H35.904V8.51977H37.5674L35.6851 10.6169C35.6851 8.67269 36.2833 7.20904 37.4798 6.22599C38.6763 5.24294 40.4272 4.75141 42.7326 4.75141C45.3882 4.75141 47.4455 5.35217 48.9046 6.55367C50.3929 7.75518 51.1371 9.44821 51.1371 11.6328V13.1073H44.1333V11.9605C44.1333 10.9774 43.7686 10.2128 43.039 9.66667C42.3386 9.12053 41.3902 8.84746 40.1938 8.84746C38.9389 8.84746 37.9759 9.12053 37.3047 9.66667C36.6627 10.2128 36.3417 10.9774 36.3417 11.9605V23.1017H29.7757Z"
        fill="url(#sc-crypto-wm-grad)"
      />
      <path
        d="M61.0565 29L64.3395 22.2169L55.3222 5.0791H62.4572L66.0904 12.9435C66.3531 13.5333 66.6157 14.2542 66.8783 15.1062C67.1702 15.9363 67.389 16.6136 67.5349 17.1379C67.6808 16.6136 67.8851 15.9363 68.1478 15.1062C68.4396 14.2542 68.7168 13.5333 68.9794 12.9435L72.4813 5.0791H79.3099L67.9289 29H61.0565Z"
        fill="url(#sc-crypto-wm-grad)"
      />
      <path
        d="M85.0709 29V5.0791H91.418V8.51977H92.9501L91.418 9.66667C91.418 8.11563 91.9871 6.91412 93.1252 6.06215C94.2633 5.18832 95.8245 4.75141 97.8089 4.75141C100.231 4.75141 102.172 5.39586 103.631 6.68474C105.09 7.95179 105.819 9.65574 105.819 11.7966V16.3842C105.819 17.8041 105.484 19.0493 104.813 20.1198C104.171 21.1684 103.251 21.9876 102.055 22.5774C100.858 23.1454 99.4431 23.4294 97.8089 23.4294C95.8245 23.4294 94.2633 23.0034 93.1252 22.1514C91.9871 21.2776 91.418 20.0652 91.418 18.5141L92.9501 19.661H91.418L91.6369 24.0847V29H85.0709ZM95.4452 19.1695C96.6708 19.1695 97.6046 18.9183 98.2466 18.4158C98.9178 17.8915 99.2534 17.1597 99.2534 16.2203V11.9605C99.2534 10.9992 98.9178 10.2674 98.2466 9.76497C97.6046 9.26252 96.6708 9.0113 95.4452 9.0113C94.2487 9.0113 93.3148 9.27345 92.6437 9.79774C91.9725 10.3002 91.6369 11.0211 91.6369 11.9605V16.2203C91.6369 17.1597 91.9725 17.8915 92.6437 18.4158C93.3148 18.9183 94.2487 19.1695 95.4452 19.1695Z"
        fill="url(#sc-crypto-wm-grad)"
      />
      <path
        d="M125.938 23.1017C123.487 23.1017 121.561 22.5774 120.16 21.5288C118.759 20.4802 118.059 19.0384 118.059 17.2034V9.50282H111.712V5.0791H118.059V0H124.625V5.0791H133.598V9.50282H124.625V17.2034C124.625 18.1864 125.281 18.678 126.595 18.678H133.161V23.1017H125.938Z"
        fill="url(#sc-crypto-wm-grad)"
      />
      <path
        d="M151.309 23.4294C149.179 23.4294 147.326 23.1345 145.75 22.5446C144.174 21.933 142.949 21.0919 142.073 20.0215C141.227 18.9292 140.804 17.6621 140.804 16.2203V11.9605C140.804 10.5186 141.227 9.26252 142.073 8.19209C142.949 7.09981 144.174 6.25876 145.75 5.66893C147.326 5.05725 149.179 4.75141 151.309 4.75141C153.469 4.75141 155.322 5.05725 156.869 5.66893C158.444 6.25876 159.655 7.09981 160.502 8.19209C161.377 9.26252 161.815 10.5186 161.815 11.9605V16.2203C161.815 17.6621 161.377 18.9292 160.502 20.0215C159.655 21.0919 158.444 21.933 156.869 22.5446C155.322 23.1345 153.469 23.4294 151.309 23.4294ZM151.309 19.1695C152.593 19.1695 153.571 18.9183 154.242 18.4158C154.913 17.8915 155.249 17.1597 155.249 16.2203V11.9605C155.249 10.9992 154.913 10.2674 154.242 9.76497C153.571 9.26252 152.593 9.0113 151.309 9.0113C150.055 9.0113 149.077 9.26252 148.377 9.76497C147.705 10.2674 147.37 10.9992 147.37 11.9605V16.2203C147.37 17.1597 147.705 17.8915 148.377 18.4158C149.077 18.9183 150.055 19.1695 151.309 19.1695Z"
        fill="url(#sc-crypto-wm-grad)"
      />
    </g>
    <defs>
      <filter
        id="sc-crypto-wm-filter"
        x="-3.27826e-05"
        y="-0.169786"
        width="162.63"
        height="31.0035"
        filterUnits="userSpaceOnUse"
        color-interpolation-filters="sRGB"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="1.01872" />
        <feGaussianBlur stdDeviation="0.407487" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.32 0" />
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dx="-0.339573" />
        <feGaussianBlur stdDeviation="0.152808" />
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
        <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.32 0" />
        <feBlend mode="normal" in2="shape" result="effect2_innerShadow" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dx="0.339573" dy="-0.339573" />
        <feGaussianBlur stdDeviation="0.0848932" />
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
        <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.25 0" />
        <feBlend mode="normal" in2="effect2_innerShadow" result="effect3_innerShadow" />
      </filter>
      <linearGradient
        id="sc-crypto-wm-grad"
        x1="79.5093"
        y1="5"
        x2="79.5889"
        y2="32.7827"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#E1E6E6" />
        <stop offset="0.442084" stop-color="#939393" />
        <stop offset="1" stop-color="#515151" />
      </linearGradient>
    </defs>
  </svg>
);

const NameDotOverlay: Component = () => (
  <div class="sc-name__dots" aria-hidden="true">
    <For each={Array.from({ length: 49 * 6 }, (_, i) => i)}>
      {() => <div style={{ width: '2px', height: '2px', background: '#595a5c' }} />}
    </For>
  </div>
);

export const IdentityColumn: Component<{ data: SocialCardData }> = (props) => {
  const copy = () => SCOPE_COPY[props.data.scope];

  return (
    <div class="sc-identity">
      {}
      <div class="sc-identity__frame">
        {}
        <div class="sc-pixels" aria-hidden="true" />
        <Wordmark kind={copy().wordmark} />
        <div class="sc-identity__avatar">
          <img src={props.data.avatarUrl} alt={props.data.name} crossorigin="anonymous" />
        </div>
      </div>

      <div class="sc-identity__info">
        <div class="sc-identity__id">
          <div class="sc-name">
            {copy().wordmark === 'crypto-svg' && <NameDotOverlay />}
            <div class="sc-name__inner">
              <span class="sc-name__text">{props.data.name.toLowerCase()}</span>
            </div>
          </div>
          <span class="sc-handle">{props.data.handle}</span>
          <p class="sc-bio">{props.data.bio}</p>
        </div>

        {}
        <div class="sc-sf-pill">
          <div class="sc-sf-pill__label">
            <p class="sc-sf-pill__scope">{copy().label}</p>
            <p class="sc-sf-pill__sub">smart followers</p>
          </div>
          <div class="sc-sf-pill__value">
            <span>{exact(props.data.segmentSmartFollowers)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
