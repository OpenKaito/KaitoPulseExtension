import { For, Show, createSignal, type Component } from 'solid-js';
import { ChevronDownIcon, EyeIcon, EyeOffIcon } from '@/verify/ui/icons';
import { BrandChip } from './components/BrandChip';
import type { IncludedAccount, PlatformGroup } from './data/types';
import {
  FX_APPROXIMATE_TITLE,
  approxFigure,
  formatSignedUsd,
  formatSignedUsdCents,
  formatUsd,
  pnlTone,
} from './format/numbers';
import { VERIFICATION_HUB_URL } from './links';

const VisibilityTag: Component<{ account: IncludedAccount }> = (props) => (
  <Show when={props.account.publicOnX !== undefined}>
    <span
      class="pv-acct__tag"
      classList={{ 'pv-acct__tag--public': props.account.publicOnX === true }}
      title={props.account.publicOnX ? 'Shown on X' : 'Hidden from X'}
    >
      {props.account.publicOnX ? 'Show' : 'Hide'}
    </span>
  </Show>
);

const Figure: Component<{
  label: string;
  value: number | null;
  signed?: boolean;
  note?: string;
  native?: string | null;
  approx?: boolean;
}> = (props) => {
  const tone = () => (props.signed ? pnlTone(props.value) : null);
  const native = () => (props.value == null ? props.native : null);
  const figure = () =>
    approxFigure(props.signed ? formatSignedUsdCents(props.value) : formatUsd(props.value), props.approx);
  return (
    <div class="pv-acct__figure">
      <p class="pv-acct__figure-label">
        {props.label}
        <Show when={props.note}>{(note) => <span class="pv-acct__figure-note">{note()}</span>}</Show>
      </p>
      <p
        class="pv-acct__figure-value"
        classList={{
          'pv-profit': tone() === 'profit',
          'pv-loss': tone() === 'loss',
          'pv-acct__figure-value--native': native() != null,
        }}

        title={figure().approx && native() == null ? FX_APPROXIMATE_TITLE : undefined}
      >
        <Show when={native()} fallback={figure().text}>
          {(amount) => amount()}
        </Show>
      </p>
    </div>
  );
};

const AccountRow: Component<{ account: IncludedAccount }> = (props) => {
  const [revealed, setRevealed] = createSignal(false);
  const label = () => props.account.profile?.name ?? props.account.accountLabel;

  const canReveal = () => props.account.accountId !== label();
  const revealLabel = () => (revealed() ? 'Hide full address' : 'Show full address');

  return (
    <div class="pv-acct">
      <div class="pv-acct__head">
        <div class="pv-acct__ident">
          <p class="pv-acct__address" classList={{ 'pv-acct__address--full': revealed() }}>
            {revealed() ? props.account.accountId : label()}
          </p>
          <Show when={canReveal()}>
            <button
              type="button"
              class="pv-acct__reveal"
              aria-pressed={revealed()}
              aria-label={revealLabel()}
              title={revealLabel()}
              onClick={() => setRevealed(!revealed())}
            >
              {}
              <Show when={revealed()} fallback={<EyeOffIcon size={14} />}>
                <EyeIcon size={14} />
              </Show>
            </button>
          </Show>
        </div>
        <VisibilityTag account={props.account} />
      </div>

      <div class="pv-acct__figures">
        <Figure
          label={props.account.valueLabel}
          value={props.account.value}
          native={props.account.nativeAmount}
        />
        <Figure
          label={props.account.pnlLabel}
          value={props.account.pnl}
          signed
          note={props.account.perpOnly ? 'perp only' : undefined}
          native={props.account.nativePnlAmount}
          approx={props.account.fxApproximate}
        />
      </div>
    </div>
  );
};

export const PlatformAccountsView: Component<{
  group: PlatformGroup;
  onBack: () => void;
}> = (props) => {
  const publicCount = () => props.group.publicCount;
  const total = () => approxFigure(formatSignedUsd(props.group.pnl), props.group.fxApproximate);

  const introTitle = (): string => {
    const total = props.group.accounts.length;
    const count = publicCount();
    if (count == null) return `${total} account${total === 1 ? '' : 's'}`;
    return `${count} public account${count === 1 ? '' : 's'}`;
  };

  return (
    <div class="pv-detail">
      <header class="pv-detail__head">
        {}
        <button type="button" class="pv-detail__back" onClick={props.onBack} aria-label="Back">
          ‹
        </button>
        <BrandChip account={props.group} />
        <p class="pv-detail__title">{props.group.displayName} accounts</p>
      </header>

      <div class="pv-detail__body">
        <div class="pv-detail__total">
          <p class="pv-detail__total-label">
            {props.group.displayName} {props.group.pnlLabel}
          </p>
          <div class="pv-detail__total-row">
            {}
            <Show when={pnlTone(props.group.pnl)}>
              {(tone) => (
                <span
                  class="pv-pnl-caret"
                  classList={{ 'pv-pnl-caret--down': tone() === 'loss' }}
                  aria-hidden="true"
                >
                  {tone() === 'loss' ? '▼' : '▲'}
                </span>
              )}
            </Show>
            <p
              class="pv-detail__total-value"
              classList={{
                'pv-detail__total-value--gain': pnlTone(props.group.pnl) === 'profit',
                'pv-detail__total-value--loss': pnlTone(props.group.pnl) === 'loss',
              }}
              title={total().approx ? FX_APPROXIMATE_TITLE : undefined}
            >
              {total().text}
            </p>
          </div>
        </div>

        <div class="pv-detail__intro">
          <p class="pv-detail__intro-title">{introTitle()}</p>
          <p class="pv-detail__intro-body">
            Account Value and {props.group.pnlLabel} are shown separately for each {props.group.displayName}{' '}
            account.
          </p>
        </div>

        <div class="pv-detail__panel">
          <div class="pv-detail__panel-head">
            <div class="pv-detail__count">
              <span class="pv-detail__count-num">{props.group.accounts.length}</span>
              <span class="pv-detail__count-label">
                {props.group.accounts.length === 1 ? 'Account' : 'Accounts'}
              </span>
            </div>
            {}
            <a class="pv-detail__manage" href={VERIFICATION_HUB_URL} target="_blank" rel="noopener noreferrer">
              <span>Manage</span>
              <span class="pv-chevron-right" aria-hidden="true">
                <ChevronDownIcon size={12} />
              </span>
            </a>
          </div>

          <div class="pv-detail__rows">
            <For each={props.group.accounts}>{(account) => <AccountRow account={account} />}</For>
          </div>
        </div>
      </div>
    </div>
  );
};
