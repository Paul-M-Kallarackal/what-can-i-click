# What can I Click — Current Visualization Contract

## Product thesis

What can I Click has two jobs:

1. Make ClickHouse gotchas visually understandable before a visitor reads documentation.
2. Let a WebMCP agent turn those lessons into a bounded, evidence-backed recommendation for the visitor's workload.

The manual interface is intentionally narrow. It opens on one clean MergeTree foundry, one current-scenario card, and one compact scenario control. Search, family grids, production chips, a text-heavy system map, speed controls, and canned use-case launchers are not part of the visible shell.

When WebMCP explicitly focuses another reviewed MergeTree-family engine, the same workbench becomes an agent-selected recommendation card instead of resetting the request. It shows the engine's merge contract, when it fits, its main correctness trap, and a direct route back to plain MergeTree. ReplacingMergeTree also exposes the selected latest-state method. Background convergence, `argMax`, and `SELECT FINAL` each run a distinct deterministic observe → evaluate → resolve → emit choreography in the 3D machine, with relative read work shown semantically rather than as an invented benchmark.

The bounded `argmax-vs-final` comparison is also agent-only. It uses one shared set of version candidates and two parallel lanes: cyan computes an explicit `(version, tie-breaker)` winner with `argMax`, while yellow applies ReplacingMergeTree rules through `SELECT FINAL`. Both return the same logical v3 row in the reviewed example; the visualization compares the contract and relative read work, not an invented latency number. Choosing any single family, strategy, scenario, mechanism, journey, or evidence item clears comparison state.

CoalescingMergeTree has two separate sparse-update paths. Background mode uses a slow mosaic kiln: fragments can remain split across parts until an eligible merge assembles the stored row. `SELECT FINAL` uses a query-time mosaic light table: a bounded read collects the fragments immediately, applies the rule that NULL means “no update,” and returns one assembled row while showing higher read work. A family inspection without an explicit strategy always resets to reviewed background behavior rather than inheriting stale state.

SummingMergeTree separates storage reduction from read correctness in one deterministic counter line. One background merge visibly compacts equal-key Parts A (`+5`) and B (`+7`) into a stored partial (`12`) while a newer equal-key part (`+4`) remains in another part. The exact-read lane then aggregates every visible row and returns `16`. The agent-only card repeats that contract and recommends a separate raw MergeTree table when the rollup must not discard detail.

AggregatingMergeTree uses an `avgState` refinery to make mergeable internals tangible. The input capsules retain `(sum, count)` pairs `(20, 2)` and `(90, 3)`, the background state reactor produces `(110, 5)`, and the read-side `avgMerge + GROUP BY` gate finalizes `22`. The agent card distinguishes `AggregateFunction` state storage from the separate scalar contract of `SimpleAggregateFunction`.

CollapsingMergeTree uses the documented three-row history: old state `(5 views, 146s, +1)`, exact cancel copy `(5, 146, -1)`, and replacement `(6, 185, +1)`. The old/cancel pair aligns and descends through a later background-collapse gate while the replacement survives. A separate exact-read lane accounts for `Sign` before convergence and distinguishes sign-aware aggregation from bounded `FINAL` row extraction.

VersionedCollapsingMergeTree accepts the same logical history out of order. The demonstration deliberately receives v2 state first, v1 cancel second, and v1 state last. A physical version router sends both v1 rows to one pair lane and v2 to another; only the same-key, same-version, opposite-sign v1 pair collapses. The v2 state remains visibly current, and the agent card warns that a mis-versioned cancel cannot remove it.

## Hero scene: the MergeTree foundry

The foundry shows the real storage lifecycle with a memorable physical analogy:

- Each white cassette is one immutable data part.
- Cyan and yellow top plates identify Parts A and B while both retain the same cassette geometry.
- Visible front bands represent column files.
- A working crane lifts Part B from the intake lane and places it beside Part A.
- The black merge worker reads compatible sorted parts and writes a full-size Part C.
- Part C preserves rows from A and B in its visible row ribbon.
- A and B become inactive only after Part C commits.
- Retired A and B move into an open old-parts bin positioned behind the worker.
- The bin never hides the worker, Part C output lane, or crane handoff.
- An original low-poly tree stands behind the machine as a MergeTree landmark. It supports the name and composition but never replaces the causal storage visualization.

The legend, labels, and animation must agree. Geometry cannot change identity or scale during a handoff unless the change represents a documented lifecycle transition.

## Scenario-first gotcha lab

The visible scenario menu contains one reference state and seven controlled failure modes:

| Scenario | Cause shown | Consequence shown | Recommendation focus |
| --- | --- | --- | --- |
| Steady ClickHouse | Batched inserts and bounded work | Parts merge and reads stay selective | Preserve headroom and observe trends |
| Tiny insert storm | Independent single-row writes each stamp a tiny immutable part | A modeled 18 creations outrun two retirements, backlog grows, and part limits throttle inserts | A separate lane highlights client batching, async inserts, or preserved connector batching from the agent’s workload recommendation |
| Partition explosion | One block fans across 480 partition values, represented by six deterministic bays | Parts remain trapped in isolated merge pools | Keep lifecycle boundaries coarse and preserve query locality in ORDER BY; the correction lane adopts the agent’s retention-shaped recommendation |
| Merge + TTL + mutation contention | TTL and mutation rewrites occupy an explicitly modeled scheduling/storage-capacity chamber while normal merges wait | Merge queue age and active parts rise before the chamber shows recovery | Move broad rewrites into a protected maintenance window; the scene and WebMCP response adopt the agent’s ingest-, retention-, and update-shaped guidance without claiming a literal server worker count |
| ORDER BY misses the filter | One representative filter value is first scattered across 11 of 12 illustrated granules, then physically clustered into two adjacent granules | The same small result changes from an 11-range candidate scan to a two-range model while ten surrounding ranges become skippable | Build the key from representative workload filters and validate with `EXPLAIN indexes = 1`; the corrected-order rail adopts the agent’s workload-shaped ordering decision and explicitly labels the counts as illustrative |
| Aggregation spills to disk | Distinct group keys grow partial states until the configured memory threshold is crossed | Three representative temporary runs leave RAM, then an external merge finalizes the groups with additional I/O | Treat spill as a tested completion guardrail rather than acceleration; the result-stage prevention deck adopts the agent’s latency- and workload-shaped choice to filter earlier, precompute repeated work, or deliberately provision the batch spill path |
| Replica queue falls behind | Keeper records the operation while compressed part bytes use a visibly separate replica data path; arrivals then outrun destination fetch/storage capacity | Queue depth and oldest-task age rise together, with `GET_PART` and `MERGE_PARTS` tasks exposed independently from Keeper | Diagnose task mix, depth, age, retries, postpone reasons, and exceptions before changing capacity; the catch-up deck adopts the agent’s topology/ingest recommendation and requires both depth and oldest age to return to a tested baseline |
| Keeper quorum unavailable | K2 and K3 disconnect so the ensemble falls from 3/3 to 1/3; recovery reconnects K2 before K3 | At 1/3 replicated writes queue while local reads continue from replica parts; the visible 2/3 majority reopens coordination and drains the queue before full 3/3 convergence | Place the odd voting ensemble in independent failure domains, prove one-voter loss retains 2/3, and adopt the agent’s availability/topology-shaped Keeper decision when present |

Each scenario has its own 3D mechanism, an inspector explanation, a short “how to avoid this” recommendation, and mobile summary. When WebMCP has staged a workload, the owning scenario card and story output replace the generic advice with the matching reviewed architecture decision. Exact timings appear only when a pinned source supports them; illustrative counts are explicitly modeled rather than presented as cluster measurements.

## Visual language

| Token | Value | Meaning |
| --- | --- | --- |
| White | `#FFFFFF` | page atmosphere and negative space |
| Ceramic | `#F3F2EC` | machine stages and readable surfaces |
| Instrument black | `#15171A` | workers, frames, and primary structure |
| Click yellow | `#FFCC01` | active data, Part B, commits, and selected routes |
| Query cyan | `#78D7D2` | Part A and read-path work |
| Pressure vermilion | `#D64C3F` | overload, failure, and expensive rewrites |

Strawn is used only for the product title. The interface uses system sans-serif and monospace labels. Manual text must stay readable in the ChatGPT in-app browser: primary body copy is at least 15–16 px, scenario titles at least 20 px, and important controls at least 44 px tall.

## Interaction contract

- Drag to orbit; Shift-drag to pan on desktop; scroll to zoom.
- Pause/play and reset are the only persistent simulation controls.
- The scenario picker is the primary manual control.
- Selecting a pressure scenario focuses its responsible mechanism and opens the recommendation inspector.
- Escape moves back one interface level.
- Mobile hides the telemetry strip and keeps the scenario control reachable below the scene.
- Reduced motion preserves every state and explanation with discrete changes.
- Agent-only workload journeys appear only after a WebMCP recommendation.

## WebMCP boundary

The public tool names remain:

- `describe_clickhouse_world`
- `recommend_clickhouse_architecture`
- `play_architecture_story`
- `inspect_clickhouse_mechanism`
- `compare_clickhouse_methods`
- `search_clickhouse_evidence`
- `reset_clickhouse_world`

Inputs are strictly validated. Tools accept reviewed mechanism IDs and bounded workload fields; they never accept SQL execution, credentials, private cluster data, shader source, executable content, asset URLs, or arbitrary geometry.

Recommendations return an ordered path, rationale, alternatives, tradeoffs, validation steps, confidence, and citations. The site's deterministic rules own the recommendation; the visitor's agent translates natural language into the bounded schema.

## Architecture

The renderer never owns simulation truth. A shared clock and scalar frame functions produce semantic stages; React Three Fiber interpolates the geometry.

```text
Workload profile
      │ strict Zod schema
      ▼
Deterministic advisor ─── evidence registry
      │ mechanism IDs + tradeoffs
      ▼
Zustand state ─── WebMCP tools
      │
      ├── scenario card / agent journey / inspector
      └── shared semantic clock ─── React Three Fiber foundry
```

The mechanism registry drives WebMCP focus, the inspector, accessible narration, evidence, and the scene. No recommendation may point to a mechanism without a title, explanation, tradeoff, provenance, and accessible text equivalent.

## Quality gate

- No browser, React, WebGL, CSP, or accessibility errors.
- No horizontal overflow at 390×844, 1022×720, 1280×720, or 1440×900.
- The MergeTree card and scenario control never overlap.
- The rear retirement bin never hides the merge worker.
- Parts keep a stable scale through crane pickup and merge handoff.
- Parts A and B visibly retire only after Part C commits.
- Keeper remains outside the user-data path.
- Materialized views and projections remain semantically distinct in the reviewed mechanism corpus.
- System view remains at or below 220 draw calls.
- The app recovers from a WebGL context-loss signal.
- Reduced motion preserves the same meaning.
- Type checks, unit tests, dependency audit, production build, and current Playwright suite pass.

## Explicit boundaries

- The manual v1 experience focuses on MergeTree and its highest-value gotchas.
- Other families and system mechanisms remain addressable by reviewed WebMCP journeys; they are not presented as a permanent manual grid.
- No exhaustive settings catalog, built-in chat, cluster connection, SQL runner, crawler, accounts, or backend.
- No external 3D models, runtime shaders, or unreviewed user assets.
- The tree is an original supporting landmark, not an ICQR copy and not the data model itself.
