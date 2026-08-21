import { SIGNAL_DOM_SELECTORS, applySelectorOverrides } from './selectors';
import { twitterIdMap } from '../twitter-id-map';
import { logLocalWarning } from '@/lib/guard';
import { sendKaitoMessage } from '../messaging';

const BREAKAGE_STREAK_THRESHOLD = 3;

const BREAKAGE_GRAPHQL_GROWTH_THRESHOLD = 5;

interface SurfaceHealth {
  consecutiveEmptySweeps: number;
  graphqlSizeAtStreakStart: number;
  alertedThisSession: boolean;
}

function initialHealth(): SurfaceHealth {
  return { consecutiveEmptySweeps: 0, graphqlSizeAtStreakStart: 0, alertedThisSession: false };
}

export class HealthMonitor {
  private health: SurfaceHealth = initialHealth();

  recordDiscovery(rawCount: number, tweetAvatarCount: number): void {
    if (rawCount > 0) {
      this.health.consecutiveEmptySweeps = 0;
      return;
    }

    if (this.health.consecutiveEmptySweeps === 0) {
      this.health.graphqlSizeAtStreakStart = twitterIdMap.size;
    }
    this.health.consecutiveEmptySweeps++;

    if (this.health.alertedThisSession) return;
    if (this.health.consecutiveEmptySweeps < BREAKAGE_STREAK_THRESHOLD) return;

    const graphqlGrowth = twitterIdMap.size - this.health.graphqlSizeAtStreakStart;
    const graphqlCorroborates = graphqlGrowth >= BREAKAGE_GRAPHQL_GROWTH_THRESHOLD;
    const domCorroborates = tweetAvatarCount > 0;
    if (!graphqlCorroborates && !domCorroborates) return;

    this.health.alertedThisSession = true;
    this.reportBreakage(this.health.consecutiveEmptySweeps, graphqlGrowth, tweetAvatarCount);
  }

  reset(): void {
    this.health = initialHealth();
  }

  private reportBreakage(
    streakLength: number,
    graphqlGrowth: number,
    tweetAvatarCount: number,
  ): void {
    logLocalWarning('feed selector may be broken (ARTICLE)', 'signal.health', {
        surface: 'feed',
        streakLength,
        graphqlGrowth,

        tweetAvatarCount,
        activeSelectors: {
          ARTICLE: SIGNAL_DOM_SELECTORS.ARTICLE,
          TWEET_AVATAR: SIGNAL_DOM_SELECTORS.TWEET_AVATAR,
        },
    });

    void sendKaitoMessage({
      target: 'kaitoExtension',
      action: 'forceRefreshSelectorOverrides',
    }).then((response) => {
      if (response.payload) applySelectorOverrides(response.payload);
    }).catch(() => {

    });
  }
}
