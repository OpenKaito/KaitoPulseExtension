export type XCreatorRewardsCriterionStatus = 'met' | 'unmet' | 'unknown';

export type XCreatorRewardsCountCriterion = {
  status: XCreatorRewardsCriterionStatus;
  threshold: number;
  valueText: string | null;
  value: number | null;
};

export type XCreatorRewardsSnapshot = {
  status: 'ok' | 'unrecognized_layout' | 'decode_error';
  parseReason: string | null;
  twitterId: string;
  observedAt: string | null;
  submittedAt: string;
  premium: XCreatorRewardsCriterionStatus | null;
  age: XCreatorRewardsCriterionStatus | null;
  verifiedFollowers: XCreatorRewardsCountCriterion | null;
  verifiedHomeTimelineImpressions: (XCreatorRewardsCountCriterion & { windowDays: number }) | null;
  selfReported: true;
};

export type XCreatorRewardsSubmitResult = {
  snapshot: XCreatorRewardsSnapshot;
};

export type XCreatorRewardsPagePayload = {
  twitterId: string;
  jfTag?: string;
  body: string;
};

export type XCreatorRewardsOutcome = 'stored' | 'unparsed' | 'read_failed' | 'submit_failed';
