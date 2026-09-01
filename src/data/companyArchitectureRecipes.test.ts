import { describe, expect, it } from "vitest";
import { COMPANY_IMPLEMENTATIONS } from "./companyImplementations";
import {
  COMPANY_ARCHITECTURE_RECIPES,
  architectureRecipeRoleLabel,
  companyArchitectureRecipeById,
  declaredRecipeReadStrategy,
} from "./companyArchitectureRecipes";
import { mechanismById } from "./mechanisms";

describe("company architecture recipes", () => {
  it("projects every reviewed account without dropping its declared stack", () => {
    expect(COMPANY_ARCHITECTURE_RECIPES).toHaveLength(COMPANY_IMPLEMENTATIONS.length);
    expect(new Set(COMPANY_ARCHITECTURE_RECIPES.map((recipe) => recipe.companyId)).size).toBe(COMPANY_IMPLEMENTATIONS.length);

    for (const recipe of COMPANY_ARCHITECTURE_RECIPES) {
      const source = COMPANY_IMPLEMENTATIONS.find((implementation) => implementation.id === recipe.companyId)!;
      expect(recipe.declaredItems).toEqual(source.mechanisms);
      expect(recipe.declaredItems.length).toBeGreaterThanOrEqual(2);
      expect(recipe.mergeFamilyIds).toEqual(source.mergeFamilyIds);
      expect(recipe.version).toBe(source.version);
      expect(recipe.source.url).toBe(source.source.url);
      expect(recipe.mechanismPath.every((mechanismId) => Boolean(mechanismById(mechanismId)))).toBe(true);
    }
  });

  it("orders Cloudflare as a multi-mechanism recipe using declared mappings", () => {
    const recipe = companyArchitectureRecipeById("cloudflare-http-analytics")!;

    expect(recipe.company).toBe("Cloudflare");
    expect(recipe.mergeFamilyIds).toEqual(["summing", "aggregating"]);
    expect(recipe.mechanismPath).toEqual([
      "ingestion.client-batching",
      "precompute.aggregate-states",
      "precompute.materialized-view",
      "architecture.replication",
    ]);
    expect(recipe.steps.map((step) => architectureRecipeRoleLabel(step.role))).toEqual([
      "Ingest",
      "Transform",
      "Transform",
      "Scale",
    ]);
  });

  it("keeps disclosure gaps honest instead of deriving a path from prose", () => {
    const recipe = companyArchitectureRecipeById("docontrol-mcp-security-analytics")!;

    expect(recipe.declaredItems.length).toBeGreaterThan(1);
    expect(recipe.mechanismPath).toEqual([]);
    expect(recipe.steps).toEqual([]);
  });

  it("selects a read strategy only when the reviewed stack names it", () => {
    expect(declaredRecipeReadStrategy(companyArchitectureRecipeById("cloudflare-http-analytics")!)).toBe("background");
    expect(declaredRecipeReadStrategy(companyArchitectureRecipeById("highlevel-notifications-analytics")!)).toBe("argmax");
    expect(declaredRecipeReadStrategy(companyArchitectureRecipeById("ramp-spend-analytics")!)).toBe("final");
  });
});
