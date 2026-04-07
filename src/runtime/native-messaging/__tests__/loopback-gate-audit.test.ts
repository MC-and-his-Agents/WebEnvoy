import { describe, expect, it } from "vitest";

import { type LoopbackAuditSource, buildLoopbackAuditRecord } from "../loopback-gate-audit.js";
import { createLoopbackAuditFixture } from "./loopback-gate-test-fixtures.js";

describe("native messaging loopback gate audit", () => {
  it("records the gate outcome into the audit envelope", () => {
    const gate = createLoopbackAuditFixture();
    const audit = buildLoopbackAuditRecord({
      runId: "run-001",
      sessionId: "session-001",
      profile: "profile-a",
      gate
    });

    (audit.gate_reasons as string[]).push("MUTATED");
    const decisions = audit.write_action_matrix_decisions as
      | { decisions?: string[] }
      | null
      | undefined;
    decisions?.decisions?.push("MUTATED");

    expect(audit).toMatchObject({
      event_id: "gate_evt_gate_decision_run-001",
      decision_id: "gate_decision_run-001",
      approval_id: "gate_appr_run-001",
      run_id: "run-001",
      session_id: "session-001",
      profile: "profile-a",
      risk_state: "paused",
      target_domain: "www.xiaohongshu.com",
      target_tab_id: 1,
      target_page: "search_result_tab",
      action_type: "read",
      requested_execution_mode: "dry_run",
      effective_execution_mode: "dry_run",
      gate_decision: "allowed",
      approver: "loopback-agent",
      approved_at: "2026-03-23T10:00:00.000Z",
      write_interaction_tier: "observe_only",
      recorded_at: "2026-03-23T10:00:00.000Z"
    });
    expect(gate.consumerGateResult.gate_reasons).toEqual([]);
    expect(gate.writeActionMatrixDecisions?.decisions).toEqual([]);
  });

  it("derives unique event_id values from decision_id for repeated gate evaluations", () => {
    const first = buildLoopbackAuditRecord({
      runId: "run-001",
      sessionId: "session-001",
      profile: "profile-a",
      gate: createLoopbackAuditFixture()
    });
    const second = buildLoopbackAuditRecord({
      runId: "run-001",
      sessionId: "session-001",
      profile: "profile-a",
      gate: createLoopbackAuditFixture({
        gateOutcome: {
          decision_id: "gate_decision_run-001_req-002",
          gate_decision: "allowed"
        } as unknown as LoopbackAuditSource["gateOutcome"],
        approvalRecord: {
          approval_id: "gate_appr_run-001",
          decision_id: "gate_decision_run-001_req-002",
          approved: true,
          approver: "loopback-agent",
          approved_at: "2026-03-23T10:00:00.000Z",
          checks: {
            approval_record_approved_true: true,
            approval_record_approver_present: true,
            approval_record_approved_at_present: true,
            approval_record_checks_all_true: true
          }
        } as unknown as LoopbackAuditSource["approvalRecord"]
      })
    });

    expect(first.event_id).toBe("gate_evt_gate_decision_run-001");
    expect(second.event_id).toBe("gate_evt_gate_decision_run-001_req-002");
    expect(second.event_id).not.toBe(first.event_id);
  });
});
