import type { TabMessage } from '@/shared/tab-messages';
import { ENV, logDev } from '@/lib/env';
import { ApiError } from '@/shared/contracts';
import { isAllowedOrigin } from '@/shared/allowed-origin';
import {
  EXTERNAL_CAPABILITIES,
  EXTERNAL_PROTOCOL_VERSION,
  type ExternalRequest,
  type ExternalAccountLinkedResponse,
  type ExternalCapabilitiesResponse,
  type ExternalInvalidateKey,
  type ExternalInvalidateResponse,
  type ExternalOpenSurfaceResponse,
  type ExternalOpenVerificationResponse,
  type ExternalPingResponse,
  type ExternalPushEvent,
  type ExternalSignInResponse,
  type ExternalSignOutResponse,
  type ExternalUnsupportedResponse,
  type ExternalVerifyStatusResponse,
  toExternalLastResult,
} from '@/shared/messages';
import { followRecommendationCacheItem } from '@/shared/storage';
import { openPopupWindow, openVerifyWindow } from './popup-window';
import {
  getState,
  refreshMe,
  refreshProofs,
  refreshVerifiers,
  returnToOriginTabAfterSignIn,
  signInWithPrivySession,
  signOut,
} from './worker-core';

const INVALIDATORS: Record<ExternalInvalidateKey, () => Promise<unknown>> = {
  me: refreshMe,
  verifiers: refreshVerifiers,
  verifications: refreshProofs,

  recommendations: () => followRecommendationCacheItem.removeValue(),
};

const externalPorts = new Set<chrome.runtime.Port>();

function handshake(): ExternalPingResponse {
  return {
    ok: true,
    protocolVersion: EXTERNAL_PROTOCOL_VERSION,
    extensionVersion: chrome.runtime.getManifest().version,
  };
}

function broadcastExternal(event: ExternalPushEvent): void {
  for (const port of externalPorts) {
    try {
      port.postMessage(event);
    } catch {
      externalPorts.delete(port);
    }
  }
}

function routeExternalRequest(
  message: ExternalRequest,
  sender: chrome.runtime.MessageSender,
  respond: (response: unknown) => void,
): boolean {
  if (message?.type === 'ping') {
    respond(handshake());
    return false;
  }

  if (message?.type === 'getCapabilities') {
    respond({
      ...handshake(),
      capabilities: [...EXTERNAL_CAPABILITIES],
    } satisfies ExternalCapabilitiesResponse);
    return false;
  }

  if (message?.type === 'getVerifyStatus') {
    const state = getState();
    const verifications: ExternalVerifyStatusResponse['verifications'] = {};
    for (const [verifierId, proof] of Object.entries(state.verifications)) {

      verifications[verifierId] = { verifiedAt: proof.verifiedAt };
    }
    const active = state.proofProgress;
    respond({
      ok: true,
      installed: true,
      signedIn: state.signedIn,
      verifiers: state.verifiers.map(({ id, name, platform }) => ({ id, name, platform })),
      activeVerifierId: active?.verifierId,

      progress: active
        ? { stage: active.stage, message: active.message, startedAt: active.startedAt }
        : undefined,
      verifications,

      lastResult: toExternalLastResult(state.lastResult),
    } satisfies ExternalVerifyStatusResponse);
    return false;
  }

  if (message?.type === 'openVerification') {
    const verifier = getState().verifiers.find((item) => item.id === message.verifierId);
    if (!verifier) {
      respond({ ok: false, reason: 'verifier_not_found' } satisfies ExternalOpenVerificationResponse);
      return false;
    }
    if (typeof sender.tab?.id !== 'number') {
      respond({ ok: false, reason: 'missing_sender_tab' } satisfies ExternalOpenVerificationResponse);
      return false;
    }

    chrome.tabs.sendMessage(
      sender.tab.id,
      { type: 'kaito:openVerifyPanel', taskId: verifier.id } satisfies TabMessage,
      (response: unknown) => {
        const opened = Boolean(
          response && typeof response === 'object' && (response as { ok?: unknown }).ok === true,
        );
        respond(
          opened
            ? ({ ok: true, opened: true } satisfies ExternalOpenVerificationResponse)
            : ({ ok: false, reason: 'panel_unavailable' } satisfies ExternalOpenVerificationResponse),
        );
      },
    );
    return true;
  }

  if (message?.type === 'openSurface') {
    const { surface } = message;
    if (surface === 'verify') {

      const verifierId = message.params?.verifierId;
      const verifier = verifierId
        ? getState().verifiers.find((item) => item.id === verifierId)
        : undefined;
      if (!verifier) {
        respond({ ok: false, reason: 'verifier_not_found' } satisfies ExternalOpenSurfaceResponse);
        return false;
      }

      void openVerifyWindow(verifier.id, sender.tab?.id);
      respond({ ok: true, opened: true } satisfies ExternalOpenSurfaceResponse);
      return false;
    }
    if (surface === 'popup') {
      void openPopupWindow();
      respond({ ok: true, opened: true } satisfies ExternalOpenSurfaceResponse);
      return false;
    }
    if (surface === 'options') {
      void chrome.runtime.openOptionsPage();
      respond({ ok: true, opened: true } satisfies ExternalOpenSurfaceResponse);
      return false;
    }

    respond({ ok: false, reason: 'unknown_surface' } satisfies ExternalOpenSurfaceResponse);
    return false;
  }

  if (message?.type === 'invalidate') {
    if (!Array.isArray(message.keys)) {
      respond({ ok: false, reason: 'invalid_payload' } satisfies ExternalInvalidateResponse);
      return false;
    }
    const requested = message.keys.filter(
      (key): key is ExternalInvalidateKey => key in INVALIDATORS,
    );
    (async () => {
      const refreshed: ExternalInvalidateKey[] = [];

      for (const key of requested) {
        try {
          await INVALIDATORS[key]();
          refreshed.push(key);
        } catch (error) {
          logDev('invalidate failed for', key, error);
        }
      }

      const signedOutMiss = !getState().signedIn && refreshed.length < requested.length;
      respond({
        ok: true,
        refreshed,
        ...(signedOutMiss ? { reason: 'not_signed_in' } : {}),
      } satisfies ExternalInvalidateResponse);
    })();
    return true;
  }

  if (message?.type === 'signOut') {
    (async () => {
      try {
        await signOut();
        respond({ ok: true } satisfies ExternalSignOutResponse);
        broadcastExternal({ kind: 'signedOut' });
      } catch (error) {
        logDev('external sign-out failed', error);
        respond({
          ok: false,
          reason: (error as Error)?.message || 'unknown_error',
        } satisfies ExternalSignOutResponse);
      }
    })();
    return true;
  }

  if (message?.type === 'accountLinked') {
    if (typeof message.method !== 'string') {
      respond({ ok: false, reason: 'invalid_payload' } satisfies ExternalAccountLinkedResponse);
      return false;
    }
    const { method } = message;
    (async () => {
      await followRecommendationCacheItem.removeValue();

      try {
        await refreshMe();
      } catch (error) {
        logDev('refreshMe after accountLinked failed', error);
      }

      broadcastExternal({ kind: 'accountLinked', method });
      if (typeof sender.tab?.id === 'number') {
        await chrome.tabs.remove(sender.tab.id).catch(() => undefined);
      }
      respond({ ok: true } satisfies ExternalAccountLinkedResponse);
    })();
    return true;
  }

  if (message?.type === 'signIn') {
    if (
      typeof message.accessToken !== 'string' ||
      typeof message.idToken !== 'string' ||
      (message.kaitoName !== undefined && typeof message.kaitoName !== 'string')
    ) {
      respond({ ok: false, reason: 'invalid_payload' } satisfies ExternalSignInResponse);
      return false;
    }

    const { accessToken, idToken, kaitoName } = message;
    (async () => {
      try {
        const me = await signInWithPrivySession(accessToken, idToken, { kaitoName });
        respond({ ok: true, me } satisfies ExternalSignInResponse);
        broadcastExternal({ kind: 'signedIn', me });
        void returnToOriginTabAfterSignIn(sender.tab?.id);
      } catch (error) {
        logDev('external sign-in failed', error);
        const reason =
          error instanceof ApiError
            ? error.reason || `http_${error.status}`
            : (error as Error).message || 'unknown_error';
        respond({ ok: false, reason } satisfies ExternalSignInResponse);

        if (getState().signedIn) {
          void returnToOriginTabAfterSignIn(sender.tab?.id);
        }
      }
    })();
    return true;
  }

  logDev('external message: unsupported method', (message as { type?: unknown })?.type);
  respond({
    ok: false,
    reason: 'unsupported_method',
    protocolVersion: EXTERNAL_PROTOCOL_VERSION,
    capabilities: [...EXTERNAL_CAPABILITIES],
  } satisfies ExternalUnsupportedResponse);
  return false;
}

export function registerSignInMessageHandler() {
  chrome.runtime.onMessageExternal.addListener(
    (message: ExternalRequest, sender, sendResponse) => {
      logDev('external message', message?.type, sender.url);

      if (!isAllowedOrigin(sender.url, ENV.connectAllowedOrigins)) {
        sendResponse({ ok: false, reason: 'origin_not_allowed' } satisfies ExternalSignInResponse);
        return false;
      }

      return routeExternalRequest(message, sender, sendResponse);
    },
  );

  chrome.runtime.onConnectExternal.addListener((port) => {
    if (!isAllowedOrigin(port.sender?.url, ENV.connectAllowedOrigins)) {
      port.disconnect();
      return;
    }
    logDev('external port connected', port.sender?.url);
    externalPorts.add(port);
    port.onDisconnect.addListener(() => externalPorts.delete(port));
    port.postMessage({
      kind: 'hello',
      protocolVersion: EXTERNAL_PROTOCOL_VERSION,
      extensionVersion: chrome.runtime.getManifest().version,
      capabilities: [...EXTERNAL_CAPABILITIES],
    } satisfies ExternalPushEvent);

    port.onMessage.addListener((message: ExternalRequest) => {
      const sender = port.sender;
      if (!sender) return;
      routeExternalRequest(message, sender, (response) => {
        try {
          port.postMessage(
            message?.requestId ? { ...(response as object), requestId: message.requestId } : response,
          );
        } catch {
          externalPorts.delete(port);
        }
      });
    });
  });
}
