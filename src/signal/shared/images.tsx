import { createEffect, createSignal, Show, type JSX } from "solid-js";
import { resolveImageSrc } from "../messaging";

export function RemoteImg(props: {
  url: string | undefined;
  wrapCls: string;
  imgCls: string;
  defaultCls: string;
  cssPx: number;
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

  const showDefault = () => !props.url || failed();

  return (
    <div class={`${props.wrapCls}${showDefault() ? ` ${props.defaultCls}` : ""}`}>
      <Show when={!showDefault() && src()}>
        {(resolvedSrc) => <img class={props.imgCls} src={resolvedSrc()} alt="" draggable={false} />}
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
