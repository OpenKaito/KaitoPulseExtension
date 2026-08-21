import { Show, type JSX } from 'solid-js';
import { XLogoIcon } from '@/verify/ui/icons';
import { viewer, consent } from './store';
import { ActivityInsightsMenu } from './ActivityInsightsMenu';

export function TitleRow(props: { title: string; showAvatar?: boolean; showMenu?: boolean }): JSX.Element {
  const avatarUrl = () => viewer()?.avatarUrl;
  const showAvatar = () => props.showAvatar !== false;
  const showMenu = () => props.showMenu !== false;

  return (
    <h1 class="rf-title">
      <Show when={showAvatar()}>
        <Show
          when={avatarUrl()}
          fallback={<div class="rf-title__avatar rf-title__avatar--placeholder" />}
        >
          {(url) => <img class="rf-title__avatar" src={url()} alt="" />}
        </Show>
      </Show>
      <span class="rf-title__group">
        <XLogoIcon size={16} />
        <span class="rf-title__text">{props.title}</span>
        <Show when={showMenu() && consent() === 'granted'}>
          <ActivityInsightsMenu />
        </Show>
      </span>
    </h1>
  );
}
