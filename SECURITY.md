# Security policy

## Reporting a vulnerability

**Do not open a public issue or pull request for a security problem.** If GitHub's
private vulnerability reporting is available, use this repository's **Security** tab
and select **Report a vulnerability**. If it is unavailable, use the support channel
in the Kaito product to request a private reporting path without including the
vulnerability details in that first message.

Include enough to reproduce: what you did, what happened, and what you expected.

Do not send live credentials. Redact tokens, cookies, authorization headers, account
identifiers, balances, and personal data from the initial report.

For ordinary bugs or usage questions, use the paths in [SUPPORT.md](SUPPORT.md) instead.

## Scope

In scope:

- This repository's source, and the extension built from it.
- The way the extension handles user data, credentials, and the pages it is injected into.
- The build path, including `modules/primus.ts`'s patching of the vendored bundles.

Out of scope for this repository:

- The vendored zkTLS core. Its code lives in
  [`OpenKaito/primus-extension-fork`](https://github.com/OpenKaito/primus-extension-fork)
  and originates upstream from Primus Labs. A cryptographic finding in the attestation
  protocol itself belongs with Primus.
- Kaito's backend services. They are not in this repository, but a finding in the
  extension's handling of a backend interaction is in scope.

## What the extension holds

Worth knowing before you go looking:

- The extension holds **no backend secrets**. Local identity is a `clientId` + `clientToken`
  pair issued by `POST /clients/register` and kept in `chrome.storage.local`.
- Some verifiers must read a credential the user's own browser is already sending (for
  example a bearer token on the user's request to a site being proved). That value is used
  to perform the proved request against **that same site** and is never sent to Kaito.
  If you find a path where such a value reaches a Kaito endpoint, that is a real finding.
- Required host permissions cover `x.com` and the configured Kaito connect origins. Verification
  hosts are declared as optional permissions and requested from the verify window after the user
  starts a proof. Verifier helpers are registered for the selected host and torn down when the
  proof ends. Any path that sends captured values to Kaito outside an explicit proof, injects into
  an undeclared origin, or accepts a fetch target from an untrusted response is a real finding.
