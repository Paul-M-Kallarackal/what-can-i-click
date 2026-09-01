# What can I Click

An open-source, WebMCP-enabled visual guide to ClickHouse architecture.

What can I Click makes ClickHouse gotchas visible. Its interactive 3D foundry shows how tiny inserts, excessive parts, poor ordering keys, expensive reads, competing background work, mutations, and replication failures change the system.

WebMCP makes those lessons specific to a visitor's workload. A WebMCP-capable agent can select the relevant reviewed mechanisms, recommend safer patterns, explain tradeoffs, and return validation steps without executing SQL or reading a private cluster.

> **Project status:** Hackathon prototype under active visual review. The manual experience now stays on one polished, healthy MergeTree foundry. WebMCP applies the broader gotcha, mechanism, and evidence registries only when a user asks for workload-specific guidance.

## Why this exists

ClickHouse advice is easy to memorize and hard to reason about. This project makes the causal chain visible:

- how small inserts become part pressure;
- how immutable parts merge in the background;
- when to choose MergeTree, ReplacingMergeTree, CoalescingMergeTree, SummingMergeTree, AggregatingMergeTree, CollapsingMergeTree, or VersionedCollapsingMergeTree;
- how `argMax` and `SELECT FINAL` trade explicit aggregation against query-time engine reconciliation;
- how ordering, sparse indexes, granules, and column pruning reduce reads;
- how an incremental materialized view writes a separately queried target while a projection stays attached to the base table and is selected by the optimizer;
- how shards, replicas, and Keeper solve different distributed-system problems; and
- why TTL and mutations consume merge resources.

Every recommendation includes rationale, alternatives, tradeoffs, validation steps, confidence, and linked evidence. Timing labels are qualitative unless a source provides a defensible measurement.

The manual shell stays on the core MergeTree foundry. An explicit WebMCP family request temporarily replaces that card with the selected engine's fit, gotcha, and read contract; it never reintroduces the old family grid. ReplacingMergeTree's background, `argMax`, and `FINAL` views use separate deterministic 3D lifecycles so the selected advice and the visible machine cannot silently disagree.

When an agent requests `argmax-vs-final`, one shared candidate rack feeds two synchronized 3D lanes. The comparison makes the decision boundary explicit: `argMax` needs one deliberate total order; `FINAL` asks the engine to reconcile matching candidates during the query. Comparison mode disappears as soon as a single method or another part of the world is selected.

When an agent requests `materialized-view-vs-projection`, one inserted block feeds two visibly different contracts. The yellow lane transforms the block and writes a separate target table; the cyan lane installs an alternate representation inside the base table lifecycle and lets the optimizer choose it. Architecture recommendations can provide a bounded `accelerationGoal` so repeated aggregates and routing transforms do not collapse into the same advice as alternate sorting and transparent acceleration.

CoalescingMergeTree similarly distinguishes eventual storage convergence from a bounded `SELECT FINAL` read. The background mosaic kiln assembles sparse fields during later merges; the query-time light table assembles them now and makes the extra read work and NULL semantics explicit.

SummingMergeTree uses one causal two-track machine instead of a magic counter animation. Parts A (`+5`) and B (`+7`) become a stored partial (`12`) during one background merge while a newer equal-key part (`+4`) remains separate. The exact read then aggregates both visible rows into `16`, matching the documented requirement to use the appropriate `SUM` and `GROUP BY` because summation across resulting parts may be incomplete.

AggregatingMergeTree makes the `-State` / `-Merge` boundary physical. Two `avgState` capsules retain `(sum, count)` as `(20, 2)` and `(90, 3)`; the background refinery combines them into `(110, 5)`, and only the read-side `avgMerge` gate emits the scalar `22`. This prevents the visualization from implying that merges average already-finalized averages.

CollapsingMergeTree now shows one valid producer history rather than two anonymous signs. The old `(5 views, 146s, +1)` state meets its exact `(5, 146, -1)` cancel copy at the background-collapse gate, while the `(6, 185, +1)` replacement survives. The read lane demonstrates why metrics remain sign-aware before that merge has happened and calls out bounded `FINAL` as a different row-extraction choice.

VersionedCollapsingMergeTree turns version matching into a routing system. A v2 state arrives first, followed by a v1 cancel and then the v1 state; the router still pairs only the same-key v1 rows with opposite signs. The v1 pair collapses and v2 survives, making the engine’s order-independent write advantage and exact-version producer obligation visible.

The primary experience uses a consistent physical vocabulary: immutable white cassettes, visible column files, a working crane, a black merge worker, a newly written Part C, and a rear retirement bin for Parts A and B. There is no decorative tree or manual failure-mode picker. When an agent supplies a bounded workload, the exact generated recommendation—not a nearest canned example—opens as a draggable sequence of `Do / Why / Tradeoff / Validate` decisions. Every slider stop focuses its reviewed 3D mechanism, sources, alternatives, and production check without placing the MergeTree workbench over the scene. The advisor chooses plain MergeTree for append-only facts and ReplacingMergeTree with explicit `argMax(version)` current-state reads for appended updates; it reserves `FINAL` for bounded cases that have been measured.

## WebMCP tools

The app registers seven bounded tools when `document.modelContext` is available:

| Tool | Purpose | Changes scene state |
| --- | --- | --- |
| `describe_clickhouse_world` | Describe reviewed MergeTree behavior, mechanisms, and evidence | No |
| `recommend_clickhouse_architecture` | Build a deterministic recommendation, open its exact decision sequence, and focus the first 3D mechanism | Yes |
| `play_architecture_story` | Animate the healthy recommendation path or a reviewed company architecture | Yes |
| `inspect_clickhouse_mechanism` | Focus a reviewed mechanism; optionally select a bounded family/read behavior | Yes |
| `compare_clickhouse_methods` | Align two mechanisms, compare `argMax` with `FINAL`, compare materialized views with projections, or open two reviewed production accounts side by side | Yes |
| `search_clickhouse_evidence` | Search the bounded public evidence corpus | No |
| `reset_clickhouse_world` | Restore the initial simulation state | Yes |

Tool inputs are validated with strict Zod schemas. Unknown fields are rejected, including credentials, arbitrary SQL, executable content, private cluster payloads, and external asset URLs. The application remains fully usable without WebMCP.

## Evidence model

Claims are labeled as:

- **Official** — ClickHouse documentation or official ClickHouse guidance.
- **Derived** — a deterministic conclusion assembled from cited official claims.
- **Field** — a manually reviewed public engineering or customer story.

The bundled corpus retains the original ten representative public stories and currently includes 40 reviewed production implementation accounts for aligned side-by-side comparison. Runtime and WebMCP summaries still derive the count from the registry. A family shows at most three company chips, and only when the reviewed source explicitly names that engine; an evidence gap is labeled rather than filled by inference. Versions are recorded only when a source explicitly discloses them; otherwise the UI says “Not disclosed.” The registries are in [`src/data/evidence.ts`](src/data/evidence.ts) and [`src/data/companyImplementations.ts`](src/data/companyImplementations.ts).

## Architecture

```text
Workload profile
      │ strict schema validation
      ▼
Deterministic advisor ─── evidence registry
      │ ordered mechanism IDs
      ▼
Zustand application state ─── WebMCP tools
      │
      ├── React healthy-baseline card, exact recommendation panel, and mechanism inspector
      └── renderer-independent simulation clock ─── stable 3D foundry walkthrough
```

The mechanism registry is the shared source of truth for WebMCP focus, inspector content, accessible narration, and 3D placement. Simulation truth stays outside React Three Fiber; the renderer interpolates reviewed semantic states.

## Local development

Prerequisites: [Bun](https://bun.sh/) 1.3.14 or a compatible release.

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
bun run test           # deterministic advisor and data-contract tests
bun run build          # production bundle
bun run test:e2e       # Chromium interaction and responsive smoke tests
bun run audit          # high-severity dependency audit
bun run check          # typecheck, tests, audit, and production build
```

CI runs the same checks on pushes and pull requests. CodeQL, Dependabot, least-privilege workflow permissions, lockfile-frozen installs, and cached toolchain downloads are configured under [`.github`](.github).

## Security and privacy

- The app is static and has no account system, database, analytics SDK, or private-cluster ingestion.
- No API keys are required or supported by the browser application.
- `.env*`, `.dev.vars`, Wrangler state, credentials, private keys, and build artifacts are ignored.
- Cloudflare Pages security headers restrict scripts, framing, powerful browser capabilities, and cross-origin resource loading.
- Production source maps are not emitted.
- Please report vulnerabilities according to [`SECURITY.md`](SECURITY.md), not through a public issue.

Never commit credentials. If a future integration requires a secret, keep it in the hosting provider's encrypted secret store and access it only from a server-side boundary.

## Deployment

The static build is configured for Cloudflare Pages:

```bash
bunx wrangler login
bun run deploy
```

No Cloudflare token belongs in this repository. CI deployment should use an environment-scoped GitHub secret only if automated deployment is added later.

## Contributing

Issues and focused pull requests are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before changing evidence, advisor rules, WebMCP contracts, or visualization semantics.

## Trademark and attribution

ClickHouse and its logo are trademarks of ClickHouse, Inc. The official logomark is displayed unmodified in the attribution panel. This independent educational project is not endorsed by or affiliated with ClickHouse, Inc.

The Strawn display font is used under its accompanying notice in [`public/FONT-NOTICE.txt`](public/FONT-NOTICE.txt).

## License

[MIT](LICENSE) © 2026 Paul M. Kallarackal.
