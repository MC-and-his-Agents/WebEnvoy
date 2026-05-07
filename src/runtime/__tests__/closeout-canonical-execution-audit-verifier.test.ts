import { describe, expect, it } from "vitest";

import {
  verifyCloseoutCanonicalExecutionAudit,
  type CloseoutCanonicalExecutionAuditVerifierInput
} from "../closeout-canonical-execution-audit-verifier.js";

const requestAdmissionResult = () => ({
  request_ref: "upstream_req_issue645_001",
  admission_decision: "allowed",
  normalized_action_type: "read",
  normalized_resource_kind: "profile_session",
  runtime_target_match: true,
  grant_match: true,
  anonymous_isolation_ok: true,
  effective_runtime_mode: "live_read_limited",
  reason_codes: ["LIVE_MODE_APPROVED"],
  derived_from: {
    gate_input_ref: "gate_input_issue645_001",
    action_request_ref: "upstream_req_issue645_001",
    resource_binding_ref: "binding_issue645_001",
    authorization_grant_ref: "grant_issue645_001",
    runtime_target_ref: "target_issue645_001",
    approval_admission_ref: "approval_admission_issue645_001",
    audit_admission_ref: "audit_admission_issue645_001"
  }
});

const executionAudit = () => ({
  audit_ref: "exec_audit_issue645_001",
  request_ref: "upstream_req_issue645_001",
  consumed_inputs: {
    action_request_ref: "upstream_req_issue645_001",
    resource_binding_ref: "binding_issue645_001",
    authorization_grant_ref: "grant_issue645_001",
    runtime_target_ref: "target_issue645_001"
  },
  request_admission_decision: "allowed",
  compatibility_refs: {
    gate_run_id: "run_issue645_001",
    approval_admission_ref: "approval_admission_issue645_001",
    audit_admission_ref: "audit_admission_issue645_001",
    approval_record_ref: "gate_appr_issue645_001",
    audit_record_ref: "gate_evt_issue645_001"
  },
  risk_signals: ["NO_ADDITIONAL_RISK_SIGNALS"],
  recorded_at: "2026-04-14T10:00:11.000Z",
  session_rhythm_window_id: "rhythm_window_issue645_001",
  session_rhythm_decision_id: "rhythm_decision_issue645_001"
});

const successInput = (): CloseoutCanonicalExecutionAuditVerifierInput => ({
  success: {
    summary: {
      capability_result: {
        ability_id: "xhs.note.search.v1",
        layer: "L3",
        action: "read",
        outcome: "success"
      },
      request_admission_result: requestAdmissionResult(),
      execution_audit: executionAudit()
    },
    observability: {
      page_state: {
        page_kind: "search",
        observation_status: "complete"
      },
      failure_site: null
    }
  }
});

const failureInput = (): CloseoutCanonicalExecutionAuditVerifierInput => ({
  failure: {
    error: {
      details: {
        ability_id: "xhs.note.search.v1",
        stage: "execution",
        reason: "SESSION_EXPIRED",
        execution_audit: executionAudit()
      }
    },
    payload: {
      request_admission_result: requestAdmissionResult(),
      execution_audit: executionAudit(),
      observability: {
        failure_site: {
          stage: "request",
          component: "network",
          summary: "login_required"
        }
      }
    }
  }
});

describe("closeout canonical execution audit verifier", () => {
  it("fails closed when no closeout response is provided", () => {
    expect(verifyCloseoutCanonicalExecutionAudit({})).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "missing_closeout_response",
          blocker_layer: "canonical_consistency"
        })
      ]
    });
  });

  it("passes when success summary carries canonical request admission and execution audit", () => {
    expect(verifyCloseoutCanonicalExecutionAudit(successInput())).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: [],
      success: {
        checked: true,
        has_summary: true,
        has_request_admission_result: true,
        has_execution_audit: true,
        request_ref: "upstream_req_issue645_001",
        admission_decision: "allowed",
        audit_ref: "exec_audit_issue645_001"
      },
      observability: {
        success_leak_paths: [],
        failure_leak_paths: []
      }
    });
  });

  it("passes when failure error.details carries the same canonical execution audit as the payload", () => {
    expect(verifyCloseoutCanonicalExecutionAudit(failureInput())).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: [],
      failure: {
        checked: true,
        details_path: "error.details",
        has_details: true,
        has_execution_audit: true,
        audit_ref: "exec_audit_issue645_001",
        canonical_source_path: "payload.execution_audit"
      },
      observability: {
        success_leak_paths: [],
        failure_leak_paths: []
      }
    });
  });

  it("accepts direct failure details when the runtime failure shape has no nested error object", () => {
    const input: CloseoutCanonicalExecutionAuditVerifierInput = {
      failure: {
        details: {
          reason: "GATEWAY_INVOKER_FAILED",
          execution_audit: executionAudit()
        },
        observability: {
          failure_site: {
            summary: "gateway_invoker_failed"
          }
        }
      }
    };

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "PASS",
      passed: true,
      failure: {
        details_path: "details",
        canonical_source_path: "details.execution_audit"
      }
    });
  });

  it("fails closed when success summary is missing canonical fields", () => {
    const input = successInput();
    input.success = {
      summary: {
        capability_result: {
          outcome: "success"
        }
      },
      observability: {}
    };

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "missing_success_request_admission_result",
          blocker_layer: "success_summary"
        }),
        expect.objectContaining({
          blocker_code: "missing_success_execution_audit",
          blocker_layer: "success_summary"
        })
      ]
    });
  });

  it("fails closed when success canonical request admission and execution audit mismatch", () => {
    const input = successInput();
    const summary = input.success?.summary as Record<string, unknown>;
    summary.execution_audit = {
      ...executionAudit(),
      request_ref: "upstream_req_other",
      request_admission_decision: "blocked"
    };

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "success_canonical_mismatch",
          blocker_layer: "canonical_consistency"
        })
      ]
    });
  });

  it("fails closed when success request admission omits canonical admission fields", () => {
    const input = successInput();
    const summary = input.success?.summary as Record<string, unknown>;
    summary.request_admission_result = {
      request_ref: "upstream_req_issue645_001",
      admission_decision: "allowed",
      derived_from: {}
    };

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "invalid_success_request_admission_result",
          blocker_layer: "success_summary"
        })
      ]
    });
  });

  it("fails closed when success execution audit consumed inputs differ from admission refs", () => {
    const input = successInput();
    const summary = input.success?.summary as Record<string, unknown>;
    summary.execution_audit = {
      ...executionAudit(),
      consumed_inputs: {
        action_request_ref: "upstream_req_issue645_001",
        resource_binding_ref: "binding_issue645_001",
        authorization_grant_ref: "grant_issue645_001",
        runtime_target_ref: "target_other"
      }
    };

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "success_consumed_inputs_mismatch",
          blocker_layer: "canonical_consistency"
        })
      ])
    });
  });

  it("fails closed when failure details are missing execution_audit", () => {
    const input = failureInput();
    input.failure = {
      error: {
        details: {
          ability_id: "xhs.note.search.v1",
          stage: "execution",
          reason: "SESSION_EXPIRED"
        }
      },
      payload: {
        execution_audit: executionAudit()
      }
    };

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "missing_failure_execution_audit",
          blocker_layer: "failure_details"
        })
      ]
    });
  });

  it("fails closed when failure execution audit consumed inputs differ from admission refs", () => {
    const input = failureInput();
    const details = input.failure?.error?.details as Record<string, unknown>;
    details.execution_audit = {
      ...executionAudit(),
      consumed_inputs: {
        action_request_ref: "upstream_req_issue645_001",
        resource_binding_ref: "binding_other",
        authorization_grant_ref: "grant_issue645_001",
        runtime_target_ref: "target_issue645_001"
      }
    };

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "failure_consumed_inputs_mismatch",
          blocker_layer: "canonical_consistency"
        })
      ])
    });
  });

  it("fails closed when failure execution audit request ref differs from admission result", () => {
    const input = failureInput();
    const details = input.failure?.error?.details as Record<string, unknown>;
    const payload = input.failure?.payload as Record<string, unknown>;
    const mismatchedAudit = {
      ...executionAudit(),
      request_ref: "upstream_req_other"
    };
    details.execution_audit = mismatchedAudit;
    payload.execution_audit = mismatchedAudit;

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "failure_canonical_mismatch",
          blocker_layer: "canonical_consistency"
        })
      ])
    });
  });

  it("fails closed when failure execution audit admission decision differs from admission result", () => {
    const input = failureInput();
    const details = input.failure?.error?.details as Record<string, unknown>;
    const payload = input.failure?.payload as Record<string, unknown>;
    const mismatchedAudit = {
      ...executionAudit(),
      request_admission_decision: "blocked"
    };
    details.execution_audit = mismatchedAudit;
    payload.execution_audit = mismatchedAudit;

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "failure_canonical_mismatch",
          blocker_layer: "canonical_consistency"
        })
      ])
    });
  });

  it("fails closed when execution_audit omits consumed inputs", () => {
    const input = failureInput();
    const details = input.failure?.error?.details as Record<string, unknown>;
    details.execution_audit = {
      ...executionAudit(),
      consumed_inputs: {
        action_request_ref: "upstream_req_issue645_001",
        resource_binding_ref: "binding_issue645_001",
        authorization_grant_ref: "grant_issue645_001",
        runtime_target_ref: null
      }
    };

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "invalid_failure_execution_audit",
          blocker_layer: "failure_details"
        })
      ])
    });
  });

  it("fails closed when execution_audit omits canonical compatibility refs", () => {
    const input = failureInput();
    const details = input.failure?.error?.details as Record<string, unknown>;
    details.execution_audit = {
      ...executionAudit(),
      compatibility_refs: {
        gate_run_id: "run_issue645_001",
        approval_admission_ref: "",
        audit_admission_ref: "audit_admission_issue645_001",
        approval_record_ref: "gate_appr_issue645_001",
        audit_record_ref: "gate_evt_issue645_001"
      }
    };

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "invalid_failure_execution_audit",
          blocker_layer: "failure_details"
        })
      ])
    });
  });

  it("fails closed when execution_audit risk signals are empty", () => {
    const input = failureInput();
    const details = input.failure?.error?.details as Record<string, unknown>;
    details.execution_audit = {
      ...executionAudit(),
      risk_signals: []
    };

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "invalid_failure_execution_audit",
          blocker_layer: "failure_details"
        })
      ])
    });
  });

  it("fails closed when failure details execution_audit differs from canonical payload audit", () => {
    const input = failureInput();
    const details = input.failure?.error?.details as Record<string, unknown>;
    details.execution_audit = {
      ...executionAudit(),
      audit_ref: "exec_audit_other"
    };

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "failure_execution_audit_mismatch",
          blocker_layer: "canonical_consistency"
        })
      ]
    });
  });

  it("fails closed when execution_audit leaks into success observability", () => {
    const input = successInput();
    input.success = {
      ...input.success,
      observability: {
        page_state: {
          execution_audit: executionAudit()
        }
      }
    };

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "FAIL",
      passed: false,
      observability: {
        success_leak_paths: ["success.observability.page_state.execution_audit"]
      },
      blockers: [
        expect.objectContaining({
          blocker_code: "execution_audit_in_observability",
          blocker_layer: "observability_boundary",
          path: "success.observability.page_state.execution_audit"
        })
      ]
    });
  });

  it("fails closed when execution_audit leaks into failure observability", () => {
    const input = failureInput();
    const payload = input.failure?.payload as Record<string, unknown>;
    payload.observability = {
      failure_site: {
        execution_audit: executionAudit()
      }
    };

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "FAIL",
      passed: false,
      observability: {
        failure_leak_paths: ["failure.payload.observability.failure_site.execution_audit"]
      },
      blockers: [
        expect.objectContaining({
          blocker_code: "execution_audit_in_observability",
          blocker_layer: "observability_boundary",
          path: "failure.payload.observability.failure_site.execution_audit"
        })
      ]
    });
  });

  it("fails closed when execution_audit leaks into direct failure observability", () => {
    const input = failureInput();
    input.failure = {
      ...input.failure,
      observability: {
        diagnostics: {
          execution_audit: executionAudit()
        }
      }
    };

    expect(verifyCloseoutCanonicalExecutionAudit(input)).toMatchObject({
      decision: "FAIL",
      passed: false,
      observability: {
        failure_leak_paths: ["failure.observability.diagnostics.execution_audit"]
      },
      blockers: [
        expect.objectContaining({
          blocker_code: "execution_audit_in_observability",
          blocker_layer: "observability_boundary",
          path: "failure.observability.diagnostics.execution_audit"
        })
      ]
    });
  });
});
