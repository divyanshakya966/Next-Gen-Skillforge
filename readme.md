# Next-Gen Skillforge

> AI-powered career intelligence dashboard

[![Contributors](https://img.shields.io/github/contributors/divyanshakya966/Next-Gen-Skillforge)](https://github.com/divyanshakya966/Next-Gen-Skillforge/graphs/contributors)
[![Issues](https://img.shields.io/github/issues/divyanshakya966/Next-Gen-Skillforge)](https://github.com/divyanshakya966/Next-Gen-Skillforge/issues)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Hosted on Cloudflare](https://img.shields.io/badge/Hosted%20on-Cloudflare-F38020?logo=cloudflare)](https://cloudflare.com/)
[![CI](https://img.shields.io/github/actions/workflow/status/divyanshakya966/Next-Gen-Skillforge/ci.yml?branch=main&label=CI)](https://github.com/divyanshakya966/Next-Gen-Skillforge/actions/workflows/ci.yml)


Next-Gen Skillforge is an AI-powered career intelligence dashboard. It analyzes public profile links and resume content, extracts skill signals, generates role-fit insights, and creates a personalized learning roadmap.

## Architecture

The app deploys as a single Cloudflare Worker:

| Component | Platform | Purpose |
|-----------|----------|---------|
| **App** | Cloudflare Workers | Hono API on `/api/*` + Next.js static export served from `out/` via Workers Assets |
| **Sessions** | Workers KV + D1 | Encrypted cookie sessions in KV, mirrored to D1 for durable storage |

The frontend calls the API on the same origin using relative paths (`/api/...`), so no CORS setup or `NEXT_PUBLIC_API_URL` is needed. Session data is stored in Workers KV (primary) and mirrored to Cloudflare D1 (durable fallback); the cookie holds an encrypted session id.

## Core Functionality

- Link-based profile analysis (GitHub, LinkedIn, portfolio, resume URL, Twitter, Dev.to).
- Resume upload and parsing (`.txt`; `.pdf`/`.docx` parsing unavailable on Workers).
- `POST /api/analyze` runs the full analysis pipeline:
  - Scrapes GitHub (REST API), Dev.to (API), and generic links (HTML meta extraction).
  - Deterministic heuristic engine (skill keyword dictionaries) always works with zero configuration.
  - Optional AI enrichment when an API key is configured (OpenAI, Azure OpenAI, Anthropic, or Hugging Face).
- AI-generated outputs:
  - Technical and soft skill scoring.
  - Summary, strengths, and growth gaps.
  - Industry relevance score.
  - ATS score with actionable feedback (when resume text is available).
  - Job recommendations with match percentage and fit reason.
  - Prioritized learning path with resource links.
- Downloadable PDF report from analyzed profile data.
- Session-backed persistence for preferences, resume text, and last valid analysis.

## Tech Stack

- Next.js 15 (App Router, static export)
- React 18 + TypeScript
- Tailwind CSS
- Framer Motion
- Recharts
- Hono + Cloudflare Workers (API + static assets)
- Vitest (testing)
- Cloudflare Workers KV (session storage)

## Project Structure

```text
next-gen-skillforge/
├── app/                 # Next.js frontend (App Router, static export)
│   ├── page.tsx         # Landing page
│   ├── layout.tsx       # Root layout (sidebar, theme, toasts)
│   ├── dashboard/       # Dashboard (stats, quick actions, saved analysis)
│   ├── profile/         # Profile setup (links, resume upload)
│   ├── analysis/        # Skill/job analysis (summary, charts, recommendations)
│   ├── learning/        # Personalized learning path
│   └── report/          # Downloadable PDF report
├── components/          # React components
│   ├── layout/          # App shell (sidebar navigation)
│   ├── sections/        # Landing page sections
│   └── ui/              # UI kit (buttons, cards, toasts, skeletons, ...)
├── lib/                 # Shared libraries
│   ├── api-client.ts    # Fetch-based API client (same-origin /api calls)
│   ├── types.ts
│   └── utils.ts
├── src/                 # Cloudflare Worker backend
│   ├── index.ts         # Worker entry: routes /api/* to Hono, everything else to static assets
│   ├── session.ts       # Encrypted cookie sessions + Env types
│   ├── store.ts         # Session persistence (KV primary, D1 mirror)
│   ├── validate.ts      # Shared profile/analysis validators
│   ├── ai.ts            # AI provider adapters (OpenAI, Anthropic, Hugging Face)
│   ├── types.ts         # Worker types
│   ├── engine/          # Analysis engine
│   │   ├── index.ts     # Orchestrator (sources -> skills -> optional AI -> profile)
│   │   ├── scrape.ts    # GitHub/Dev.to/generic link scraping
│   │   ├── skills.ts    # Skill keyword dictionaries + detection
│   │   └── build.ts     # Deterministic profile/summary/jobs/learning builder
│   └── routes/          # API route handlers
│       ├── analyze.ts   # POST /api/analyze (full pipeline)
│       ├── preferences.ts
│       ├── analysis.ts
│       ├── resume.ts
│       └── report.ts
├── public/              # Static assets
├── schema.sql           # D1 schema (users table)
├── wrangler.toml        # Worker configuration (API + assets + KV + D1 bindings)
├── next.config.mjs      # Next.js config (static export)
├── vitest.config.ts     # Test configuration
└── package.json
```

## Local Development

### Prerequisites

- Node.js v22+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account

### Setup

```bash
# Install dependencies
npm ci

# Authenticate with Cloudflare
npx wrangler login

# Create the KV namespace (one-time)
npx wrangler kv:namespace create "SESSION_KV"
# Add the returned ID to wrangler.toml under [[kv_namespaces]] id

# Create the D1 database (one-time) and apply the schema
npx wrangler d1 create NEXT_GEN_SKILLFORGE_DB
# Add the returned database_id to wrangler.toml under [[d1_databases]]
npx wrangler d1 execute NEXT_GEN_SKILLFORGE_DB --file=./schema.sql
npx wrangler d1 execute NEXT_GEN_SKILLFORGE_DB --local --file=./schema.sql

# Set the session secret (one-time)
npx wrangler secret put SESSION_SECRET
# Value must be at least 32 characters

# Optional: enable AI enrichment (any one provider)
# Copy .dev.vars.example to .dev.vars for local development, or use
# `npx wrangler secret put OPENAI_API_KEY` (etc.) in production.

# Full local app: build the frontend, then serve UI + API together (port 8787)
npm run build
npm run dev:worker

# Frontend hot reload at http://localhost:3000. In `development` mode only, /api/* is
# proxied to the Worker, so keep `npm run dev:worker` running in a second terminal.
npm run dev
```

`wrangler dev` serves the static export from `out/` and the Hono API on the same origin, so the whole app works at `http://localhost:8787`. The frontend uses relative `/api/...` paths, so no environment variables are required for local development. When using `npm run dev` on port 3000, `next.config.mjs` proxies `/api/*` to `http://localhost:8787` (override with `DEV_API_ORIGIN`); this proxy is never enabled in production builds.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server (frontend only) |
| `npm run dev:worker` | Serve UI + API locally with wrangler (port 8787) |
| `npm run build` | Build Next.js static export (`out/`) |
| `npm run build:cf` | Alias of `npm run build` |
| `npm run deploy` | Deploy Worker (API + static assets) to Cloudflare |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type check |
| `npm run test` | Run Vitest test suite |
| `npm run test:watch` | Run Vitest in watch mode |

## CI/CD

GitHub Actions runs on every push and PR to `main`:

1. **Lint** — ESLint
2. **Type Check** — `tsc --noEmit`
3. **Tests** — Vitest unit tests
4. **Build** — Next.js static export (`out/`)

Additional automation on PRs and issues:

- **PR Guard** — validates every PR: Conventional Commit title, linked issue, real description, no secret files, maintainer-only workflow changes, size limit
- **Spam Moderation** — auto-closes spam issues/PRs; flags new/empty accounts for human review
- **Stale** — marks inactive items after 21 days, closes 7 days later (program labels exempt)
- **CodeQL** — static security analysis (JavaScript/TypeScript)
- **Dependency Review** — blocks PRs introducing vulnerable dependencies (high severity+)
- **Labeler** — applies `area/*` labels based on changed paths
- **Dependabot** — weekly npm and GitHub Actions update PRs

Deployment is done manually with `npm run deploy` (requires `wrangler login`).

## Deployment

The app is deployed as a single Cloudflare Worker (Hono API + static frontend):

1. One-time setup: create the `SESSION_KV` namespace and set `SESSION_SECRET` (see Setup above).
2. Build and deploy:

```bash
npm run build
npm run deploy
```

`wrangler deploy` uploads the Worker code and the contents of `out/` (Workers Assets). The Worker routes `/api/*` to Hono and serves everything else from the static export.

## Testing

```bash
npm run test          # Run all tests once
npm run test:watch    # Watch mode
```

Tests cover session encryption/cookie handling, link/sanitization validation, analysis payload validation, the analysis engine (skill detection, scraping utilities, deterministic profile builder), PDF report utilities, and the API client.

## Contributing

We welcome contributions, including from **[Nexus Spring of Code (NSoC)](https://www.nsoc.in/)** participants!

- New contributors: start with the [Contributing Guide](CONTRIBUTING.md) — setup, branch/commit conventions, rebase workflow, and what reviewers expect.
- Found a bug or have an idea? [Open an issue](https://github.com/divyanshakya966/Next-Gen-Skillforge/issues/new/choose) using the templates.
- **Security issues:** report privately via [SECURITY.md](SECURITY.md) — never a public issue.
- Maintainers/reviewers: see the [Maintainer Guide](MAINTAINERS.md) for triage, review checklists, and conflict handling.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating. All PRs must pass the CI checks (lint, typecheck, tests, build, PR structure) before merging to `main`.

Good starting points are issues labeled `good first issue` and `help wanted`.

## License

MIT License — see [LICENSE](LICENSE) for details.
