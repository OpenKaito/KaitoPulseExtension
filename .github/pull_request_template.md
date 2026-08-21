# Pull request

> Unsolicited pull requests are not currently accepted. Use this template only
> for a change invited by a Kaito maintainer.

## What and why

<!-- What changes, and what problem it solves. The diff shows the what; use
     this for the why. -->

## How it was verified

<!-- `pnpm typecheck` and `pnpm build` are the gate, but they are not enough
     on their own. -->

- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` passes and I loaded `dist/chrome-mv3/` in Chrome
- [ ] For a change under `src/signal/`: verified on x.com with **no CSP
      violations** in the Console

## Checklist

- [ ] No non-public system names, external tracker ids, or inaccessible
      references in comments; CI checks common patterns
- [ ] No change to `manifest` permissions or `host_permissions`; if there is
      one, its rationale and user impact are documented here
- [ ] Comments explain constraints that are not visible from the code,
      especially anything that looks simplifiable but is not
