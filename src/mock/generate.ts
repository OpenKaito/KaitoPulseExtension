
import { shortenAddress } from '@/popup/format/platforms';

export const FIXTURE_NOW = 1_770_000_000_000;

export function daysBefore(days: number): number {
  return FIXTURE_NOW - Math.round(days * 86_400_000);
}

export function minutesBefore(minutes: number): number {
  return FIXTURE_NOW - Math.round(minutes * 60_000);
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stream(purpose: string, index: number): () => number {
  let hash = 0x811c9dc5;
  for (const char of `${purpose}#${index}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  }
  return mulberry32(hash);
}

function check(value: string, spec: RegExp, what: string): string {
  if (!spec.test(value)) throw new Error(`[mock] generated ${what} "${value}" does not match ${spec}`);
  return value;
}

const TWITTER_EPOCH_MS = 1_288_834_974_657;

export const X_ID_SPEC = /^[1-9]\d{17,18}$/;

export function xId(purpose: string, index: number): string {
  const next = stream(`xid/${purpose}`, index);
  const from = Date.UTC(2016, 0, 1);
  const to = Date.UTC(2024, 11, 31);
  const createdMs = from + Math.floor(next() * (to - from));

  const low = BigInt(Math.floor(next() * 4_194_304));
  const id = ((BigInt(createdMs - TWITTER_EPOCH_MS) << 22n) | low).toString();
  return check(id, X_ID_SPEC, 'x id');
}

export function xIdCreatedMs(id: string): number {
  return Number(BigInt(id) >> 22n) + TWITTER_EPOCH_MS;
}

export const X_HANDLE_SPEC = /^[A-Za-z0-9_]{1,15}$/;

export const AT_HANDLE_SPEC = /^@[A-Za-z0-9_]{1,15}$/;

export const EVM_ADDRESS_SPEC = /^0x[0-9a-f]{40}$/;

export function evmAddress(purpose: string, index: number): string {
  const next = stream(`evm/${purpose}`, index);
  let hex = '';
  for (let i = 0; i < 40; i += 1) hex += Math.floor(next() * 16).toString(16);
  return check(`0x${hex}`, EVM_ADDRESS_SPEC, 'evm address');
}

export function elidedAddress(address: string): string {
  return shortenAddress(address);
}

interface Walkable {
  followers: { twitterId?: string; handle?: string }[];
  profileHandle: string | undefined;
  accounts: { accountId: string; accountLabel: string }[];
  recommendations: {
    twitterId: string;
    handle: string;

    circleProof?: { twitterId: string; handle: string }[] | null;
  }[];
  cardFollowers: { handle?: string }[];
  epochs: (number | null | undefined)[];
}

export function assertFixtureShapes(fixture: Walkable): void {
  const fail = (what: string, value: unknown, spec: RegExp | string): never => {
    throw new Error(`[mock] fixture ${what} ${JSON.stringify(value)} does not match ${spec}`);
  };

  for (const [index, follower] of fixture.followers.entries()) {
    if (follower.twitterId !== undefined && !X_ID_SPEC.test(follower.twitterId)) {
      fail(`followers[${index}].twitterId`, follower.twitterId, X_ID_SPEC);
    }

    if (follower.handle !== undefined && !AT_HANDLE_SPEC.test(follower.handle)) {
      fail(`followers[${index}].handle`, follower.handle, AT_HANDLE_SPEC);
    }
  }

  if (fixture.profileHandle !== undefined && !AT_HANDLE_SPEC.test(fixture.profileHandle)) {
    fail('profile.handle', fixture.profileHandle, AT_HANDLE_SPEC);
  }

  for (const [index, account] of fixture.accounts.entries()) {
    if (!EVM_ADDRESS_SPEC.test(account.accountId)) {
      fail(`accounts[${index}].accountId`, account.accountId, EVM_ADDRESS_SPEC);
    }
    if (account.accountLabel !== shortenAddress(account.accountId)) {
      fail(`accounts[${index}].accountLabel`, account.accountLabel, `shortenAddress(accountId) = ${shortenAddress(account.accountId)}`);
    }
  }

  for (const [index, item] of fixture.recommendations.entries()) {
    if (!X_ID_SPEC.test(item.twitterId)) fail(`recommendations[${index}].twitterId`, item.twitterId, X_ID_SPEC);

    if (!X_HANDLE_SPEC.test(item.handle)) fail(`recommendations[${index}].handle`, item.handle, X_HANDLE_SPEC);
    for (const [face, mutual] of (item.circleProof ?? []).entries()) {
      if (!X_ID_SPEC.test(mutual.twitterId)) fail(`recommendations[${index}].circleProof[${face}].twitterId`, mutual.twitterId, X_ID_SPEC);
      if (!X_HANDLE_SPEC.test(mutual.handle)) fail(`recommendations[${index}].circleProof[${face}].handle`, mutual.handle, X_HANDLE_SPEC);
    }
  }

  for (const [index, follower] of fixture.cardFollowers.entries()) {
    if (follower.handle !== undefined && !AT_HANDLE_SPEC.test(follower.handle)) {
      fail(`socialCard.followers[${index}].handle`, follower.handle, AT_HANDLE_SPEC);
    }
  }

  for (const [index, epoch] of fixture.epochs.entries()) {
    if (epoch == null) continue;

    if (epoch > FIXTURE_NOW) fail(`epochs[${index}]`, epoch, `<= FIXTURE_NOW (${FIXTURE_NOW})`);

    if (epoch < 1_100_000_000_000) fail(`epochs[${index}]`, epoch, 'milliseconds since the Unix epoch');
  }
}
