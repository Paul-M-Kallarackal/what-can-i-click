import { describe, expect, it } from "vitest";
import type { LatestReadStrategy, MergeFamilyId } from "../types";
import {
  LATEST_READ_STRATEGIES,
  MERGE_FAMILY_READ_STRATEGIES,
  MERGE_FAMILIES,
  mergeFamilySupportsReadStrategy,
  mergeFamilyById,
  type MergeFamilySpec,
} from "./mergeFamilies";

type Tidbit = MergeFamilySpec["tidbits"][number];

const APPLICABLE_STRATEGIES: Record<MergeFamilyId, readonly LatestReadStrategy[]> = MERGE_FAMILY_READ_STRATEGIES;

function visibleTidbits(
  family: MergeFamilySpec,
  strategy: LatestReadStrategy,
): Tidbit[] {
  return family.tidbits.filter(
    (tidbit) =>
      !tidbit.showForStrategies ||
      tidbit.showForStrategies.includes(strategy),
  );
}

describe("MergeTree family visual tidbit registry", () => {
  it("provides globally unique, complete hotspot records at finite 3D positions", () => {
    const familyIds = MERGE_FAMILIES.map((family) => family.id);
    const tidbits = MERGE_FAMILIES.flatMap((family) =>
      family.tidbits.map((tidbit) => ({ family, tidbit })),
    );
    const tidbitIds = tidbits.map(({ tidbit }) => tidbit.id);

    expect(new Set(familyIds).size).toBe(familyIds.length);
    expect(new Set(tidbitIds).size).toBe(tidbitIds.length);

    for (const { family, tidbit } of tidbits) {
      const tidbitNamespace =
        family.id === "versioned-collapsing" ? "versioned" : family.id;
      expect(tidbit.id).toMatch(new RegExp(`^${tidbitNamespace}\\.`));
      expect(tidbit.label.trim()).not.toBe("");
      expect(tidbit.title.trim()).not.toBe("");
      expect(tidbit.body.trim()).not.toBe("");
      expect(tidbit.scenePosition).toHaveLength(3);
      expect(tidbit.scenePosition.every(Number.isFinite)).toBe(true);
    }
  });

  it("keeps strategy-specific hotspots bounded to the read path they explain", () => {
    const restrictedTidbits = Object.fromEntries(
      MERGE_FAMILIES.flatMap((family) =>
        family.tidbits
          .filter((tidbit) => tidbit.showForStrategies)
          .map((tidbit) => [tidbit.id, tidbit.showForStrategies]),
      ),
    );

    expect(restrictedTidbits).toEqual({
      "replacing.background": ["background"],
      "replacing.argmax": ["argmax"],
      "replacing.final": ["final"],
      "coalescing.read": ["final"],
    });

    const knownStrategies = new Set(
      LATEST_READ_STRATEGIES.map((strategy) => strategy.id),
    );
    for (const strategies of Object.values(restrictedTidbits)) {
      expect(strategies).toBeDefined();
      expect(strategies?.length).toBeGreaterThan(0);
      expect(new Set(strategies).size).toBe(strategies?.length);
      expect(strategies?.every((strategy) => knownStrategies.has(strategy))).toBe(
        true,
      );
    }
  });

  it("resolves exactly one Replacing read-strategy hotspot without leakage", () => {
    const family = mergeFamilyById("replacing");
    const stableIds = ["replacing.versions", "replacing.pruning"];

    for (const strategy of APPLICABLE_STRATEGIES.replacing) {
      expect(visibleTidbits(family, strategy).map((tidbit) => tidbit.id)).toEqual([
        ...stableIds,
        `replacing.${strategy}`,
      ]);
    }
  });

  it("exposes Coalescing's FINAL explanation only when FINAL is applicable", () => {
    const family = mergeFamilyById("coalescing");
    const stableIds = [
      "coalescing.shards",
      "coalescing.assembly",
      "coalescing.nulls",
    ];

    expect(visibleTidbits(family, "background").map((tidbit) => tidbit.id)).toEqual(
      stableIds,
    );
    expect(visibleTidbits(family, "final").map((tidbit) => tidbit.id)).toEqual([
      ...stableIds,
      "coalescing.read",
    ]);
    expect(visibleTidbits(family, "argmax").map((tidbit) => tidbit.id)).toEqual(
      stableIds,
    );
  });

  it("keeps at least three stable visible hotspots for every applicable family strategy", () => {
    for (const family of MERGE_FAMILIES) {
      expect(mergeFamilyById(family.id)).toBe(family);

      for (const strategy of APPLICABLE_STRATEGIES[family.id]) {
        const firstResolution = visibleTidbits(family, strategy);
        const replay = visibleTidbits(family, strategy);

        expect(firstResolution.length).toBeGreaterThanOrEqual(3);
        expect(new Set(firstResolution.map((tidbit) => tidbit.id)).size).toBe(
          firstResolution.length,
        );
        expect(replay).toEqual(firstResolution);
        firstResolution.forEach((tidbit, index) => {
          expect(replay[index]).toBe(tidbit);
          expect(tidbit.scenePosition.every(Number.isFinite)).toBe(true);
        });
      }
    }
  });

  it("exposes the same bounded read-strategy compatibility used by WebMCP", () => {
    for (const family of MERGE_FAMILIES) {
      for (const strategy of LATEST_READ_STRATEGIES) {
        expect(mergeFamilySupportsReadStrategy(family.id, strategy.id)).toBe(
          APPLICABLE_STRATEGIES[family.id].includes(strategy.id),
        );
      }
    }
  });

  it("states many-to-one MergeTree flow and the surviving Collapsing replacement explicitly", () => {
    const merge = mergeFamilyById("merge");
    expect(merge.behavior).toContain("become one larger part");
    expect(merge.tidbits.find((tidbit) => tidbit.id === "merge.tributaries")?.body).toContain(
      "writes one larger part",
    );

    const collapsing = mergeFamilyById("collapsing");
    expect(collapsing.behavior).toContain("replacement +1 survives");
    expect(collapsing.tidbits.find((tidbit) => tidbit.id === "collapsing.cancel")?.body).toContain(
      "replacement +1 remains",
    );
  });
});
