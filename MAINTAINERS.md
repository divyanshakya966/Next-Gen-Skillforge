# Maintainer Guide

Handbook for project admins of Next-Gen Skillforge — triage, reviews, conflict handling, and releases. Contributors should read [CONTRIBUTING.md](CONTRIBUTING.md) instead.

Program context: this project participates in [Nexus Spring of Code (NSoC)](https://www.nsoc.in/) — most PRs come from program contributors during a fixed 45-day window, so timely, kind, and specific review matters.

## Contents

- [Repository settings (one-time setup)](#repository-settings-one-time-setup)
- [Triage](#triage)
- [AI-generated PRs and spam](#ai-generated-prs-and-spam)
- [Reviewing pull requests](#reviewing-pull-requests)
- [Handling merge conflicts](#handling-merge-conflicts)
- [Merging and releasing](#merging-and-releasing)
- [Security incidents](#security-incidents)
- [Dependency upkeep](#dependency-upkeep)

## Repository settings (one-time setup)

These live in GitHub **Settings** (not in the repo files):

| Setting | Where | Value |
|---------|-------|-------|
| Branch protection | Settings → Branches → `main` | Require PR before merging; require status checks: `Lint`, `Type Check`, `Tests`, `Build`, `PR structure`; require branch to be up to date; require Code owners review; dismiss stale reviews; require linear history; do not allow bypassing; no force pushes/deletions |
| CODEOWNERS reviews | Settings → Code review | Require review from Code owners |
| Fork workflow approval | Settings → Actions → General | Require approval for first-time contributors (stops unknown/fork PRs from burning CI minutes until reviewed) |
| Workflow token perms | Settings → Actions → General | Default `GITHUB_TOKEN` permissions: **Read** (workflows request write only where needed) |
| Secret scanning | Settings → Code and analysis | Enable secret scanning + **Push protection** (free for public repos; blocks pushed credentials) |
| Dependabot security updates | Settings → Code and analysis | Enable (auto-opens PRs for vulnerable deps; on by default for public repos with dependency graph) |
| Dependency graph | Settings → Code and analysis | Enable (required by the Dependency Review CI workflow) |
| Merge settings | Settings → General | Squash merges only; delete branch on merge; no merge commits/rebase merges |
| Interaction limits | Settings → General → Moderation | Keep off normally; switch on during spam waves (limits activity to existing users for 24h/week) |
| Discussions / Issues | Settings → General | Issues enabled; Discussions optional |
| Labels | run `./scripts/setup-labels.sh` | Creates the full label taxonomy used by templates, labeler, and stale workflow |

> Run `./scripts/setup-labels.sh` **before** merging any PR — the spam moderator and stale workflows reference labels (`spam`, `stale`, `NSOC'26 (WINTER EDITION)`) that must exist.

## Triage

Cadence: a quick pass daily during NSoC, 2–3 times a week otherwise.

**Issues**

1. Reproduce bug reports (ask for a link/environment if missing). Apply `area/*` labels.
2. Close duplicates with a comment linking the original (`duplicate`).
3. Redirect questions to Discord (link in the issue form config).
4. Mark actionable, self-contained issues `good first issue` — NSoC contributors filter on these.
5. Seed issues you want done this cycle with `help wanted` and a clear acceptance checklist.
6. If an issue has gone stale (no comment in 14 days during the program), ping the author once, then close with a friendly note that they can reopen.

**Labels**

| Group | Labels |
|-------|--------|
| Type | `bug`, `feature`, `docs`, `chore`, `dependencies`, `security` |
| Difficulty | `Level 1` (docs/typos/small fixes), `Level 2` (UI/frontend: layouts, components, styling, pages), `Level 3` (core logic, data/session changes, complex features) |
| Area | `area/frontend`, `area/worker`, `area/shared`, `area/tests`, `area/docs`, `area/ci` |
| Program | `NSOC'26 (WINTER EDITION)`, `good first issue`, `help wanted` |
| Workflow | `needs review`, `changes requested`, `blocked` |
| Moderation | `spam` (auto-applied by Spam Moderation; issue/PR already auto-closed), `stale` (auto-applied by Stale), `ai-generated` (suspected bulk AI output) |

When triaging: add `NSOC'26 (WINTER EDITION)` to every program issue/PR, a **Level** to every actionable issue (Level 1 first for newcomers), and `area/*` when the labeler missed it.

Area labels are applied automatically on PRs by the `Labeler` workflow (`.github/labeler.yml`).

## AI-generated PRs and spam

The repo gets automated defenses; humans handle judgment calls. How the layers work:

**Automated (runs on every issue/PR):**

| Defense | Trigger | Action |
|---------|---------|--------|
| **PR Guard** (`pr-guard.yml`) | Every PR opened/edited | Fails CI unless: Conventional Commit title, linked issue (`Closes #n`), ≥40-word description, no secret-looking files, workflow files only changed by maintainers, ≤4,000 changed lines (or `large-pr-ok` justification) |
| **Spam Moderation** (`spam-moderation.yml`) | Every issue/PR opened | Spam keywords/patterns → label `spam` + auto-close. New account (<7d) + near-empty body → label `spam` + welcome comment, left open for review. Maintainers/bots are exempt |
| **Stale** (`stale.yml`) | Daily sweep | Marks 21-day-inactive items, closes 8 days later; program labels exempt |
| **Dependency Review** | PRs | Fails on new high-severity vulnerable dependencies |
| **CODEOWNERS** | PRs | Auto-requests your review on `src/`, session code, CI changes |

**Policy for suspected AI-generated PRs** (the automation can't detect "AI", so this is reviewer guidance):

Close without merge — politely, citing this policy — when a PR shows multiple signals:

- Generic title/body pasted from the template with no real test plan or issue context
- Code that doesn't match the linked issue (unrelated files refactored, speculative features)
- Identical structure across multiple PRs from the same author (spam pattern)
- Author cannot answer basic questions about the change in review comments
- Massive diffs for trivial asks (the 4,000-line guard catches the extreme cases)

A good closing comment:

> Thanks for the PR! Per our contribution policy, changes need to be understood and verified by their author — we can't merge code whose rationale and test plan aren't demonstrated in the PR. Please pick up an issue at your skill level (start with `Level 1`), describe your approach in the issue first, then send a focused PR.

**Not** a reason to close: using AI as a tool is fine (it's fine for everyone); the bar is understanding, a real test plan, and issue-first discussion. If unsure, request changes and ask one scoping question — silence or a wrong answer confirms the signal.

**Spam waves** (burst of junk issues/PRs): turn on Interaction limits (Settings → General → Moderation) for 24–48h, close-and-lock with the `spam` label (the labeler comment pattern is in `spam-moderation.yml`), and report the accounts to GitHub.

## Reviewing pull requests

First pass within 2 working days during NSoC — slow reviews are the #1 reason contributors drop out.

**Order of review**

1. **Scope** — Does the PR do one thing? Linked to an issue (`Closes #n`)? If it mixes concerns, ask to split before reviewing deeply.
2. **Correctness** — Does the test plan make sense? Are edge cases handled (empty session, failed AI call, missing profile)?
3. **CI** — All five checks green (`Lint`, `Type Check`, `Tests`, `Build`, `PR structure`). Never approve a red PR; explain what failed and how to run it locally.
4. **Security & secrets** — `git diff` for hardcoded keys, `console.log` of cookies/PII, unsafe `dangerouslySetInnerHTML`, user input reaching AI prompts unsanitized, new deps with known advisories (Dependency Review flags these).
5. **Project fit** — Conventions over personal preference. Match existing patterns (`components/ui/*`, relative `/api/` calls, HSL theme vars).
6. **Docs & tests** — User-facing changes need README/docs updates; bug fixes need a regression test where practical.

**Review etiquette**

- Prefer suggestions (`Add co-suggestion`) over re-writing the contributor's code.
- Separate blocking (`must fix`) from optional (`nit:`) comments — prefix them so newcomers can act confidently.
- Approve and merge small, safe PRs from `good first issue` quickly — momentum beats perfection.
- Ask for changes at most twice; if a third round is needed, offer to pair or take over the PR (credit the contributor in the squash message).

**Review commands**

```bash
gh pr list                    # open PRs
gh pr checkout <n>            # switch to a PR locally
gh pr checks <n>              # CI status
gh pr review <n> --request-changes --body "..."
gh pr merge <n> --squash --delete-branch
```

## Handling merge conflicts

**When conflicts are small and obvious** (formatting, one-line changes):

1. Comment on the PR: `This needs a rebase — run: git fetch origin && git rebase origin/main`
2. Offer to resolve it yourself if the contributor is new: *"I can resolve this and keep your commits — say the word."*

**When you resolve on the contributor's behalf:**

```bash
gh pr checkout <n>
git fetch origin
git rebase origin/main
# resolve each conflicted file, then:
git add <files>
git rebase --continue
git push --force-with-lease
```

Always push with `--force-with-lease` (never `--force`), and leave a comment summarizing what you resolved.

**When conflicts are large** (page rewritten during a busy week): close the PR politely with `wontfix` + an explanation, and offer to re-open it against the current `main` — do not leave contributors guessing.

Contributor-facing rebase instructions live in [CONTRIBUTING.md](CONTRIBUTING.md#keeping-your-branch-up-to-date--resolving-conflicts).

## Merging and releasing

- **Strategy:** squash merge only (keeps `main` history linear; squash title must follow Conventional Commits, e.g. `fix: correct report page ternary`).
- **Before merging a PR:** confirm the linked issue exists, CI is green, no unrelated files (lockfile noise, `.env*`, editor configs).
- **Deployment (manual):**

  ```bash
  npm ci
  npm run lint && npm run typecheck && npm run test && npm run build
  npm run deploy        # wrangler deploy: uploads Worker + out/ assets
  ```

  Verify the deployed URL after deploying, and comment on the related issue that it shipped.
- **Secrets rotation:** if a secret leaks, rotate it in the Cloudflare dashboard / `wrangler secret put`, then follow [SECURITY.md](SECURITY.md).

## Security incidents

1. Do **not** discuss in public issues — use GitHub Security Advisories (see [SECURITY.md](SECURITY.md)).
2. Acknowledge the report within 3 working days.
3. Reproduce on a local `wrangler dev` setup, write a fix + regression test, deploy, then publish the advisory.
4. If user data may be affected, disclose honestly in the advisory — this is an NSoC program project and trust is part of the score.

## Dependency upkeep

- **Dependabot** opens grouped PRs weekly (npm) and for GitHub Actions, **minor/patch only** — major bumps are ignored in `.github/dependabot.yml` and must be done by a deliberate maintainer PR (majors often change config schemas, e.g. `labeler` v5→v6, `next` 15→16). Security update PRs are unaffected by that ignore rule. Review with the Dependency Review workflow output; merge green bumps promptly.
- Once a month: run `npm audit` locally and skim release notes of `next`, `hono`, and `wrangler` for breaking changes.
- New dependencies in a contributor PR need justification in the PR discussion — prefer the standard library or existing packages (`clsx`, `tailwind-merge`, `lucide-react` already exist).
