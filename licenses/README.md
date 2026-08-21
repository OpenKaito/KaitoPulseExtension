# Licence texts shipped inside the release artifact

`modules/primus.ts` (`primusLicenseAssets`) copies the files here into every
build, so they land in `dist/chrome-mv3/licenses/primus/` and therefore inside
every packaged artifact. That placement is the point: the artifact is what gets
conveyed to users, and LGPL-3.0 section 4 attaches to the conveyance, not to this
repository.

| File in the artifact | Source |
| --- | --- |
| `licenses/primus/LGPL-3.0.txt` | `vendor/primus-core/LICENSE`, i.e. the pinned fork commit's own copy |
| `licenses/primus/GPL-3.0.txt` | `licenses/GPL-3.0.txt` in this repository, digest-checked |
| `licenses/primus/PRIMUS.txt` | Generated — records the pinned submodule SHA and rebuild steps |

Emission is build-only (`wxt.config.command === 'build'`), so `pnpm dev` does not
need the texts; `pnpm build` / `pnpm zip` / `pnpm release` do, and fail without them.

## `PRIMUS_VERSION`

`licenses/PRIMUS_VERSION` is a committed copy of the Primus commit that
`vendor/primus-core`'s gitlink pins. The build reads the gitlink when it can and
rewrites this file to match, so it stays current on its own.

It exists for the case where the gitlink does not: the public release is a copy of
these files into a fresh repository with no git history, which destroys the
gitlink. A committed literal is the only form of that fact which survives the
copy — and LGPL-3.0 requires the recipient be able to identify and fetch the exact
source that was built. **Copy this file.**

## `GPL-3.0.txt`

LGPL-3.0 is a short document that incorporates GPL-3.0 by reference, so the two
texts have to travel together. This one is committed.

    sha256  8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903
    lines   674

**Provenance.** Copied from a GNU project's own shipped `COPYING`
(`readline` 8.3.3), then cross-checked against four other unrelated GNU projects'
copies — `wget` 1.25.0, `xz` 5.8.3, `libunistring` 1.4.2, `gettext` 1.0. All five
are the same 674-line document and differ only in the URL scheme (`http://` vs
`https://`, the FSF having updated it at some point) and, in wget's case, a
downstream copyright-year edit. Verified free of project-specific text.

The `http://` revision is the one committed here, deliberately: it matches
`vendor/primus-core/LICENSE`, which also uses `http://` links, so the GPL and LGPL
texts inside one artifact are from the same revision of the FSF's documents.

**The build verifies the digest.** `GPL3_ACCEPTED_SHA256` in `modules/primus.ts`
holds this digest and the `https://` revision's
(`3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`), and a
production build fails if the file matches neither.

That check is not ceremony. The text itself says "Everyone is permitted to copy and
distribute verbatim copies of this license document, but changing it is not
allowed" — and the realistic way it gets changed is not malice, it is an editor
that strips trailing whitespace or reflows a paragraph on save. The result still
looks like the GPL and is no longer the GPL. Do not reflow, retype, or summarise
this file.

If the FSF publishes a new revision, fetch it
(`curl -o licenses/GPL-3.0.txt https://www.gnu.org/licenses/gpl-3.0.txt`), confirm
what changed, and add the new digest to `GPL3_ACCEPTED_SHA256` as a deliberate
commit. The build failure is there to force that to be a decision rather than a
silent swap.
