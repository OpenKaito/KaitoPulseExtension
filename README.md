# Kaito Pulse Extension

[![Download a build](https://img.shields.io/badge/Download-latest%20build-181717?logo=github&logoColor=white)](../../releases)

Kaito Pulse is a Chrome Manifest V3 extension for two Kaito experiences:

- **Account verification.** It uses [Primus zkTLS](https://primuslabs.xyz/) to prove a specific account fact—such as a balance threshold or trading volume—to Kaito without sending the underlying account contents to Kaito.
- **X signals.** It adds Kaito signal badges and hover cards to supported profiles and feed entries on [x.com](https://x.com/).

> **Transparency release.** This source is published for public inspection and independent
> security and privacy review. It is not open source; the license permits local builds,
> installation, artifact comparison, and good-faith audit, but not redistribution,
> production deployment, commercial reuse, or derivative products. See the
> [license](LICENSE).

## Start here

| If you want to… | Read… |
| --- | --- |
| Download a prebuilt zip and load it unpacked | [Releases](../../releases) |
| Confirm a downloaded build came from this source | [Verify a change](#verify-a-change) |
| Build, load, and test the extension locally | [Quick start](#quick-start) |
| Understand privacy, terms, and requested access | [Data and permissions](#data-and-permissions) |
| Understand security reporting | [Security policy](SECURITY.md) |
| Get non-security help | [Support](SUPPORT.md) |

## Current status and limitations

- The X signal UI is available on `x.com` after the extension is loaded and the user is signed in.
- Third-party zkTLS verification targets are declared as **optional** Chrome host permissions.
  The extension asks for the one it needs when you press Continue on a verification, so the
  first run against a given platform shows a Chrome permission prompt; declining it stops that
  run. If a verification fails at injection, check the granted site access first.
- The extension currently targets Chrome. Other Chromium browsers are not part of the documented support matrix.

## Quick start

### Prerequisites

- Compliance with the repository's source-audit license
- Google Chrome
- Node.js `22.23.1` (pinned in `.node-version`)
- pnpm `9.10.0` (pinned by `packageManager`)
- Git with submodule support
- Bash; `unzip` is also required for artifact comparison

If pnpm is not installed, Node's Corepack is the simplest option:

```sh
corepack enable
corepack prepare pnpm@9.10.0 --activate
```

### Authorized local build

```sh
git clone --recurse-submodules https://github.com/OpenKaito/KaitoPulseExtension.git
cd KaitoPulseExtension
cp .env.example .env
pnpm install
pnpm build:vendor
pnpm build
```

`pnpm install` also initialises the submodule when a clone was made without
`--recurse-submodules`. Run `pnpm build:vendor` again whenever the
`vendor/primus-core` submodule SHA changes. A normal build is written to
`dist/chrome-mv3/`.

### Environment

`.env.example` deliberately points to Kaito's production backend. Copy it unchanged only when
you are intentionally testing against that environment. Do not add credentials, tokens, or
other secrets to a `VITE_` variable: values with that prefix are bundled into the extension.
For another authorized Kaito environment, set the corresponding non-production values.
Build-time settings are read in `src/lib/env.ts`, `src/signal/config.ts`, and
`wxt.config.ts`.

### Load it in Chrome

⚠️ A source build uses the fixed extension id
`clfgaheindkfogpfcneoihannkgkhmna`. Chrome allows only one installed extension per id,
so remove any existing extension with that id before loading this build. See
[Extension id](#extension-id) below for why.

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose `dist/chrome-mv3/`.
4. Pin **Kaito Pulse** from Chrome's Extensions menu, then open it.
5. Follow the sign-in and consent prompts. Visit `x.com` to test the signal UI.

After a source change, run `pnpm build` again and click Chrome's reload button for the
unpacked extension. Inspect both the page DevTools console and the extension service worker
when diagnosing a failure.

### Extension id

Every build you produce from this repository has the extension id
**`clfgaheindkfogpfcneoihannkgkhmna`**. It is fixed across machines, clone paths,
Chrome profiles, and both build modes. You do not need to configure anything to get it.

It has to work this way because the id is part of the sign-in flow. The extension hands
`chrome.runtime.id` to kaito.ai as the `extensionId` query parameter, kaito.ai messages the
sign-in result back to that id, and Kaito's backend allowlists that one id. A build with any
other id — including the per-checkout id Chrome invents when a manifest has no `key` — will
load and render, but cannot complete sign-in.

Two consequences worth knowing before you build:

- **Two same-id extensions cannot coexist.** Remove any existing extension with this id
  before loading the source build.
- **The extension id does not tell a local build apart from production.** If you need that
  distinction in logs or your own tooling, use `VITE_KAITO_ENV`, not `chrome.runtime.id`.

The only build without this id is the upload artifact (`pnpm zip:upload`), which ships
without a manifest `key`. The key is a public value required to derive a stable extension
id, not a secret.

### Development mode

```sh
pnpm dev
```

Load `dist/chrome-mv3-dev/` once in Chrome, then reload the extension after an update.
Development and production output deliberately use different directories but the same extension
ID: keep **only one** of them loaded at a time.

### Package a build

```sh
pnpm zip
```

This is the default packaging command, and it packages a **production-environment** build:
the backend comes from whatever `.env` points at — Kaito's production backend, if you copied
`.env.example` unchanged — and the extension id is the usual pinned
`clfgaheindkfogpfcneoihannkgkhmna`. The
artifact lands in `dist/`, named after everything that varies:
`kaito-extension-<version>-chrome-prod-storeid-<timestamp>.zip` (backend, then extension
identity, then a timestamp).

To install one: unzip it, then **Load unpacked** on the extracted directory — Chrome cannot
load a `.zip` directly. Remove any existing extension with the same id first.

| Command | What it packages |
|---|---|
| `pnpm zip` | The default. Production-mode build, backend from `.env`, pinned extension id. |
| `pnpm zip:dev` | A development-mode build (verbose logging, debug panels), same pinned id. Tagged `-devmode-`. |
| `pnpm zip:upload` | The Chrome Web Store upload artifact and nothing else: no manifest `key`, so the store assigns the id on publish. `pnpm release` calls it. |

⚠️ Only `pnpm zip:upload` output may be uploaded to the Chrome Web Store. Every other build
carries the pinned `key`, and whether the store accepts a manifest with an already-registered
key is unconfirmed. `pnpm release` enforces this: it packages via `zip:upload` and refuses to
proceed if the manifest carries a `key`.

### Cut a release

```sh
# 1. bump "version" in package.json by hand
pnpm release                 # gate, then zip:upload, then the manifest self-check, then a local tag
git push origin v<version>   # then follow what pnpm release prints
```

Pushing that tag triggers `.github/workflows/release.yml`, which rebuilds from the tagged
commit in a clean checkout and creates a GitHub Release — as a **draft**, so you review it
before it is public. It carries two zips, verified separately, both built from exactly what
the tag points at:

| Asset | For |
|---|---|
| `kaito-extension-<version>.zip` | people downloading the extension: unzip, **Load unpacked**, sign in |
| `kaito-extension-webstore-<version>.zip` | the Chrome Web Store upload — this is the one to upload |

Don't mix them up: the `-webstore` build deliberately carries no manifest `key`, so loading it
unpacked gives it a path-derived extension id and **sign-in will not work**. The release notes
spell this out for whoever downloads it.

`pnpm release` refuses to package a version that already has a tag, which makes a
version bump the first step of every release.

## Data and permissions

- A zkTLS proof submits the proof result to Kaito; it is designed not to submit the underlying
  account contents.
- The extension renders its signal UI inside `x.com` and therefore needs access to that site.
- The extension needs access to the configured Kaito origins for sign-in, API access, image
  proxying, and the connection handoff.
- Verification flows can require access to the platform the user explicitly chooses. Those
  hosts are optional permissions; see the current limitation above.
- The extension has no backend secret. Its local `clientId` and `clientToken` identify the
  installation and are stored in `chrome.storage.local`.

Read the [Privacy Policy](https://swb.kaito.ai/pulse-privacy-policy) and
[Terms of Use](https://swb.kaito.ai/pulse-terms-of-use) before using the extension.

## Verify a change

```sh
pnpm typecheck
pnpm build
```

There is currently no test runner or linter. Load the resulting extension and exercise the
changed behavior manually. For signal UI work, test on `x.com` and confirm that the page
console contains no Content Security Policy violations.

To compare a key-less upload ZIP with a locally installable ZIP built from the same source:

```sh
pnpm verify:artifacts -- <web-store.zip-or-crx> <local.zip>
```

The verifier strips a CRX signature envelope when present, ignores Chrome-generated metadata,
and removes two manifest fields before hashing every extension file: `key`, the one field the
two builds differ in by design, and the `update_url` the Chrome Web Store injects into every CRX
it serves — the latter only when it holds the store's own URL, so a repackaged CRX pointing at
another update server still fails. Any JavaScript, CSS, HTML, WASM, image, permission, or other
manifest difference fails the check. This proves equivalence of the two supplied artifacts; it
makes no claim about an artifact distributed elsewhere.

That last sentence is the limit worth closing. Release assets carry signed build provenance,
which does make a claim about origin and needs only the `gh` CLI:

```sh
gh attestation verify kaito-extension-<version>.zip --repo OpenKaito/KaitoPulseExtension
```

It names the repository, commit, and workflow run that produced those exact bytes. Release
builds run in this repository from the tagged commit, so a download that passes both checks
is tied to source you can read.

## Contributing and support

Unsolicited code contributions are not currently accepted. Bug reports and feature
requests use the repository's GitHub issue templates, and general usage questions belong
in [SUPPORT.md](SUPPORT.md).
Report vulnerabilities only through [SECURITY.md](SECURITY.md), never in a public issue.

## License

Kaito-authored materials are source-available for local builds, artifact verification, and
independent audit, but are not open source. They remain governed by the
[Kaito Pulse Proprietary License](LICENSE) and the
[Terms of Use](https://swb.kaito.ai/pulse-terms-of-use). `vendor/primus-core` is a Git submodule
with its own license; see [NOTICE](NOTICE).
