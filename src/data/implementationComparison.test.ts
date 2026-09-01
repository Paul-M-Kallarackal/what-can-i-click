import { describe, expect, it } from "vitest";
import {
  COMPANY_IMPLEMENTATIONS,
  type CompanyImplementation,
} from "./companyImplementations";
import { recommendImplementationPeer } from "./implementationComparison";

describe("production implementation peer recommendation", () => {
  it("chooses the same strongest declared peer regardless of corpus order", () => {
    const cloudflare = COMPANY_IMPLEMENTATIONS.find((entry) => entry.id === "cloudflare-http-analytics")!;
    const forward = recommendImplementationPeer(cloudflare, COMPANY_IMPLEMENTATIONS);
    const reversed = recommendImplementationPeer(cloudflare, [...COMPANY_IMPLEMENTATIONS].reverse());

    expect(forward?.implementation.company).toBe("HighLevel");
    expect(reversed?.implementation.id).toBe(forward?.implementation.id);
    expect(forward?.sharedFamilyIds).toEqual(["summing"]);
    expect(forward?.sharedMechanisms).toEqual(["materialized views", "SummingMergeTree"]);
    expect(forward?.sharesWorkload).toBe(true);
  });

  it("does not infer an engine match from implementation prose", () => {
    const template = COMPANY_IMPLEMENTATIONS[0];
    const record = (overrides: Partial<CompanyImplementation>): CompanyImplementation => ({
      ...template,
      id: "current",
      company: "Current",
      workload: "general",
      mechanisms: ["declared-current-mechanism"],
      mergeFamilyIds: [],
      ...overrides,
    });
    const current = record({});
    const proseOnly = record({
      id: "prose-only",
      company: "Prose only",
      workload: "observability",
      implementation: "Uses declared-current-mechanism and ReplacingMergeTree.",
      mechanisms: [],
      mergeFamilyIds: [],
    });
    const sameWorkload = record({
      id: "same-workload",
      company: "Same workload",
      workload: "general",
      mechanisms: [],
      mergeFamilyIds: [],
    });

    const match = recommendImplementationPeer(current, [current, proseOnly, sameWorkload]);

    expect(match?.implementation.id).toBe("same-workload");
    expect(match?.sharedMechanisms).toEqual([]);
    expect(match?.sharedFamilyIds).toEqual([]);
    expect(match?.sharesWorkload).toBe(true);
  });
});
