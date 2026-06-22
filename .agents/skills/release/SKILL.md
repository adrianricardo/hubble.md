---
name: release
description: Prepare Hubble desktop releases using tag-triggered GitHub Releases. Use when cutting, automating, or explaining app releases, version bumps, tags, GitHub Actions publishing, Electron artifacts, or updater release management.
---

# Release

Use Git tags as the release trigger. Prefer explicit tags over detecting version bump commits.

## Desktop release flow

1. Bump `apps/desktop/package.json` version.
2. Promote the changelog: in `CHANGELOG.md`, rename `## [Unreleased]` to `## [x.y.z] - YYYY-MM-DD` (today), drop any empty subheads, then add a fresh empty `## [Unreleased]` scaffold above it.
3. Commit version bump + changelog with a short message, e.g. `release desktop 0.1.2`.
4. Tag the commit, e.g. `desktop-v0.1.2`.
5. Push the branch and tag.
6. GitHub Actions builds, signs, notarizes, packages, creates the GitHub Release, uploads Electron artifacts, and attaches the matching `CHANGELOG.md` section as the release notes.

The release notes come straight from the promoted changelog section, no commit scraping. Keep entries flowing in via the `changelog` skill as work lands.

If using electron-builder GitHub publish, set `publish.releaseType = "release"` or expect a draft release that must be manually published.

Expected release artifacts:

- `latest-mac.yml`
- `Hubble-x.y.z-arm64-mac.zip`
- `Hubble-x.y.z-arm64.dmg`
- `.blockmap` files
