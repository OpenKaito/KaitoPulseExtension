# Support

## Before opening an issue

For a local source build, first run:

```sh
pnpm typecheck
pnpm build
```

Reload the unpacked extension in `chrome://extensions`, then reproduce the problem. For an issue on `x.com`, inspect both the page DevTools console and the extension service worker console.

## Where to ask

- **Bug:** use the Bug report template in this repository. Include the Chrome version, extension version, operating system, reproduction steps, and relevant console output.
- **Feature request:** use the Feature request template. Say whether the proposal needs new Chrome permissions.
- **Build or usage question:** open an issue with enough context to reproduce the problem.
- **Security vulnerability:** do **not** open an issue. Follow [SECURITY.md](SECURITY.md).

This repository documents local source builds. For account, campaign, or production-service support, use the support channel provided in the Kaito product where you encountered the issue.
