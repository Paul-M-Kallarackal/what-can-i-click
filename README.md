# What can I Click

An open-source, WebMCP-enabled visual guide to avoiding common ClickHouse mistakes.

Live site: [what-can-i-click.moriatz.com](https://what-can-i-click.moriatz.com)

What can I Click turns six high-impact ClickHouse gotchas into interactive 3D stories. Each story follows the same causal contract:

```text
Cause → Impact → Avoid → Verify
```

The healthy MergeTree foundry is the default. Visitors can manually explore every story, while a WebMCP-capable agent can assemble a three-to-five-story journey for a specific workload—without executing SQL, accepting credentials, or reading a private cluster.

## Six visual stories

1. **Parts pressure** — small inserts, partition fan-out, materialized-view fan-out, and merge backlog.
2. **Scale and coordination** — vertical scaling, shards, replicas, scatter/gather, and Keeper quorum.
3. **Updates and deduplication** — mutations, patch updates, ReplacingMergeTree, retry deduplication, `argMax`, and `FINAL`.
4. **Read-path surprises** — ordering keys, sparse marks, granules, skipping indexes, point lookups, and misleading `LIMIT`.
5. **Memory pressure** — high-cardinality aggregation, spill, joins, quotas, and overcommit.
6. **Materialized-view traps** — incremental and refreshable views, insert fan-out, trigger scope, and target-contract mismatches.

Each story has original procedural Three.js geometry, a draggable four-stop rail, story-specific qualitative instruments, a compact legend, reduced-motion equivalence, keyboard controls, and linked official evidence. Exact timings or multipliers appear only when a cited source supplies the required conditions.

The source framework is the official [ClickHouse common getting-started issues article](https://clickhouse.com/blog/common-getting-started-issues-with-clickhouse). Claims are pinned to ClickHouse 26.3 LTS for this release and classified as official, derived, or field evidence.

## Workload personalization

The deterministic advisor accepts bounded architecture fields plus optional diagnostics:

- cloud, self-managed, or undecided deployment;
- batched, many-small, mixed, or unknown insert behavior;
- range, aggregate, point-lookup, join-heavy, or mixed queries;
- partition cardinality; and
- materialized-view footprint.

It returns an ordered journey of distinct relevant gotchas with explicit assumptions, recommendations, tradeoffs, validation steps, confidence, and evidence. Missing diagnostic fields receive conservative defaults, so existing callers remain compatible.

## WebMCP tools

The app registers exactly seven bounded tools when `document.modelContext` is available:

| Tool | Purpose | Changes scene state |
| --- | --- | --- |
| `describe_clickhouse_world` | Describe the healthy foundry, six gotchas, and manual fallback | No |
| `recommend_clickhouse_architecture` | Produce architecture decisions and a personalized three-to-five-story journey | Yes |
| `play_architecture_story` | Play one gotcha or the latest personalized journey | Yes |
| `inspect_clickhouse_mechanism` | Focus a reviewed mechanism, MergeTree family, gotcha, or story beat | Yes |
| `compare_clickhouse_methods` | Compare reviewed scaling, update, read, and view strategies | Yes |
| `search_clickhouse_evidence` | Search the bounded public evidence corpus | No |
| `reset_clickhouse_world` | Return to the healthy MergeTree baseline | Yes |

The header reports `Agent tools ready · 7`, partial registration, or `Manual mode`. Tool inputs use strict Zod schemas. Unknown fields and malformed IDs are rejected, as are credentials, arbitrary SQL, executable content, private-cluster payloads, external models, shaders, and asset URLs. The manual experience remains complete when WebMCP is unavailable.

## Architecture

```text
Bounded workload profile
        │ strict validation + diagnostic defaults
        ▼
Deterministic advisor ─── reviewed evidence registry
        │ ranked gotcha journey
        ▼
Zustand application state ─── seven WebMCP tools
        │
        ├── accessible story card, shelf, rail, inspector, and narration
        └── renderer-independent semantic state ─── React Three Fiber scenes
```

One gotcha registry drives camera poses, semantic events, instruments, legends, narration, evidence, accessible summaries, and WebMCP focus. Simulation truth remains outside React Three Fiber; the renderer only interpolates reviewed states and does not remount the canvas between beats.

The evidence and mechanism registries live in [`src/data/evidence.ts`](src/data/evidence.ts), [`src/data/mechanisms.ts`](src/data/mechanisms.ts), and [`src/data/gotchas.ts`](src/data/gotchas.ts).

## Local development

Prerequisite: [Bun](https://bun.sh/) 1.3.14 or a compatible release.

```bash
git clone https://github.com/Paul-M-Kallarackal/what-can-i-click.git
cd what-can-i-click
bun install --frozen-lockfile
bun run dev
```

The development server binds to `127.0.0.1` by default.

## Quality commands

```bash
bun run typecheck      # TypeScript project references
bun run test           # advisor, registry, evidence, and WebMCP contract tests
bun run build          # production bundle
bun run test:e2e       # Chromium interaction, responsive, and WebGL smoke tests
bun run audit          # high-severity dependency audit
bun run check          # typecheck, tests, audit, and production build
```

CI runs the same checks on pushes and pull requests. CodeQL, Dependabot, least-privilege workflow permissions, lockfile-frozen installs, and cached Playwright downloads are configured under [`.github`](.github).

## Security and privacy

- The app is static and has no accounts, database, analytics SDK, or private-cluster ingestion.
- No API keys are required or supported by the browser application.
- `.env*`, `.dev.vars`, credentials, private keys, hosting state, and build artifacts are ignored.
- Production security headers restrict scripts, framing, powerful browser capabilities, and cross-origin resource loading.
- Production source maps are disabled.
- Vulnerabilities should be reported according to [`SECURITY.md`](SECURITY.md), not through a public issue.

Never commit credentials. Any future secret-bearing integration must use an encrypted provider store and a server-side boundary.

## Deployment

The static build deploys to Vercel. DNS for `moriatz.com` remains managed by Hostinger.

```bash
bunx vercel login
bun run deploy
```

No Vercel or Hostinger token belongs in this repository.

## Contributing

Issues and focused pull requests are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before changing evidence, advisor rules, WebMCP contracts, or visualization semantics.

## Trademark and attribution

ClickHouse and its logo are trademarks of ClickHouse, Inc. The official logomark is displayed unmodified in the attribution panel. This independent educational project is not endorsed by or affiliated with ClickHouse, Inc.

The Strawn display font is used under its accompanying notice in [`public/FONT-NOTICE.txt`](public/FONT-NOTICE.txt).

## License

[MIT](LICENSE) © 2026 Paul M. Kallarackal.
