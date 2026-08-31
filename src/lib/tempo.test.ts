import { describe, expect, it } from "vitest";
import { TEMPO_LABEL, TEMPO_WEIGHT } from "./tempo";

describe("tempo semantics", () => {
  it("keeps labels honest and ordered rather than inventing timings", () => {
    expect(TEMPO_LABEL.background).toBe("Background");
    expect(TEMPO_WEIGHT.immediate).toBeGreaterThan(TEMPO_WEIGHT.heavy);
  });
});

