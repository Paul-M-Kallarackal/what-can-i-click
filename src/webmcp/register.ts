import { z } from "zod";
import { COMPANY_EVIDENCE, searchEvidence } from "../data/evidence";
import { COMPANY_ARCHITECTURE_RECIPES, companyArchitectureRecipeById, declaredRecipeReadStrategy } from "../data/companyArchitectureRecipes";
import { COMPANY_IMPLEMENTATIONS, companyImplementationById, matchCompanyImplementations, type CompanyImplementation } from "../data/companyImplementations";
import { DISTRICTS, MECHANISMS, mechanismById, searchMechanisms } from "../data/mechanisms";
import { LATEST_READ_STRATEGIES, MERGE_FAMILIES, mergeFamilyById, mergeFamilySupportsReadStrategy } from "../data/mergeFamilies";
import { OPERATIONAL_SCENARIOS, OPERATIONAL_SCENARIO_IDS, operationalScenarioById } from "../data/operationalScenarios";
import { nearestUseCaseJourney } from "../data/useCaseJourneys";
import { recommendArchitecture, workloadProfileSchema } from "../lib/advisor";
import { useAtlasStore } from "../store/useAtlasStore";
import type { ArchitectureRecommendation, LatestReadStrategy, MechanismId, MergeFamilyId, ScenarioMode } from "../types";

type JsonSchema = Record<string, unknown>;

export type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<unknown>;
};

type ModelContext = { registerTool: (tool: ToolDefinition, options?: { signal?: AbortSignal }) => Promise<void> | void };

declare global { interface Document { modelContext?: ModelContext } }

const mechanismValues = MECHANISMS.map((entry) => entry.id) as [MechanismId, ...MechanismId[]];
const mechanismSchema = z.enum(mechanismValues);
const mechanismJsonSchema = { enum: mechanismValues };
const mergeFamilyValues = MERGE_FAMILIES.map((entry) => entry.id) as [MergeFamilyId, ...MergeFamilyId[]];
const mergeFamilySchema = z.enum(mergeFamilyValues);
const mergeFamilyJsonSchema = { enum: mergeFamilyValues };
const latestReadValues = LATEST_READ_STRATEGIES.map((entry) => entry.id) as [LatestReadStrategy, ...LatestReadStrategy[]];
const latestReadSchema = z.enum(latestReadValues);
const implementationValues = COMPANY_IMPLEMENTATIONS.map((entry) => entry.id) as [string, ...string[]];
const implementationSchema = z.enum(implementationValues);
const implementationJsonSchema = { enum: implementationValues };
const operationalScenarioSchema = z.enum(OPERATIONAL_SCENARIO_IDS);
const operationalScenarioJsonSchema = { enum: OPERATIONAL_SCENARIO_IDS };
const emptySchema = { type: "object", additionalProperties: false };

const workloadJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["workload", "ingestRate", "latencyTarget", "retention", "updates", "availability", "topology", "costPriority"],
  properties: {
    workload: { enum: ["observability", "product-analytics", "cdc", "iot", "financial", "general"] },
    ingestRate: { enum: ["low", "medium", "high", "extreme"] },
    latencyTarget: { enum: ["interactive", "seconds", "minutes", "batch"] },
    retention: { enum: ["days", "months", "years"] },
    updates: { enum: ["append-only", "occasional", "frequent"] },
    availability: { enum: ["standard", "high"] },
    topology: { enum: ["single-region", "multi-region"] },
    costPriority: { enum: ["performance", "balanced", "cost"] },
    accelerationGoal: {
      enum: ["repeated-aggregation", "transform-or-route", "alternate-order", "transparent-acceleration", "none"],
      description: "Optional bounded intent for choosing an incremental materialized view, a projection, or no derived path.",
    },
  },
};

function mechanismSummary(id: MechanismId) {
  const mechanism = mechanismById(id);
  if (!mechanism) return null;
  return {
    id: mechanism.id,
    districtId: mechanism.districtId,
    title: mechanism.title,
    tagline: mechanism.tagline,
    tempo: mechanism.tempo,
    states: mechanism.states,
    misconception: mechanism.misconception,
    tradeoffs: mechanism.tradeoffs,
    claims: mechanism.claims.map((claim) => ({ text: claim.text, kind: claim.kind, version: claim.version, source: claim.source })),
  };
}

function mergeFamilySummary(id: MergeFamilyId) {
  const family = mergeFamilyById(id);
  return {
    id: family.id,
    title: family.title,
    analogy: family.analogy,
    useWhen: family.useWhen,
    caution: family.caution,
    behavior: family.behavior,
    source: family.source,
    ...(id === "summing" ? {
      exactReadContract: {
        storage: "A background merge may pre-sum equal-key rows inside one resulting part while the same key remains in other parts.",
        query: "Aggregate every visible row with the appropriate SUM and GROUP BY for an exact result.",
        demonstration: { partA: 5, partB: 7, storedPartial: 12, recentPart: 4, exactTotal: 16 },
      },
    } : {}),
    ...(id === "aggregating" ? {
      aggregateStateContract: {
        storage: "AggregateFunction columns retain mergeable state; a background merge combines states with the same sorting key inside one resulting part.",
        query: "Read with GROUP BY and the matching -Merge aggregate to finalize a scalar.",
        demonstration: { partA: { sum: 20, count: 2 }, partB: { sum: 90, count: 3 }, mergedState: { sum: 110, count: 5 }, finalizedAverage: 22 },
      },
    } : {}),
    ...(id === "collapsing" ? {
      collapsingContract: {
        producer: "Emit the old state with Sign=+1, an exact cancel copy with Sign=-1, then the replacement with Sign=+1.",
        storage: "A later background merge may remove the matched old-state and cancel pair; an unmatched row survives.",
        query: "Before convergence, aggregate metrics with Sign and GROUP BY/HAVING, or use FINAL only for bounded row extraction.",
        demonstration: {
          oldState: { pageViews: 5, durationSeconds: 146, sign: 1 },
          cancel: { pageViews: 5, durationSeconds: 146, sign: -1 },
          replacement: { pageViews: 6, durationSeconds: 185, sign: 1 },
          exactResult: { pageViews: 6, durationSeconds: 185 },
        },
      },
    } : {}),
    ...(id === "versioned-collapsing" ? {
      versionedCollapsingContract: {
        pairing: "Rows collapse only when sorting key and version match and Sign is opposite; arrival order does not choose the pair.",
        producer: "The cancel row must copy the canceled state and carry its exact version with Sign=-1; the replacement uses a new version with Sign=+1.",
        query: "Before convergence, use sign-aware aggregation grouped by key and version; reserve FINAL for bounded row extraction.",
        demonstration: {
          arrivalOrder: ["v2-state", "v1-cancel", "v1-state"],
          collapsedPair: ["v1-state", "v1-cancel"],
          survivor: "v2-state",
        },
      },
    } : {}),
  };
}

function implementationSummary(implementation: CompanyImplementation) {
  const recipe = companyArchitectureRecipeById(implementation.id);
  return {
    id: implementation.id,
    company: implementation.company,
    workload: implementation.workload,
    deployment: implementation.deployment,
    pattern: implementation.implementation,
    publishedScale: implementation.scale.slice(0, 2),
    result: implementation.outcome,
    tradeoff: implementation.tradeoff,
    version: implementation.version,
    declaredFamilies: implementation.mergeFamilyIds,
    declaredMechanisms: implementation.mechanisms.slice(0, 8),
    mechanismPath: recipe?.mechanismPath ?? [],
    architectureSteps: recipe?.steps.slice(0, 8).map((step) => ({ role: step.role, mechanismId: step.mechanismId, title: step.label, rationale: step.rationale })) ?? [],
    source: implementation.source,
  };
}

function scenarioAvoidanceSummary(scenarioId: ScenarioMode, recommendation?: ArchitectureRecommendation | null) {
  const scenario = operationalScenarioById(scenarioId);
  const decision = scenario.primaryMechanismId
    ? recommendation?.decisions.find((entry) => entry.mechanismId === scenario.primaryMechanismId)
    : undefined;
  return {
    personalized: Boolean(decision),
    recommendation: decision?.recommendation ?? scenario.lesson,
    rationale: decision?.rationale ?? scenario.description,
    alternatives: decision?.alternatives.slice(0, 3) ?? [],
    evidenceIds: decision?.evidenceIds.slice(0, 4) ?? [],
  };
}

export function createToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: "describe_clickhouse_world",
      title: "Describe the interactive ClickHouse foundry",
      description: `Return seven MergeTree family machines, ${DISTRICTS.length} ClickHouse system chambers, ${MECHANISMS.length} inspectable mechanisms, reviewed company architecture recipes, operational scenarios, semantic states, and the safe interaction model.`,
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async (input) => {
        z.object({}).strict().parse(input);
        return {
          title: "What can I Click",
          claimVersion: "ClickHouse 26.3 LTS",
          chambers: DISTRICTS.map((district) => ({ id: district.id, title: district.title, description: district.description, mechanismIds: district.mechanismIds })),
          mechanisms: MECHANISMS.map((entry) => ({ id: entry.id, districtId: entry.districtId, title: entry.title, tempo: entry.tempo, states: entry.states })),
          mergeTreeFamilies: MERGE_FAMILIES.map((entry) => mergeFamilySummary(entry.id)),
          latestReadStrategies: LATEST_READ_STRATEGIES,
          evidenceCorpus: {
            stories: COMPANY_EVIDENCE.length,
            implementationAccounts: COMPANY_IMPLEMENTATIONS.length,
            architectureRecipes: COMPANY_ARCHITECTURE_RECIPES.length,
          },
          views: ["system", "mechanism", "xray"],
          scenarios: OPERATIONAL_SCENARIOS.filter((scenario) => scenario.id !== "pressure").map((scenario) => ({
            id: scenario.id,
            title: scenario.title,
            setting: scenario.setting,
            settingValue: scenario.settingValue,
            primaryMechanismId: scenario.primaryMechanismId,
            affectedMechanismIds: scenario.affectedMechanismIds,
          })),
        };
      },
    },
    {
      name: "recommend_clickhouse_architecture",
      title: "Recommend a ClickHouse architecture",
      description: "Create and stage an evidence-backed mechanism path from a bounded workload. Never send credentials, raw schemas, SQL, query results, or secrets.",
      inputSchema: workloadJsonSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input, options) => {
        if (options?.signal?.aborted) throw options.signal.reason;
        const profile = workloadProfileSchema.parse(input);
        const recommendation = recommendArchitecture(profile);
        const journey = nearestUseCaseJourney(profile);
        const mergeFamilyRecommendation = { familyId: journey.familyId, latestReadStrategy: journey.strategy.latestRead ?? "background" as LatestReadStrategy, reason: journey.strategy.rationale };
        useAtlasStore.getState().setRecommendation(recommendation);
        useAtlasStore.getState().setMergeFamily(journey.familyId);
        useAtlasStore.getState().setLatestReadStrategy(mergeFamilyRecommendation.latestReadStrategy);
        useAtlasStore.getState().startJourney(journey.id);
        return { ...recommendation, mergeFamilyRecommendation: { ...mergeFamilyRecommendation, family: mergeFamilySummary(mergeFamilyRecommendation.familyId) }, journey: { id: journey.id, title: journey.title, agentLog: journey.agentLog, guidePath: journey.guidePath, tradeoff: journey.tradeoff } };
      },
    },
    {
      name: "play_architecture_story",
      title: "Play the recommended architecture",
      description: "Animate the latest recommendation or one reviewed company's declared architecture through its exact mechanism path.",
      inputSchema: { type: "object", additionalProperties: false, properties: { scenario: operationalScenarioJsonSchema, implementationId: implementationJsonSchema } },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        const { scenario, implementationId } = z.object({ scenario: operationalScenarioSchema.optional(), implementationId: implementationSchema.optional() }).strict().parse(input);
        if (implementationId) {
          const implementation = companyImplementationById(implementationId)!;
          const recipe = companyArchitectureRecipeById(implementationId)!;
          if (recipe.mechanismPath.length === 0) return { ok: false, message: `${implementation.company} does not disclose enough mapped internals for a visual story.`, declaredMechanisms: recipe.declaredItems };
          const family = recipe.mergeFamilyIds[0];
          if (family) useAtlasStore.getState().setMergeFamily(family);
          useAtlasStore.getState().setLatestReadStrategy(declaredRecipeReadStrategy(recipe));
          useAtlasStore.getState().playStory("architecture", recipe.mechanismPath);
          const scenarioId = scenario ?? "healthy";
          useAtlasStore.getState().setScenario(scenarioId);
          return { ok: true, scenario: operationalScenarioById(scenarioId), avoidance: scenarioAvoidanceSummary(scenarioId), story: "company-architecture", implementation: implementationSummary(implementation) };
        }
        const recommendation = useAtlasStore.getState().recommendation;
        if (!recommendation) return { ok: false, message: "Create a recommendation first." };
        useAtlasStore.getState().playStory("architecture", recommendation.path);
        const scenarioId = scenario ?? "healthy";
        useAtlasStore.getState().setScenario(scenarioId);
        return { ok: true, scenario: operationalScenarioById(scenarioId), avoidance: scenarioAvoidanceSummary(scenarioId, recommendation), path: recommendation.path, summary: recommendation.summary };
      },
    },
    {
      name: "inspect_clickhouse_mechanism",
      title: "Inspect a ClickHouse mechanism",
      description: "Focus a reviewed system mechanism or MergeTree family machine. Supported families can also select a bounded background, argMax, or FINAL read contract.",
      inputSchema: { type: "object", additionalProperties: false, anyOf: [{ required: ["mechanismId"] }, { required: ["mergeFamilyId"] }], properties: { mechanismId: mechanismJsonSchema, mergeFamilyId: mergeFamilyJsonSchema, latestReadStrategy: { enum: latestReadValues }, view: { enum: ["mechanism", "xray"] } } },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        const args = z.object({ mechanismId: mechanismSchema.optional(), mergeFamilyId: mergeFamilySchema.optional(), latestReadStrategy: latestReadSchema.optional(), view: z.enum(["mechanism", "xray"]).optional() }).strict().superRefine((value, context) => {
          if (Boolean(value.mechanismId) === Boolean(value.mergeFamilyId)) context.addIssue({ code: "custom", message: "Provide exactly one of mechanismId or mergeFamilyId." });
          if (value.latestReadStrategy && !value.mergeFamilyId) context.addIssue({ code: "custom", message: "latestReadStrategy is only valid with mergeFamilyId." });
          if (value.mergeFamilyId && value.latestReadStrategy && !mergeFamilySupportsReadStrategy(value.mergeFamilyId, value.latestReadStrategy)) {
            context.addIssue({ code: "custom", message: `${value.latestReadStrategy} is not a reviewed read contract for ${value.mergeFamilyId}.` });
          }
        }).parse(input);
        if (args.mergeFamilyId) {
          const resolvedStrategy = args.latestReadStrategy ?? "background";
          const store = useAtlasStore.getState();
          store.stopJourney();
          store.setScenario("healthy");
          store.setMergeFamily(args.mergeFamilyId);
          store.setLatestReadStrategy(resolvedStrategy);
          return { ok: true, view: "family-machine", family: mergeFamilySummary(args.mergeFamilyId), latestReadStrategy: resolvedStrategy };
        }
        useAtlasStore.getState().selectMechanism(args.mechanismId!, args.view ?? "mechanism");
        return { ok: true, view: args.view ?? "mechanism", mechanism: mechanismSummary(args.mechanismId!) };
      },
    },
    {
      name: "compare_clickhouse_methods",
      title: "Compare ClickHouse methods",
      description: "Align two reviewed mechanisms, compare argMax with SELECT FINAL, compare incremental materialized views with projections, or open two reviewed production implementations side by side.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        anyOf: [
          { required: ["firstId", "secondId"] },
          { required: ["comparison"] },
          { required: ["firstImplementationId", "secondImplementationId"] },
        ],
        properties: {
          firstId: mechanismJsonSchema,
          secondId: mechanismJsonSchema,
          comparison: { enum: ["argmax-vs-final", "materialized-view-vs-projection"] },
          firstImplementationId: implementationJsonSchema,
          secondImplementationId: implementationJsonSchema,
        },
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        const args = z.object({
          firstId: mechanismSchema.optional(),
          secondId: mechanismSchema.optional(),
          comparison: z.enum(["argmax-vs-final", "materialized-view-vs-projection"]).optional(),
          firstImplementationId: implementationSchema.optional(),
          secondImplementationId: implementationSchema.optional(),
        }).strict().superRefine((value, context) => {
          const hasMechanismPair = Boolean(value.firstId && value.secondId);
          const hasImplementationPair = Boolean(value.firstImplementationId && value.secondImplementationId);
          if (Boolean(value.firstId) !== Boolean(value.secondId)) context.addIssue({ code: "custom", message: "Provide both mechanism IDs." });
          if (Boolean(value.firstImplementationId) !== Boolean(value.secondImplementationId)) context.addIssue({ code: "custom", message: "Provide both implementation IDs." });
          if (Number(hasMechanismPair) + Number(hasImplementationPair) + Number(Boolean(value.comparison)) !== 1) {
            context.addIssue({ code: "custom", message: "Provide exactly one comparison mode." });
          }
        }).parse(input);
        if (args.firstImplementationId && args.secondImplementationId) {
          if (args.firstImplementationId === args.secondImplementationId) return { ok: false, message: "Choose two different production implementations." };
          const first = companyImplementationById(args.firstImplementationId)!;
          const second = companyImplementationById(args.secondImplementationId)!;
          useAtlasStore.getState().selectEvidence(first.id);
          useAtlasStore.getState().setEvidenceComparison(second.id);
          return {
            ok: true,
            comparison: "production-implementations",
            first: implementationSummary(first),
            second: implementationSummary(second),
            declaredOverlap: {
              families: first.mergeFamilyIds.filter((familyId) => second.mergeFamilyIds.includes(familyId)),
              mechanisms: first.mechanisms.filter((mechanism) => second.mechanisms.includes(mechanism)),
              sameWorkload: first.workload === second.workload,
            },
          };
        }
        if (args.comparison) {
          const store = useAtlasStore.getState();
          store.stopJourney();
          store.setScenario("healthy");
          if (args.comparison === "argmax-vs-final") {
            store.setMergeFamily("replacing");
            store.setLatestReadStrategy("argmax");
            store.setLatestReadComparison(args.comparison);
            return { ok: true, comparison: args.comparison, view: "latest-state-comparison", family: mergeFamilySummary("replacing"), methods: LATEST_READ_STRATEGIES.filter((entry) => entry.id === "argmax" || entry.id === "final") };
          }
          store.selectMechanism("precompute.materialized-view");
          store.setComparison("precompute.materialized-view", "precompute.projection");
          return {
            ok: true,
            comparison: args.comparison,
            view: "derived-data-comparison",
            materializedView: mechanismSummary("precompute.materialized-view"),
            projection: mechanismSummary("precompute.projection"),
            decisionInputs: {
              materializedView: ["repeated-aggregation", "transform-or-route"],
              projection: ["alternate-order", "transparent-acceleration"],
            },
          };
        }
        if (args.firstId === args.secondId) return { ok: false, message: "Choose two different mechanisms." };
        useAtlasStore.getState().selectMechanism(args.firstId!);
        useAtlasStore.getState().setComparison(args.firstId!, args.secondId!);
        return { ok: true, first: mechanismSummary(args.firstId!), second: mechanismSummary(args.secondId!) };
      },
    },
    {
      name: "search_clickhouse_evidence",
      title: "Search reviewed ClickHouse evidence",
      description: `Search ${MECHANISMS.length} reviewed mechanisms, the original ten-story set, and ${COMPANY_IMPLEMENTATIONS.length} primary-source company implementation accounts. Results are bounded and versions are never inferred.`,
      inputSchema: { type: "object", additionalProperties: false, required: ["query"], properties: { query: { type: "string", minLength: 2, maxLength: 80 } } },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => {
        const { query } = z.object({ query: z.string().trim().min(2).max(80) }).strict().parse(input);
        return {
          corpus: {
            mechanisms: MECHANISMS.length,
            stories: COMPANY_EVIDENCE.length,
            implementationAccounts: COMPANY_IMPLEMENTATIONS.length,
            architectureRecipes: COMPANY_ARCHITECTURE_RECIPES.length,
          },
          mechanisms: searchMechanisms(query).slice(0, 12).map((entry) => ({ id: entry.id, districtId: entry.districtId, title: entry.title, tagline: entry.tagline, tempo: entry.tempo })),
          mergeTreeFamilies: MERGE_FAMILIES.filter((entry) => `${entry.title} ${entry.shortTitle} ${entry.analogy} ${entry.useWhen}`.toLowerCase().includes(query.toLowerCase())).slice(0, 7).map((entry) => mergeFamilySummary(entry.id)),
          stories: searchEvidence(query).slice(0, 10).map((entry) => ({ id: entry.id, company: entry.company, workload: entry.workload, challenge: entry.challenge, outcome: entry.outcome, version: entry.version, source: entry.source })),
          implementations: matchCompanyImplementations({ query }, 6).map(({ implementation, matchedOn }) => ({ ...implementationSummary(implementation), challenge: implementation.challenge, matchedOn })),
        };
      },
    },
    {
      name: "reset_clickhouse_world",
      title: "Reset the ClickHouse foundry",
      description: "Stop the story, clear recommendations and comparisons, and return the camera, scenario, and inspector to system view.",
      inputSchema: emptySchema,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        z.object({}).strict().parse(input);
        useAtlasStore.getState().reset();
        return { ok: true, chambers: DISTRICTS.length, mechanisms: MECHANISMS.length, stories: COMPANY_EVIDENCE.length };
      },
    },
  ];
}

export function registerWebMcpTools() {
  if (!document.modelContext) {
    document.documentElement.dataset.webmcp = "unavailable";
    return () => undefined;
  }
  document.documentElement.dataset.webmcp = "available";
  const controller = new AbortController();
  for (const tool of createToolDefinitions()) {
    Promise.resolve(document.modelContext.registerTool(tool, { signal: controller.signal })).catch((error) => {
      if (!controller.signal.aborted) console.warn(`WebMCP tool ${tool.name} was not registered.`, error);
    });
  }
  return () => controller.abort();
}
