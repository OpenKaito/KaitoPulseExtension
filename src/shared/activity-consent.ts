import { activityInsightsConsentItem, activityInsightsDisablePendingItem } from './storage';

type Consent = 'unset' | 'granted' | 'declined';

export async function readActivityConsent(): Promise<Consent> {
  const [consent, disabled] = await Promise.all([
    activityInsightsConsentItem.getValue(),
    activityInsightsDisablePendingItem.getValue(),
  ]);
  return disabled ? 'declined' : consent;
}

export function watchActivityConsent(callback: (consent: Consent) => void): () => void {
  let revision = 0;
  const refresh = () => {
    const current = ++revision;
    void readActivityConsent().then((consent) => {
      if (current === revision) callback(consent);
    });
  };
  const unwatchConsent = activityInsightsConsentItem.watch(refresh);
  const unwatchPending = activityInsightsDisablePendingItem.watch(refresh);
  return () => {
    revision++;
    unwatchConsent();
    unwatchPending();
  };
}
