import { buildRiskTransitionAudit } from "../risk-state.js";

const clone = (value) => structuredClone(value);

const asString = (value) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const buildIssue209PostGateArtifacts = (input) => {
  const nowValue = typeof input?.now === "function" ? input.now() : Date.now();
  const recordedAt = new Date(nowValue).toISOString();
  const gate = input.gate;
  const requestedMode = gate.consumer_gate_result.requested_execution_mode;
  const liveModeRequested =
    requestedMode === "live_read_limited" ||
    requestedMode === "live_read_high_risk" ||
    requestedMode === "live_write";
  const riskSignal = gate.consumer_gate_result.gate_decision === "blocked" && liveModeRequested;
  const recoverySignal =
    gate.consumer_gate_result.gate_decision === "allowed" &&
    gate.gate_input.risk_state === "limited" &&
    liveModeRequested;

  const approvalRecord = clone(gate.approval_record);
  approvalRecord.decision_id = gate.gate_outcome.decision_id;
  approvalRecord.approval_id = gate.approval_record.approval_id ?? null;

  const auditRecord = {
    event_id: `gate_evt_${gate.gate_outcome.decision_id}`,
    decision_id: gate.gate_outcome.decision_id,
    approval_id: approvalRecord.approval_id,
    run_id: input.runId,
    session_id: input.sessionId,
    profile: input.profile,
    issue_scope: gate.gate_input.issue_scope,
    risk_state: gate.gate_input.risk_state,
    target_domain: gate.consumer_gate_result.target_domain,
    target_tab_id: gate.consumer_gate_result.target_tab_id,
    target_page: gate.consumer_gate_result.target_page,
    action_type: gate.consumer_gate_result.action_type,
    requested_execution_mode: requestedMode,
    effective_execution_mode: gate.consumer_gate_result.effective_execution_mode,
    gate_decision: gate.consumer_gate_result.gate_decision,
    gate_reasons: clone(gate.consumer_gate_result.gate_reasons),
    approver: approvalRecord.approver,
    approved_at: approvalRecord.approved_at,
    write_interaction_tier: gate.write_action_matrix_decisions?.write_interaction_tier ?? null,
    write_action_matrix_decisions: gate.write_action_matrix_decisions
      ? clone(gate.write_action_matrix_decisions)
      : null,
    risk_signal: riskSignal,
    recovery_signal: recoverySignal,
    session_rhythm_state: riskSignal ? "cooldown" : recoverySignal ? "recovery" : "normal",
    cooldown_until: riskSignal ? new Date(nowValue + 30 * 60_000).toISOString() : null,
    recovery_started_at: recoverySignal ? recordedAt : null,
    recorded_at: recordedAt
  };

  const transitionAudit = buildRiskTransitionAudit({
    runId: input.runId,
    sessionId: input.sessionId,
    issueScope: gate.gate_input.issue_scope,
    prevState: gate.gate_input.risk_state,
    decision: gate.consumer_gate_result.gate_decision,
    gateReasons: clone(gate.consumer_gate_result.gate_reasons),
    requestedExecutionMode: gate.consumer_gate_result.requested_execution_mode,
    approvalRecord,
    auditRecords: [auditRecord],
    now: recordedAt
  });
  auditRecord.next_state = asString(transitionAudit.next_state);
  auditRecord.transition_trigger = asString(transitionAudit.trigger);

  return {
    approval_record: approvalRecord,
    audit_record: auditRecord
  };
};

export { buildIssue209PostGateArtifacts };
