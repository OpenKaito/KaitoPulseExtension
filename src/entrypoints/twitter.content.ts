import '@/signal/avatar-badge.css';
import '@/signal/name-tag.css';
import '@/signal/hovercard-stats.css';
import '@/signal/ad-flag/button.css';
import '@/signal/ad-flag/notice.css';
import '@/signal/token-chart/cashtag-chip.css';
import { createLogger } from '@/signal/logger';
import { Orchestrator } from '@/signal/orchestrator';
import { twitterIdMap } from '@/signal/twitter-id-map';
import { followRelay } from '@/signal/follow-relay';
import { viewerIdentity } from '@/signal/viewer-identity';
import '@/signal/profile/username-history.css';
import { ProfileModulesController } from '@/signal/profile/profile-modules';
import { ensureSignalFonts } from '@/signal/load-fonts';
import { loadSettings, subscribe, type SignalSettings } from '@/signal/settings';
import { gateSettings, readSignedIn, readTermsOk, termsOkFromMe } from '@/signal/session-gate';
import { activityInsightsConsentItem, meCacheItem, sessionItem } from '@/shared/storage';
import { BehaviorTracker } from '@/behavior/tracker';
import { guard, logLocalError } from '@/lib/guard';
import { applySelectorOverrides } from '@/signal/dom/selectors';
import { SIGNAL_CONFIG } from '@/signal/config';
import { sendKaitoMessage } from '@/signal/messaging';

const logger = createLogger('content');

const SELECTOR_OVERRIDES_POLL_MS = 5 * 60_000;

export default defineContentScript({
  matches: ['https://x.com/*', 'https://*.x.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',
  main() {
    logger.log('script started');

    void ensureSignalFonts();

    let teardown: (() => void) | null = null;

    let storedSettings: SignalSettings = {};
    let signedIn = false;

    let consentGranted = false;

    let termsOk = true;

    let settings: SignalSettings = {};
    let selectorOverridesTimer: ReturnType<typeof setInterval> | undefined;

    let flushOnUnload: (() => void) | null = null;

    const pullSelectorOverrides = () => {
      void sendKaitoMessage({
        target: 'kaitoExtension',
        action: 'getSelectorOverrides',
      }).then((response) => {
        if (response.payload) applySelectorOverrides(response.payload);
      }).catch((error) => logLocalError(error, 'selectorOverrides.pull'));
    };

    const start = () => {
      if (teardown) return;
      logger.log('initializing');

      if (SIGNAL_CONFIG.selectorConfigUrl) {
        pullSelectorOverrides();
        selectorOverridesTimer = setInterval(pullSelectorOverrides, SELECTOR_OVERRIDES_POLL_MS);
      }

      twitterIdMap.start();

      followRelay.start();

      viewerIdentity.start(document);

      let behaviorTracker: BehaviorTracker | null = null;
      const captureAllowed = (): boolean => signedIn && consentGranted;
      const syncCapture = guard(() => {
        if (captureAllowed()) {
          if (behaviorTracker) return;
          behaviorTracker = new BehaviorTracker(document);
          behaviorTracker.start();
          return;
        }

        behaviorTracker?.stopAndDiscard();
        behaviorTracker = null;
      }, 'behavior.syncCapture');
      syncCapture();

      flushOnUnload = () => behaviorTracker?.flushForUnload();

      const orchestrator = new Orchestrator(document, settings, (article) =>
        behaviorTracker?.onArticleSwept(article),
      );
      orchestrator.observeSignalSurfaces(document);

      const profileModules = new ProfileModulesController(document, settings);
      profileModules.observe(document);

      const applyEffective = guard(() => {
        settings = gateSettings(storedSettings, signedIn && termsOk);
        orchestrator.applySettings(settings);
        profileModules.applySettings(settings);
      }, 'settings.apply');

      const unsubscribe = subscribe(guard((next) => {
        storedSettings = next;
        applyEffective();
      }, 'settings.subscribe'));

      const unsubscribeSession = sessionItem.watch(guard((session) => {
        signedIn = session !== null;
        applyEffective();

        syncCapture();
      }, 'session.watch'));

      const unsubscribeConsent = activityInsightsConsentItem.watch(guard((value) => {
        consentGranted = value === 'granted';
        syncCapture();
      }, 'consent.watch'));

      const unsubscribeTerms = meCacheItem.watch(guard((me) => {
        termsOk = termsOkFromMe(me);
        applyEffective();
      }, 'terms.watch'));

      void Promise.all([readSignedIn(), readTermsOk()]).then(([nextSignedIn, nextTermsOk]) => {
        if (nextSignedIn === signedIn && nextTermsOk === termsOk) return;
        signedIn = nextSignedIn;
        termsOk = nextTermsOk;
        applyEffective();
      });

      teardown = () => {
        logger.log('tearing down');
        unsubscribe();
        unsubscribeSession();
        unsubscribeTerms();
        unsubscribeConsent();
        orchestrator.cleanup();
        profileModules.cleanup();

        behaviorTracker?.stop();
        behaviorTracker = null;
        twitterIdMap.stop();
        followRelay.stop();
        viewerIdentity.stop();
        if (selectorOverridesTimer !== undefined) {
          clearInterval(selectorOverridesTimer);
          selectorOverridesTimer = undefined;
        }
      };
    };

    const stop = () => {
      teardown?.();
      teardown = null;
      flushOnUnload = null;
    };

    void Promise.all([loadSettings(), readSignedIn(), readTermsOk(), activityInsightsConsentItem.getValue()])
      .then(([loadedSignal, loadedSignedIn, loadedTermsOk, loadedConsent]) => {
        storedSettings = loadedSignal;
        signedIn = loadedSignedIn;
        termsOk = loadedTermsOk;
        consentGranted = loadedConsent === 'granted';
        settings = gateSettings(storedSettings, signedIn && termsOk);
        start();
      })
      .catch((error) => logLocalError(error, 'loadSettings'));

    window.addEventListener('pagehide', guard((event: PageTransitionEvent) => {
      if (event.persisted) {
        stop();
        return;
      }

      flushOnUnload?.();
    }, 'pagehide'));
    window.addEventListener('pageshow', guard((event: PageTransitionEvent) => {
      if (event.persisted) start();
    }, 'pageshow'));
  },
});
