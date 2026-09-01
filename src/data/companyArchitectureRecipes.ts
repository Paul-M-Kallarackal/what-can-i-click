import type { LatestReadStrategy, MechanismId, MergeFamilyId, WorkloadProfile } from "../types";
import {
  COMPANY_IMPLEMENTATIONS,
  type CompanyImplementation,
  type ImplementationSource,
} from "./companyImplementations";
import { mechanismById } from "./mechanisms";

export type ArchitectureRecipeRole =
  | "ingest"
  | "store"
  | "transform"
  | "read"
  | "scale"
  | "retain";

export type CompanyArchitectureRecipeStep = {
  id: string;
  mechanismId: MechanismId;
  role: ArchitectureRecipeRole;
  label: string;
  rationale: string;
};

export type CompanyArchitectureRecipe = {
  id: string;
  companyId: string;
  company: string;
  workload: WorkloadProfile["workload"];
  deployment: string;
  mechanismPath: MechanismId[];
  steps: CompanyArchitectureRecipeStep[];
  mergeFamilyIds: MergeFamilyId[];
  /** Source-authored technology and architecture labels; never inferred from prose. */
  declaredItems: string[];
  implementation: string;
  outcome: string;
  tradeoff: string;
  scale: string[];
  version: string;
  source: ImplementationSource;
};

const roleOrder: ArchitectureRecipeRole[] = [
  "ingest",
  "store",
  "transform",
  "read",
  "scale",
  "retain",
];

function roleForMechanism(mechanismId: MechanismId): ArchitectureRecipeRole {
  const district = mechanismId.split(".")[0];
  if (district === "ingestion") return "ingest";
  if (district === "mergetree") return "store";
  if (district === "precompute") return "transform";
  if (district === "read") return "read";
  if (district === "architecture") return "scale";
  return "retain";
}

function uniqueMechanisms(ids: readonly MechanismId[]) {
  return [...new Set(ids)].sort((left, right) => {
    const roleDifference = roleOrder.indexOf(roleForMechanism(left)) - roleOrder.indexOf(roleForMechanism(right));
    return roleDifference || left.localeCompare(right);
  });
}

function recipeForImplementation(implementation: CompanyImplementation): CompanyArchitectureRecipe {
  const mechanismPath = uniqueMechanisms(implementation.relatedMechanismIds);
  return {
    id: `recipe:${implementation.id}`,
    companyId: implementation.id,
    company: implementation.company,
    workload: implementation.workload,
    deployment: implementation.deployment,
    mechanismPath,
    steps: mechanismPath.map((mechanismId, index) => {
      const mechanism = mechanismById(mechanismId)!;
      return {
        id: `${implementation.id}:${mechanismId}`,
        mechanismId,
        role: roleForMechanism(mechanismId),
        label: mechanism.title,
        rationale: mechanism.tagline,
      };
    }),
    mergeFamilyIds: [...implementation.mergeFamilyIds],
    declaredItems: [...implementation.mechanisms],
    implementation: implementation.implementation,
    outcome: implementation.outcome,
    tradeoff: implementation.tradeoff,
    scale: [...implementation.scale],
    version: implementation.version,
    source: implementation.source,
  };
}

/**
 * A display and playback projection of the reviewed company corpus. It only
 * reuses declared fields from each account; it never mines prose to invent a
 * MergeTree family or mechanism.
 */
export const COMPANY_ARCHITECTURE_RECIPES: CompanyArchitectureRecipe[] =
  COMPANY_IMPLEMENTATIONS.map(recipeForImplementation);

export function companyArchitectureRecipeById(companyId: string | null | undefined) {
  return COMPANY_ARCHITECTURE_RECIPES.find((recipe) => recipe.companyId === companyId);
}

export function architectureRecipeRoleLabel(role: ArchitectureRecipeRole) {
  return ({
    ingest: "Ingest",
    store: "Store",
    transform: "Transform",
    read: "Read",
    scale: "Scale",
    retain: "Retain",
  } satisfies Record<ArchitectureRecipeRole, string>)[role];
}

export function declaredRecipeReadStrategy(recipe: CompanyArchitectureRecipe): LatestReadStrategy {
  const declared = recipe.declaredItems.join(" ");
  if (/\bargmax/i.test(declared)) return "argmax";
  if (/\bFINAL\b/.test(declared)) return "final";
  return "background";
}
