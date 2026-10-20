import { revealNoun } from '../format/platforms';
import { For, Show, createSignal, type Component } from 'solid-js';
import { ArrowUpRightIcon, ChevronDownIcon, EyeIcon, EyeOffIcon } from '@/verify/ui/icons';
import { BrandChip } from './BrandChip';
import type { IncludedAccount, PlatformGroup } from '../data/types';
import {
  FX_APPROXIMATE_TITLE,
  approxFigure,
  formatCompactUsd,
  formatCount,
  formatPoints,
  formatSignedUsdCents,
  formatUsd,
  pnlTone,
} from '../format/numbers';
import { platformCredentialsUrl } from '../links';

const Metric: Component<{
  label: string;
  value: number | null;
  signed?: boolean;
  note?: string;
  caption?: string | null;
  native?: string | null;
  approx?: boolean;
}> = (props) => {
  const tone = () => (props.signed ? pnlTone(props.value) : null);
  const native = () => (props.value == null ? props.native : null);
  const figure = () =>
    approxFigure(
      props.signed ? formatSignedUsdCents(props.value) : formatUsd(props.value),
      props.approx,
    );
  return (
    <div class="pv-pmetric">
      <p class="pv-pmetric__label">
        {props.label}
        <Show when={props.note}>{(note) => <span class="pv-pmetric__note">{note()}</span>}</Show>
      </p>
      <p
        class="pv-pmetric__value"
        classList={{
          'pv-profit': tone() === 'profit',
          'pv-loss': tone() === 'loss',
          'pv-pmetric__value--native': native() != null,
        }}
        title={figure().approx && native() == null ? FX_APPROXIMATE_TITLE : undefined}
      >
        <Show when={native()} fallback={figure().text}>
          {(amount) => amount()}
        </Show>
      </p>
      <Show when={props.caption}>
        {(caption) => <p class="pv-pmetric__caption">{caption()}</p>}
      </Show>
    </div>
  );
};

const SingleIdentity: Component<{ account: IncludedAccount }> = (props) => {
  const [revealed, setRevealed] = createSignal(false);
  const label = () => props.account.profile?.name ?? props.account.accountLabel;
  const canReveal = () => props.account.accountId !== label();
  const revealLabel = () =>
    `${revealed() ? 'Hide' : 'Show'} full ${revealNoun(props.account.platform)}`;

  return (
    <div class="pv-pcard__identity">
      <p class="pv-pcard__ident" classList={{ 'pv-pcard__ident--full': revealed() }}>
        {revealed() ? props.account.accountId : label()}
      </p>
      <Show when={canReveal()}>
        <button
          type="button"
          class="pv-pcard__reveal"
          aria-pressed={revealed()}
          aria-label={revealLabel()}
          title={revealLabel()}
          onClick={() => setRevealed(!revealed())}
        >
          {}
          <Show when={revealed()} fallback={<EyeOffIcon size={16} />}>
            <EyeIcon size={16} />
          </Show>
        </button>
      </Show>
      {}
      <Show when={props.account.publicOnX === false}>
        <span class="pv-pcard__tag" title="Hidden from X">
          Hide
        </span>
      </Show>
    </div>
  );
};

const GroupIdentity: Component<{ group: PlatformGroup; onOpen: (platform: string) => void }> = (
  props,
) => {
  const single = () => (props.group.accounts.length === 1 ? props.group.accounts[0] : undefined);
  const countLabel = (): string => {
    const total = props.group.accountCount;
    return `${total} account${total === 1 ? '' : 's'}`;
  };

  return (
    <Show
      when={single()}
      fallback={
        <button
          type="button"
          class="pv-pcard__more"
          onClick={() => props.onOpen(props.group.platform)}
        >
          <span>{countLabel()}</span>
          <span class="pv-chevron-right" aria-hidden="true">
            <ChevronDownIcon size={12} />
          </span>
        </button>
      }
    >
      {}
      {(account) => <SingleIdentity account={account()} />}
    </Show>
  );
};

const Figure: Component<{ label: string; value: string; class?: string }> = (props) => (
  <div class="pv-pmetric">
    <p class="pv-pmetric__label">{props.label}</p>
    <p class={`pv-pmetric__value ${props.class ?? ''}`}>{props.value}</p>
  </div>
);

function tierClass(tier: string): string {
  return `pv-tier pv-tier--${tier.toLowerCase().replace(/[^a-z]/g, '')}`;
}

export const MetricBlocks: Component<{
  platform: string;
  referral?: { users: number | null; volume: number | null };
  referralVerifiable?: boolean;
  points?: { total: number | null; tier: string | null };
}> = (props) => (
  <>
    <Show when={props.referral}>
      {(referral) => (
        <div class="pv-pcard__metrics">
          <Figure label="Referred Users" value={formatCount(referral().users)} />
          <Figure label="Referred Volume" value={formatCompactUsd(referral().volume)} />
        </div>
      )}
    </Show>
    <Show when={props.points}>
      {(points) => (
        <div class="pv-pcard__metrics">
          <Figure label="Total Points" value={formatPoints(points().total)} />
          <Figure
            label="Tier"
            value={points().tier ?? '-'}
            class={points().tier ? tierClass(points().tier as string) : undefined}
          />
        </div>
      )}
    </Show>
    <Show when={props.referralVerifiable}>
      <a
        class="pv-pcard__verify"
        href={platformCredentialsUrl(props.platform)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>Verify referral in Kaito</span>
        <ArrowUpRightIcon size={12} />
      </a>
    </Show>
  </>
);

const PlatformCardSkeleton: Component = () => (
  <div class="pv-pcard" aria-hidden="true">
    <span class="rf-sk pv-sk--pcard-head" />
    <span class="rf-sk pv-sk--pcard-metrics" />
    <span class="rf-sk pv-sk--pcard-when" />
  </div>
);

const PlatformCard: Component<{ group: PlatformGroup; onOpen: (platform: string) => void }> = (
  props,
) => {
  const single = (): IncludedAccount | undefined =>
    props.group.accounts.length === 1 ? props.group.accounts[0] : undefined;
  const value = () => single()?.value ?? props.group.value;
  const pnl = () => single()?.pnl ?? props.group.pnl;
  const approx = () => single()?.fxApproximate ?? props.group.fxApproximate;

  return (
    <div class="pv-pcard">
      <div class="pv-pcard__head">
        <BrandChip account={props.group} />
        <GroupIdentity group={props.group} onOpen={props.onOpen} />
      </div>

      <div class="pv-pcard__metrics">
        {}
        <Metric label={props.group.valueLabel} value={value()} native={single()?.nativeAmount} />
        {}
        <Metric
          label={props.group.pnlLabel}
          caption={props.group.pnlCoverage ? `Covers ${props.group.pnlCoverage}` : null}
          value={pnl()}
          signed
          note={props.group.perpOnly ? 'perp only' : undefined}
          native={single()?.nativePnlAmount}
          approx={approx()}
        />
      </div>

      <MetricBlocks
        platform={props.group.platform}
        referral={props.group.referral}
        referralVerifiable={props.group.referralVerifiable}
        points={props.group.points}
      />

      <Show when={props.group.timestampLabel}>
        {(when) => <p class="pv-pcard__when">{when()}</p>}
      </Show>
    </div>
  );
};

export const PlatformList: Component<{
  groups: PlatformGroup[];
  loading?: boolean;
  onOpenPlatform: (platform: string) => void;
}> = (props) => (
  <section class="pv-plist">
    {}
    <div class="pv-plist__head">
      <p class="pv-plist__title">Accounts</p>
      <p class="pv-plist__subtitle">
        Each public wallet is shown under the platforms where it has activity. Private wallets
        aren't included.
      </p>
    </div>

    <div class="pv-plist__rows">
      <Show
        when={!props.loading}
        fallback={
          <>
            <PlatformCardSkeleton />
            <PlatformCardSkeleton />
          </>
        }
      >
        <Show
          when={props.groups.length > 0}
          fallback={<p class="pv-plist__empty">No verified platforms to show yet.</p>}
        >
          <For each={props.groups}>
            {(group) => <PlatformCard group={group} onOpen={props.onOpenPlatform} />}
          </For>
        </Show>
      </Show>
    </div>
  </section>
);
