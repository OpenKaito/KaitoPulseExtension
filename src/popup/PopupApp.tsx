import { Match, Show, Switch, createSignal, onCleanup, onMount, type Component } from 'solid-js';
import './popup-shell.css';

import '@/recommend-follow/recommend-follow.css';

import './social-card/social-card.css';
import { PoweredBy } from './components/PoweredBy';
import { ProfileBlock } from './components/ProfileBlock';
import { POPUP_TABS, TabBar, type PopupTab } from './components/TabBar';
import { PlatformAccountsView } from './PlatformAccountsView';
import { AuraTab } from './tabs/AuraTab';
import { SocialTab } from './tabs/SocialTab';
import { TradingTab } from './tabs/TradingTab';
import { XAnalyticsTab } from './tabs/XAnalyticsTab';
import {
  auraLoading,
  cardLoading,
  gateResolved,
  initPopupData,
  popupData,
  signedIn,
  tradeLoading,
  watchMockScenario,
  watchPopupSession,
} from './data/store';
import { ScenarioSwitch } from './dev/ScenarioSwitch';
import { ConsentSheet } from './onboarding/ConsentSheet';
import { acceptTermsAndEnter, termsGate } from '@/recommend-follow/store';
import { SignedOutView } from '@/recommend-follow/SignedOutView';

export const PopupApp: Component = () => {
  const [tab, setTab] = createSignal<PopupTab>(POPUP_TABS[0]);

  const [openPlatform, setOpenPlatform] = createSignal<string | null>(null);
  const openGroup = () => popupData().platformGroups.find((group) => group.platform === openPlatform());

  const [consentDismissed, setConsentDismissed] = createSignal(false);

  onMount(() => {

    void initPopupData();

    onCleanup(watchPopupSession());

    onCleanup(watchMockScenario());
  });

  const entered = () => signedIn() && termsGate() === 'accepted';

  const askConsent = () => signedIn() && !consentDismissed() && termsGate() === 'required';

  const resumeConsent = (): (() => void) | undefined =>
    signedIn() && consentDismissed() && termsGate() === 'required'
      ? () => setConsentDismissed(false)
      : undefined;

  const agree = (activityData: boolean): void => {
    void acceptTermsAndEnter(activityData);
  };

  return (
    <Show
      when={entered()}
      fallback={
        <Show when={gateResolved()}>
          <SignedOutView onResume={resumeConsent()} />
          <Show when={askConsent()}>
            <ConsentSheet onAgree={agree} onCancel={() => setConsentDismissed(true)} />
          </Show>
        </Show>
      }
    >
      <>
        {}
        <ScenarioSwitch />
        {}
        <Show
          when={openGroup()}

          fallback={
            <div class="pv-root">
              <ProfileBlock
                profile={popupData().profile}

                platforms={popupData().platformGroups.map((g) => g.platform)}
                auraLoading={auraLoading()}
                cardLoading={cardLoading()}
                tradeLoading={tradeLoading()}
              />
              <div class="pv-body">
                <TabBar active={tab()} onSelect={setTab} />
                <div class="pv-panel" role="tabpanel">
                  <Switch>
                    <Match when={tab() === 'Aura'}>
                      <AuraTab />
                    </Match>
                    <Match when={tab() === 'Social'}>
                      <SocialTab />
                    </Match>
                    <Match when={tab() === 'Trading'}>
                      <TradingTab onOpenPlatform={setOpenPlatform} />
                    </Match>
                    <Match when={tab() === 'X Analytics'}>
                      <XAnalyticsTab />
                    </Match>
                  </Switch>
                </div>
              </div>
              <PoweredBy />
            </div>
          }
        >
          {(group) => <PlatformAccountsView group={group()} onBack={() => setOpenPlatform(null)} />}
        </Show>
      </>
    </Show>
  );
};
