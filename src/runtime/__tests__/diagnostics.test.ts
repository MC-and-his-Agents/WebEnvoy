import { describe, expect, it } from "vitest";

import { buildDiagnosis, createMinimalDiagnosis } from "../diagnostics.js";

describe("diagnostics", () => {
  it("classifies runtime unavailable from signals", () => {
    const diagnosis = buildDiagnosis({
      signals: {
        runtime_unavailable: true,
        request_failed: true
      },
      failure_site: {
        stage: "runtime",
        component: "cli",
        target: "native-messaging",
        summary: "host unavailable"
      },
      evidence: ["runtime bootstrap failed"]
    });

    expect(diagnosis.category).toBe("runtime_unavailable");
    expect(diagnosis.stage).toBe("runtime");
    expect(diagnosis.component).toBe("cli");
  });

  it("uses explicit category and bounds evidence payload", () => {
    const diagnosis = buildDiagnosis(
      {
        category: "page_changed",
        failure_site: {
          stage: "action",
          component: "page",
          target: "selector:#publish",
          summary: "selector missing"
        },
        evidence: [
          "  expected selector missing  ",
          "x".repeat(200),
          "",
          "layout shifted",
          "ignored"
        ]
      },
      {
        maxEvidenceItems: 3,
        maxEvidenceLength: 40
      }
    );

    expect(diagnosis.category).toBe("page_changed");
    expect(diagnosis.evidence).toHaveLength(3);
    expect(diagnosis.evidence[0]).toBe("expected selector missing");
    expect(diagnosis.evidence[1]).toHaveLength(40);
  });

  it("creates minimal unknown diagnosis when no signal is available", () => {
    const diagnosis = createMinimalDiagnosis();

    expect(diagnosis).toMatchObject({
      category: "unknown",
      stage: "unknown",
      component: "unknown",
      failure_site: {
        stage: "unknown",
        component: "unknown",
        target: "unknown",
        summary: "diagnosis unavailable"
      }
    });
  });
});
