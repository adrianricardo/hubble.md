---
name: changelog
description: Add a user-facing entry to CHANGELOG.md for work that just landed. Use when wrapping up a feature/fix, or when asked to record what changed. Called standalone or from the `done` skill.
---

# Changelog

Record what shipped as it lands. Do not scrape commits at release time, write
the entry now while the change is fresh.

## How

1. Open root `CHANGELOG.md`.
2. Add one bullet under `## [Unreleased]`, in the right subhead:
   - `Added` — new features the user can see/use.
   - `Changed` — behavior changes to existing features.
   - `Fixed` — bug fixes.
3. Write it for a user reading release notes, not as a commit message:
   - One line, present tense, no trailing period needed.
   - Describe the effect, not the implementation or file paths.
   - Skip internal-only churn (refactors, deps, CI, tests) unless it changes
     what the user experiences.

Create a subhead only if it has at least one entry. Leave the empty scaffold
subheads as-is for the next entry.

## Example

```markdown
## [Unreleased]

### Added
- First-run onboarding with an HTML Apps callout
- View and run HTML apps inside the editor

### Fixed
- Slash menu no longer hides behind the toolbar
```

Entries stay under `Unreleased` until `/release` promotes them to a version
heading. See `.agents/skills/release`.
