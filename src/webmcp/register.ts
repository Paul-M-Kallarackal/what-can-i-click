import { z } from "zod";
import { COMPANY_EVIDENCE, searchEvidence } from "../data/evidence";
import { KNOWLEDGE_NODES, knowledgeById, searchKnowledge } from "../data/knowledge";
import { recommendArchitecture, workloadProfileSchema } from "../lib/advisor";
import { useAtlasStore } from "../store/useAtlasStore";
import type { DistrictId } from "../types";

type JsonSchema = Record<string, unknown>;

export type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<unknown>;
};

type ModelContext = {
  registerTool: (tool: ToolDefinition, options?: { signal?: AbortSignal }) => Promise<void> | void;
};

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

const districtSchema = z.enum(["ingestion", "mergetree", "read-path", "aggregation", "architecture", "retention"]);
const emptySchema = { type: "object", additionalProperties: false };
const districtJsonSchema = { enum: ["ingestion", "mergetree", "read-path", "aggregation", "architecture", "retention"] };

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
  },
};

function nodeSummary(id: DistrictId) {
  const node = knowledgeById(id);
  if (!node) return null;
  return {
    id: node.id,
    title: node.title,
    tagline: node.tagline,
    tempo: node.motion.tempo,
    metaphor: node.motion.metaphor,
    tradeoffs: node.tradeoffs,
    claims: node.claims.map((claim) => ({ text: claim.text, kind: claim.kind, version: claim.version, source: claim.source })),
  };
}

export function createToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: "describe_clickhouse_world",
      title: "Describe the ClickHouse bonsai world",
      description: "Return the six major ClickHouse mechanisms represented in the visible world and the safe interaction model.",
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async (input) => {
        z.object({}).strict().parse(input);
        return {
          title: "What can I Click",
          claimVersion: "ClickHouse 26.3 LTS",
          mechanisms: KNOWLEDGE_NODES.map((node) => ({ id: node.id, title: node.title, tempo: node.motion.tempo, tagline: node.tagline })),
          guidance: "Call recommend_clickhouse_architecture with a bounded workload profile, then play_architecture_story to guide the visible world.",
        };
      },
    },
    {
      name: "recommend_clickhouse_architecture",
      title: "Recommend a ClickHouse architecture",
      description: "Create an evidence-backed architecture path from a bounded workload profile and stage it in the visible bonsai world. Do not send credentials, query results, raw schemas, arbitrary SQL, or secrets.",
      inputSchema: workloadJsonSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input, options) => {
        if (options?.signal?.aborted) throw options.signal.reason;
        const profile = workloadProfileSchema.parse(input);
        const recommendation = recommendArchitecture(profile);
        useAtlasStore.getState().setRecommendation(recommendation);
        return recommendation;
      },
    },
    {
      name: "play_architecture_story",
      title: "Play the recommended architecture",
      description: "Animate the most recent recommendation through the visible world, focusing each selected mechanism in order.",
      inputSchema: emptySchema,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        z.object({}).strict().parse(input);
        const recommendation = useAtlasStore.getState().recommendation;
        if (!recommendation) return { ok: false, message: "Create a recommendation first." };
        useAtlasStore.getState().playStory("architecture", recommendation.path);
        return { ok: true, path: recommendation.path, summary: recommendation.summary };
      },
    },
    {
      name: "inspect_clickhouse_mechanism",
      title: "Inspect a ClickHouse mechanism",
      description: "Focus one of the six visible mechanisms and open its sourced explanation, animation metaphor, and tradeoffs.",
      inputSchema: { type: "object", additionalProperties: false, required: ["mechanismId"], properties: { mechanismId: districtJsonSchema } },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        const args = z.object({ mechanismId: districtSchema }).strict().parse(input);
        useAtlasStore.getState().selectNode(args.mechanismId);
        return { ok: true, mechanism: nodeSummary(args.mechanismId) };
      },
    },
    {
      name: "compare_clickhouse_methods",
      title: "Compare ClickHouse methods",
      description: "Compare any two major mechanisms using only the reviewed atlas claims and explicit tradeoffs.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["firstId", "secondId"],
        properties: { firstId: districtJsonSchema, secondId: districtJsonSchema },
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async (input) => {
        const args = z.object({ firstId: districtSchema, secondId: districtSchema }).strict().parse(input);
        if (args.firstId === args.secondId) return { ok: false, message: "Choose two different mechanisms." };
        return { ok: true, first: nodeSummary(args.firstId), second: nodeSummary(args.secondId) };
      },
    },
    {
      name: "search_clickhouse_evidence",
      title: "Search reviewed ClickHouse evidence",
      description: "Search the six official mechanism summaries and ten reviewed company stories. Results are bounded and versions are never inferred.",
      inputSchema: { type: "object", additionalProperties: false, required: ["query"], properties: { query: { type: "string", minLength: 2, maxLength: 80 } } },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => {
        const { query } = z.object({ query: z.string().trim().min(2).max(80) }).strict().parse(input);
        return {
          mechanisms: searchKnowledge(query).slice(0, 6).map((node) => ({ id: node.id, title: node.title, tagline: node.tagline })),
          stories: searchEvidence(query).slice(0, 10).map((entry) => ({ id: entry.id, company: entry.company, workload: entry.workload, challenge: entry.challenge, outcome: entry.outcome, version: entry.version, source: entry.source })),
        };
      },
    },
    {
      name: "reset_clickhouse_world",
      title: "Reset the ClickHouse world",
      description: "Stop the current story, clear the recommendation and inspector, and return the camera emphasis to the complete atlas.",
      inputSchema: emptySchema,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        z.object({}).strict().parse(input);
        useAtlasStore.getState().reset();
        return { ok: true, mechanisms: KNOWLEDGE_NODES.length, stories: COMPANY_EVIDENCE.length };
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

