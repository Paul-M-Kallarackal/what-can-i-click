# What can I Click

An open-source, WebMCP-enabled visual guide to ClickHouse architecture.

What can I Click turns a bounded workload profile into a deterministic, evidence-backed architecture recommendation, then explains that recommendation through an inspectable 3D simulation. The site does not call an LLM or require a backend: a visitor's WebMCP-capable agent interprets natural language, while the browser owns the rules, evidence, visualization state, and safety boundaries.

> **Project status:** Hackathon prototype. The current six-district world is being rebuilt as a mechanism-specific ClickHouse cutaway. See the [visualization redesign plan](docs/visualization-redesign-plan.md).

## Why this exists

ClickHouse advice is easy to memorize and hard to reason about. This project makes the causal chain visible:

- how small inserts become part pressure;
- how immutable parts merge in the background;
- how ordering, sparse indexes, granules, and column pruning reduce reads;
- how materialized views and projections move or duplicate work;
- how shards, replicas, and Keeper solve different distributed-system problems; and
- why TTL and mutations consume merge resources.

Every recommendation includes rationale, alternatives, tradeoffs, validation steps, confidence, and linked evidence. Timing labels are qualitative unless a source provides a defensible measurement.

## WebMCP tools

The app registers seven bounded tools when `document.modelContext` is available:

| Tool | Purpose | Changes scene state |
| --- | --- | --- |
| `describe_clickhouse_world` | Describe available mechanisms and evidence | No |
| `recommend_clickhouse_architecture` | Build a deterministic recommendation from an enumerated workload | Yes |
| `play_architecture_story` | Animate a recommendation path | Yes |
| `inspect_clickhouse_mechanism` | Focus one mechanism and open its explanation | Yes |
| `compare_clickhouse_methods` | Compare two supported mechanisms | No |
| `search_clickhouse_evidence` | Search the bounded public evidence corpus | No |
| `reset_clickhouse_world` | Restore the initial simulation state | Yes |

Tool inputs are validated with strict Zod schemas. Unknown fields are rejected, including credentials, arbitrary SQL, executable content, private cluster payloads, and external asset URLs. The application remains fully usable without WebMCP.

## Evidence model

Claims are labeled as:

- **Official** — ClickHouse documentation or official ClickHouse guidance.
- **Derived** — a deterministic conclusion assembled from cited official claims.
- **Field** — a manually reviewed public engineering or customer story.

The bundled corpus contains ten representative public stories. Versions are recorded only when the source explicitly discloses them; otherwise the UI says “Not disclosed.” The source registry is in [`src/data/evidence.ts`](src/data/evidence.ts).

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
      ├── React inspector and accessible text atlas
      └── renderer-independent simulation clock ─── React Three Fiber scene
```

The layout registry is the shared source of truth for search, WebMCP focus, inspector content, accessible text, and 3D placement. Simulation time is independent of React Three Fiber so tests can validate stories without WebGL.

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
