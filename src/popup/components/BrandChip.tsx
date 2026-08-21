import { Show, type Component } from 'solid-js';
import { PROTOCOL_ICON_DATA_URI } from '@/signal/protocol-icons';

type BrandChipSubject = { platform: string; displayName: string; brandColor: string };

export const BrandChip: Component<{ account: BrandChipSubject }> = (props) => {
  const logo = () => PROTOCOL_ICON_DATA_URI[props.account.platform as keyof typeof PROTOCOL_ICON_DATA_URI];
  return (
    <span class="pv-brand" style={{ color: props.account.brandColor }}>
      <Show when={logo()}>{(src) => <img src={src()} alt="" />}</Show>
      <span>{props.account.displayName}</span>
    </span>
  );
};
