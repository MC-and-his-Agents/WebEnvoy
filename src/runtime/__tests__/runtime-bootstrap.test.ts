import { describe, expect, it } from "vitest";

import { buildRuntimeBootstrapContextId } from "../runtime-bootstrap.js";

describe("buildRuntimeBootstrapContextId", () => {
  it("returns the same context id for the same profile and run", () => {
    expect(buildRuntimeBootstrapContextId("official_profile", "run-001")).toBe(
      buildRuntimeBootstrapContextId("official_profile", "run-001")
    );
  });

  it("rotates the context id when the run changes", () => {
    expect(buildRuntimeBootstrapContextId("official_profile", "run-001")).not.toBe(
      buildRuntimeBootstrapContextId("official_profile", "run-002")
    );
  });
});
