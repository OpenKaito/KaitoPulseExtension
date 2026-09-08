import { createEffect, createSignal, Show, type JSX } from 'solid-js';
import { resolveImageSrc } from '../messaging';
import { stableHash } from '../hash';

export function avatarHue(seed: string): number {
  return parseInt(stableHash(seed), 36) % 360;
}

export function RemoteImg(props: {
  url: string | undefined;
  wrapCls: string;
  imgCls: string;
  defaultCls: string;
  cssPx: number;

  defaultStyle?: JSX.CSSProperties;

  defaultWhilePending?: boolean;
}): JSX.Element {
  const [src, setSrc] = createSignal<string | null>(null);
  const [failed, setFailed] = createSignal(false);

  createEffect(() => {
    const url = props.url;
    setSrc(null);
    setFailed(false);
    if (!url) return;
    resolveImageSrc(url, props.cssPx)
      .then((resolved) => {
        if (props.url === url) setSrc(resolved);
      })
      .catch(() => {
        if (props.url === url) setFailed(true);
      });
  });

  const showDefault = () =>
    !props.url || failed() || (props.defaultWhilePending === true && src() === null);

  return (
    <div
      class={`${props.wrapCls}${showDefault() ? ` ${props.defaultCls}` : ''}`}
      style={showDefault() ? props.defaultStyle : undefined}
    >
      <Show when={src()}>
        {(resolvedSrc) => (
          <img
            class={props.imgCls}
            src={resolvedSrc()}
            alt=""
            draggable={false}
            onError={() => setFailed(true)}
          />
        )}
      </Show>
    </div>
  );
}

export function AvatarImage(props: { url: string | undefined }): JSX.Element {
  return (
    <RemoteImg
      url={props.url}
      wrapCls="signal-popover__avatar"
      imgCls="signal-popover__avatar-img"
      defaultCls="signal-popover__avatar--default"
      cssPx={24}
    />
  );
}

export function ChipAvatarImage(props: { url: string | undefined; seed?: string }): JSX.Element {
  const seed = () => props.seed;
  return (
    <RemoteImg
      url={props.url}
      wrapCls="signal-popover__acct-chip-avatar"
      imgCls="signal-popover__acct-chip-avatar-img"
      defaultCls={
        seed() === undefined
          ? 'signal-popover__avatar--default'
          : 'signal-popover__acct-chip-avatar--gen'
      }
      defaultStyle={
        seed() === undefined ? undefined : { '--sg-gen-hue': String(avatarHue(seed()!)) }
      }
      defaultWhilePending={seed() !== undefined}
      cssPx={14}
    />
  );
}

export function UserAvatarImage(props: { url: string | undefined }): JSX.Element {
  return (
    <RemoteImg
      url={props.url}
      wrapCls="signal-popover__user-avatar"
      imgCls="signal-popover__user-avatar-img"
      defaultCls="signal-popover__avatar--default"
      cssPx={32}
    />
  );
}

export function MarketIcon(props: { url: string | undefined; size?: number }): JSX.Element {
  return (
    <RemoteImg
      url={props.url}
      wrapCls="signal-popover__market-icon"
      imgCls="signal-popover__market-icon-img"
      defaultCls="signal-popover__market-icon--default"
      cssPx={props.size ?? 20}
    />
  );
}
