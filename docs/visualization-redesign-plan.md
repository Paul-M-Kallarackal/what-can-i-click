# What can I Click — Visualization Redesign

## Decision

Remove the bonsai archipelago completely. The next version is a transparent, kinetic **ClickHouse data machine**: one continuous system assembled from six mechanism-specific chambers. The visitor should feel as if the ClickHouse logo has opened into a museum cutaway and exposed the path from arriving rows to retained or expired data.

This is not a reskin. The pot, trunk, foliage, island, root-connection, spore, and nature-critter components will be deleted. The advisor, evidence corpus, WebMCP boundary, and renderer-independent clock remain useful and will be migrated to a more granular mechanism registry.

## Product thesis

The screen has one job: **make the recommended ClickHouse architecture visibly explain itself.** A user should understand within ninety seconds where work happens, whether it is immediate, streaming, background, heavy, or blocking, and what becomes stressed when a choice is wrong.

## Signature experience: the ClickHouse cutaway

Four yellow columns—an original three-dimensional interpretation of the ClickHouse mark rather than a modified logo asset—separate like instrument housings and reveal a continuous data line running through six chambers. Each chamber has a different silhouette because each mechanism does different work.

Selection has three zoom levels:

1. **System view** — all six chambers and the end-to-end route.
2. **Mechanism view** — one chamber fills the stage and exposes controls, states, and tradeoffs.
3. **X-ray view** — a part, granule, projection, replica, or TTL action opens to show its internal structure.

Rows are short yellow bars, columns are vertical bands, parts are sealed transparent cassettes, index marks are black notches, background work is amber, query work is cyan-white, coordination is violet, and destructive or pressured states are vermilion.

## Complete visualization inventory

“All mechanisms” means every major concept promised by the hackathon scope below. It does not mean every ClickHouse setting or table engine.

### 1. Ingestion chamber — the arrival manifold

| Mechanism | Visualization | Visible transition | Lesson |
| --- | --- | --- | --- |
| Client batching | Row bars collect in a measuring hopper and lock into a cassette | Loose rows → threshold → sealed batch | Larger, less frequent inserts reduce per-insert overhead |
| Asynchronous inserts | Client tubes feed a transparent shared buffer with size and timeout gauges | Concurrent trickles → buffer → flush → acknowledgement | Server buffering helps clients that cannot coordinate batches |
| Kafka/ClickPipes | A braided conveyor carries ordered envelopes through a checkpoint wheel | Offset advances, batch commits, checkpoint follows | Managed streaming owns connector, offset, and retry work |
| CDC changes | Insert, update, and delete envelopes use distinct edge markings on one append path | Source log event → row version → table input | CDC is append-oriented before it is deduplication-oriented |
| Backpressure | The manifold narrows and a pressure membrane expands | Arrival outruns flush → queue rises → controlled throttle | Buffers move pressure; they do not remove it |

Healthy mode shows full cassettes at a calm cadence. Pressure mode sends single-row cassettes toward the part chamber until the lane crowds.

### 2. MergeTree chamber — the part foundry

| Mechanism | Visualization | Visible transition | Lesson |
| --- | --- | --- | --- |
| Immutable part | A cassette splits into column bands, marks, index strip, checksums, and metadata | Insert block → sorted self-contained part | A part is a structured immutable unit |
| Partition boundary | Parts land in separated foundry bays | Same-bay parts can merge; cross-bay parts cannot | Partitioning controls lifecycle and merge eligibility |
| Merge selection | A scheduler arm weighs size, age, and compatibility | Scan → compatible set → queued merge | Merges are resource-governed background work |
| Sorted merge pass | Two row ribbons interleave through a zipper into a larger cassette | Source parts → linear merge → replacement | Sorted parts avoid random updates and re-sorting |
| Active/inactive lifecycle | Sources turn translucent after commit and leave after readers release them | Active → inactive/referenced → removed | Cleanup follows atomic replacement |
| Too-many-parts pressure | Small cassettes pile up faster than the arm consumes them | Queue, metadata markers, and pressure rise | Tiny inserts can outpace consolidation |
| Forced large merge | A manual override bypasses the gauge and pulls oversized cassettes | Safeguard bypass → I/O spike → other lanes slow | `OPTIMIZE ... FINAL` is not routine maintenance |

This is the visual centerpiece. Its X-ray part cutaway is the most detailed object in the product.

### 3. Read chamber — the query scanner

| Mechanism | Visualization | Visible transition | Lesson |
| --- | --- | --- | --- |
| Physical ordering | Rows lie along an ORDER BY rail | Unsorted ghost disappears; contiguous bands remain | Ordering creates locality before queries arrive |
| Sparse index | A thin notch rail sits above thousands of row bars | Predicate lands between marks; a range is chosen | The primary index represents granules, not rows |
| Granules and marks | A selected part opens into row blocks with mark pins | Whole granules dim when they cannot match | Reads happen at granule resolution |
| Column pruning | Unrequested vertical bands stay locked while selected columns lift | Selected columns enter the scanner | Columnar storage avoids unrelated I/O |
| Data skipping | Secondary gates test remaining granules | Candidate → test → read or discard | Skip indexes are workload-specific filters |
| Parallel pipeline | Selected bands divide across synchronized lanes and reconverge | Read → filter → aggregate → result | Fast scans consume CPU and memory through parallelism |
| Saved work | Rejected ranges remain as desaturated wireframes | Large total volume → small read volume | Speed comes from avoiding work |

The visitor can scrub one query from predicate to result. Skipped regions stay visible so the saved work is legible.

### 4. Precomputation chamber — the derived-data switchyard

| Mechanism | Visualization | Visible transition | Lesson |
| --- | --- | --- | --- |
| Incremental materialized view | Each block passes a transform press and emits a target-table cassette | Insert block → transform → target part | Repeated computation moves to insert time |
| Aggregate states | Thousands of bars collapse into mergeable state cells | Raw rows → partial → merged → finalized | States preserve composability across parts |
| Projection | A base cassette reveals a folded alternate arrangement inside it | Source data → maintained alternate representation | Projections add storage inside the table lifecycle |
| Optimizer choice | A rail switch compares base and projection work | Candidate paths glow → selected route opens | Queries still target the base table |
| Write amplification | Each derived track adds resistance to the ingestion flywheel | More derived data → larger effort dial | Faster reads cost write work and storage |

The materialized-view and projection animations must never look interchangeable: one writes a target track; the other reveals a maintained alternate representation.

### 5. Architecture chamber — the cluster switchboard

| Mechanism | Visualization | Visible transition | Lesson |
| --- | --- | --- | --- |
| Sharding | A routing prism divides rows across compute modules | Shard key → route → destination | Sharding divides data and work |
| Distributed query | A pulse fans out and partial results gather | Coordinator → shards → combined result | Scale-out reads add network and coordination work |
| Replication | Each shard has a mirror; parts cross a replication bridge | New part → queue → replica caught up | Replication duplicates data for resilience |
| Keeper | A separate three-node quorum ring exchanges small violet pulses | Proposal → majority → coordinated state | Keeper coordinates metadata; data does not flow through it |
| Failure | One mirror goes dark while reads reroute and lag appears | Failure → traffic moves → reduced redundancy | Replicas improve availability but add operations |
| Recovery | A returning replica compares its queue and fetches parts | Restart → catch-up → healthy pair | Recovery costs bandwidth and time |
| Multi-region | Region frames make long links visibly slower without false timing | Local path versus cross-region path | Geography adds latency and consistency tradeoffs |

Users may trigger one bounded failure scenario. Keeper remains physically separate from data routes to prevent a common misconception.

### 6. Retention chamber — the time and rewrite vault

| Mechanism | Visualization | Visible transition | Lesson |
| --- | --- | --- | --- |
| TTL delete | Parts age along a rail and fall through a guarded disposal gate | Threshold → eligible → background removal | TTL cleanup is asynchronous |
| TTL move | An elevator transfers parts from hot to cold storage | Hot → policy threshold → cold | Retention can change storage class |
| TTL recompress | A press reduces cassette thickness while resource meters rise | Old codec → rewrite → denser part | Storage savings spend background resources |
| TTL aggregation | Detailed bars collapse into coarse time buckets | Detail → rollup states → historical part | Long retention can exchange detail for cost |
| Heavy mutation | An orange gantry reads and rewrites an affected cassette | Queue → rewrite → replacement | Traditional mutations rewrite parts |
| Backup | A gantry captures immutable objects and seals a manifest | Snapshot → object capture → manifest | Backups are not replicas |
| Restore | A ghost target fills and validates before activation | Empty → restore → integrity check → active | Restore verification makes backups useful |

Pressure mode shows TTL, merges, and mutations competing for one background-resource meter.

## Two cinematics

### One block becomes one answer

Rows arrive, the async buffer forms a batch, the foundry creates and opens a part, background work merges it, a query uses sparse marks to skip ranges, only requested columns and granules enter parallel lanes, a justified precomputation returns an answer, and the part eventually enters a TTL route.

### An architecture survives failure

The advisor's chosen path illuminates; shard routing divides data; replicas receive parts while Keeper coordinates metadata separately; one replica fails; reads continue through its partner; the replica returns, fetches missing parts, and converges; the story ends on storage, network, and operational tradeoffs.

The camera never teleports during a story. A continuous yellow data ribbon pulls it through the system.

## Interaction model

- Click a chamber to focus it; click a labeled component to enter X-ray view.
- Pause, step one semantic event, scrub, or run at 0.25×–4×.
- Toggle **Healthy / Pressure** to reveal bounded failure modes.
- Toggle **Show saved work** to reveal bytes, granules, or routes ClickHouse avoided.
- Compare two mechanisms with aligned event timelines.
- Escape moves up one zoom level; keyboard and camera focus stay synchronized.
- Mobile uses a two-snap bottom sheet and never hides the active mechanism behind it.

## Visual direction

The world is a museum-grade industrial cutaway: technical ceramic floors, smoked-polycarbonate housings, anodized black mechanisms, brushed metal tracks, and illuminated yellow data. Transparent surfaces exist only to reveal internals.

| Token | Value | Purpose |
| --- | --- | --- |
| Mineral | `#D8D8D0` | atmosphere |
| Ceramic | `#F3F2EC` | stage and readable surfaces |
| Instrument black | `#15171A` | housings and primary structure |
| Click yellow | `#FFCC01` | rows and active routes |
| Query cyan | `#78D7D2` | read-path work only |
| Pressure vermilion | `#D64C3F` | overload, failure, destructive work |

Strawn remains restricted to “What can I Click.” System sans-serif carries UI text and `ui-monospace` carries part names, counters, and evidence labels.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ What can I Click        Search mechanisms                     Evidence  │
├─────────────┬───────────────────────────────────┬────────────────────────┤
│ Story path  │                                   │ Inspector              │
│ 01 Arrive   │     TRANSPARENT DATA MACHINE      │ mechanism / why        │
│ 02 Parts    │       continuous yellow route     │ states / tradeoffs     │
│ 03 Read     │                                   │ evidence               │
│ ...         │                                   │                        │
├─────────────┴───────────────────────────────────┴────────────────────────┤
│ Pause  Step  0.25× 1× 2× 4×   Healthy / Pressure   timeline             │
└──────────────────────────────────────────────────────────────────────────┘
```

## Technical architecture

Replace one `KnowledgeNode` per district with a registry addressable at mechanism level:

```ts
type MechanismSpec = {
  id: MechanismId;
  districtId: DistrictId;
  title: string;
  tempo: Tempo;
  cameraPose: CameraPose;
  states: SimulationState[];
  transitions: SemanticTransition[];
  healthyScenarioId: string;
  pressureScenarioId?: string;
  claimIds: string[];
  tradeoffs: Tradeoff[];
  reducedMotionSummary: string;
};
```

The registry drives rendering, search, inspector content, WebMCP focus, accessible narration, story paths, and tests. No feature may exist only as an unaddressable mesh.

The simulation uses semantic events rather than free-running animation phases:

```ts
type SimulationEvent = {
  at: number;
  type: "arrive" | "buffer" | "flush" | "merge" | "scan" | "replicate" | "expire";
  subjectId: string;
  fromState: string;
  toState: string;
  narration: string;
};
```

React Three Fiber interpolates between events but never owns the truth. Scrubbing, reduced motion, browser tests, and WebMCP playback share the event log.

```text
src/visualization/
  registry/        mechanisms, layouts, healthy and pressure scenarios
  engine/          deterministic clock, reducer, selectors
  scene/
    DataMachine.tsx
    DataRibbon.tsx
    chambers/      six mechanism-specific chambers
    xray/          part, granule, projection, and replica cutaways
    materials/
    effects/
  ui/              story rail, inspector, timeline, pressure toggle, text world
```

The advisor and evidence modules stay outside this directory. `BonsaiMechanism.tsx`, botanical islands, spores, root connections, and nature-specific motion types are removed after replacement parity.

## WebMCP changes

Keep the seven public tool names, but return and accept mechanism IDs rather than only district IDs. Recommendations drive camera poses, semantic events, pressure states, and the exact inspector. Tool calls never create geometry, provide shaders, fetch assets, or supply executable animation instructions.

## Accessibility and reduced motion

- Every semantic event has a synchronized text description.
- The world in words exposes the same chamber, mechanism, state, tradeoff, and evidence hierarchy.
- Keyboard users can traverse, enter X-ray view, step the timeline, and return.
- Reduced motion uses discrete before/after states and short crossfades without losing information.
- Color is reinforced by shape, fill pattern, label, and direction.
- DOM text meets WCAG 2.2 AA; active 3D components retain 3:1 local separation.

## Performance budget

- Target 50 FPS at 1440×900 on the demo laptop; minimum 30 FPS during the heaviest story.
- At most 220 visible draw calls in system view and 300 in an X-ray close-up.
- Instance rows, granules, marks, cassettes, route pulses, and cluster modules.
- At most 180 live moving instances; off-screen chambers update at 2–5 Hz or freeze.
- Cap DPR at 1.25 with adaptive reduction after sustained slow frames.
- Use one shadow-casting key light and baked contact decals for small repeated objects.
- Load no third-party runtime models, textures, shaders, or fonts.

## Build sequence

1. **Foundation and proof, days 1–2:** mechanism registry, event engine, data ribbon, camera, materials, then one complete async-buffer → part-X-ray slice.
2. **Hero chambers, days 3–4:** MergeTree foundry and query scanner; ship the block-to-answer cinematic first.
3. **Full coverage, days 5–7:** ingestion, precomputation, architecture failure/recovery, TTL, mutation, backup, and restore.
4. **Advisor choreography, day 8:** migrate recommendations and WebMCP from district paths to mechanism paths.
5. **Quality gate, days 9–10:** every mechanism, both stories, mobile, keyboard, reduced motion, evidence, draw calls, and FPS on the actual demo laptop.

## Acceptance rubric

| Dimension | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Causal clarity | Decorative or misleading | State change visible | Cause, transition, and consequence visible |
| Visual identity | Placeholder/shared silhouette | Some unique geometry | Recognizable mechanism-specific machine |
| Inspector depth | Label only | Explanation or tradeoff | State, tradeoff, misconception, and evidence |
| Interaction | Passive loop | Focus or replay | Focus, scrub, compare, and pressure state |
| Accessibility | 3D-only information | Partial text equivalent | Complete keyboard and reduced-motion equivalent |

No mechanism may ship with a zero. MergeTree and Read require 10/10; all other chambers require at least 9/10.

## Explicit cuts

- No bonsai, trees, pots, islands, roots, spores, or nature dressing.
- No exhaustive catalog of every engine, setting, index, or SQL feature.
- No arbitrary code, SQL execution, credentials, private cluster data, or external assets.
- No exact performance timing without pinned evidence and conditions.
- No crawler or unreviewed evidence ingestion.

The result should be memorable because a visitor watches ClickHouse avoid, move, and trade work—not because the scene contains more decoration.
