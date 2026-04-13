import { describe, expect, it } from "vitest";
import {
  ensureIssue209AdmissionContextForContract,
  normalizeGateOptionsForContract,
  parseAbilityEnvelopeForContract,
  parseXhsCommandInputForContract,
  parseDetailInputForContract,
  parseSearchInputForContract,
  parseUserHomeInputForContract,
  resolveIssue209CommandRequestIdForContract,
  resolveIssue209GateInvocationIdForContract
} from "../xhs-input.js";

describe("xhs-input", () => {
  it("parses ability envelope and normalizes xhs.search input", () => {
    const envelope = parseAbilityEnvelopeForContract({
      ability: { id: "xhs.note.search.v1", layer: "L3", action: "read" },
      input: {
        query: "  露营  ",
        limit: 8,
        page: 2,
        search_id: "  search-1  ",
        sort: "  general  ",
        note_type: 3
      },
      options: {
        target_domain: "creator.xiaohongshu.com",
        target_tab_id: 7,
        target_page: "search_result",
        requested_execution_mode: "dry_run"
      }
    });

    expect(envelope.ability).toEqual({
      id: "xhs.note.search.v1",
      layer: "L3",
      action: "read"
    });
    expect(parseSearchInputForContract(envelope.input, envelope.ability.id, envelope.options, envelope.ability.action)).toEqual({
      query: "露营",
      limit: 8,
      page: 2,
      search_id: "search-1",
      sort: "general",
      note_type: 3
    });
    expect(normalizeGateOptionsForContract(envelope.options, envelope.ability.id)).toMatchObject({
      targetDomain: "creator.xiaohongshu.com",
      targetTabId: 7,
      targetPage: "search_result",
      requestedExecutionMode: "dry_run"
    });
  });

  it("permits issue_208 editor_input validation without query", () => {
    const envelope = parseAbilityEnvelopeForContract({
      ability: { id: "xhs.editor.input.v1", layer: "L3", action: "write" },
      input: {},
      options: {
        issue_scope: "issue_208",
        action_type: "write",
        requested_execution_mode: "live_write",
        validation_action: "editor_input",
        target_domain: "creator.xiaohongshu.com",
        target_tab_id: 11,
        target_page: "creator_publish_tab"
      }
    });

    expect(parseSearchInputForContract(envelope.input, envelope.ability.id, envelope.options, envelope.ability.action)).toEqual({});
  });

  it("parses xhs.detail input and trims note_id", () => {
    expect(
      parseDetailInputForContract(
        {
          note_id: "  note-001  "
        },
        "xhs.note.detail.v1"
      )
    ).toEqual({
      note_id: "note-001"
    });
  });

  it("parses xhs.user_home input and trims user_id", () => {
    expect(
      parseUserHomeInputForContract(
        {
          user_id: "  user-001  "
        },
        "xhs.user.home.v1"
      )
    ).toEqual({
      user_id: "user-001"
    });
  });

  it("dispatches xhs.detail command input through the shared contract parser", () => {
    expect(
      parseXhsCommandInputForContract({
        command: "xhs.detail",
        abilityId: "xhs.note.detail.v1",
        abilityAction: "read",
        payload: {
          note_id: "  note-001  "
        },
        options: {}
      })
    ).toEqual({
      note_id: "note-001"
    });
  });

  it("does not synthesize issue_209 live admission_context from the current approval record", () => {
    const options = ensureIssue209AdmissionContextForContract({
      options: {
        issue_scope: "issue_209",
        target_domain: "www.xiaohongshu.com",
        target_tab_id: 32,
        target_page: "search_result_tab",
        action_type: "read",
        requested_execution_mode: "live_read_limited",
        risk_state: "limited",
        approval_record: {
          approved: true,
          approver: "qa-reviewer",
          approved_at: "2026-03-23T10:00:00Z",
          checks: {
            target_domain_confirmed: true,
            target_tab_confirmed: true,
            target_page_confirmed: true,
            risk_state_checked: true,
            action_type_confirmed: true
          }
        }
      },
      runId: "run-cli-issue209-live-001",
      requestId: "issue209-live-limited-001",
      gateInvocationId: "issue209-gate-run-cli-issue209-live-001-001",
      sessionId: "nm-session-001"
    });

    expect(options).not.toHaveProperty("admission_context");
  });

  it("keeps caller-provided admission_context unchanged instead of rebinding session", () => {
    const options = ensureIssue209AdmissionContextForContract({
      options: {
        issue_scope: "issue_209",
        target_domain: "www.xiaohongshu.com",
        target_tab_id: 32,
        target_page: "search_result_tab",
        action_type: "read",
        requested_execution_mode: "live_read_limited",
        risk_state: "limited",
        admission_context: {
          approval_admission_evidence: {
            approval_admission_ref: "approval_admission_existing",
            request_id: "issue209-live-session-001",
            run_id: "run-cli-issue209-live-session-001",
            session_id: "nm-session-stale-209"
          },
          audit_admission_evidence: {
            audit_admission_ref: "audit_admission_existing",
            request_id: "issue209-live-session-001",
            run_id: "run-cli-issue209-live-session-001",
            session_id: "nm-session-stale-209"
          }
        },
        approval_record: {
          approved: true,
          approver: "qa-reviewer",
          approved_at: "2026-03-23T10:00:00Z",
          checks: {
            target_domain_confirmed: true,
            target_tab_confirmed: true,
            target_page_confirmed: true,
            risk_state_checked: true,
            action_type_confirmed: true
          }
        }
      },
      runId: "run-cli-issue209-live-session-001",
      requestId: "issue209-live-session-001",
      sessionId: "nm-session-real-209",
      gateInvocationId: "issue209-gate-run-cli-issue209-live-session-001-001"
    });

    expect(options.admission_context).toMatchObject({
      approval_admission_evidence: {
        session_id: "nm-session-stale-209"
      },
      audit_admission_evidence: {
        session_id: "nm-session-stale-209"
      }
    });
  });

  it("synthesizes a canonical request_id for issue_209 live reads when caller omits it", () => {
    const requestId = resolveIssue209CommandRequestIdForContract({
      options: {
        issue_scope: "issue_209",
        requested_execution_mode: "live_read_limited"
      },
      requestId: null
    });

    expect(requestId).toEqual(expect.stringMatching(/^issue209-live-/));
    const options = ensureIssue209AdmissionContextForContract({
      options: {
        issue_scope: "issue_209",
        target_domain: "www.xiaohongshu.com",
        target_tab_id: 32,
        target_page: "profile_tab",
        action_type: "read",
        requested_execution_mode: "live_read_limited",
        risk_state: "limited"
      },
      runId: "run-cli-issue209-live-003",
      requestId,
      gateInvocationId: "issue209-gate-run-cli-issue209-live-003-001",
      sessionId: "nm-session-001"
    });

    expect(options).not.toHaveProperty("admission_context");
  });

  it("treats omitted issue_scope as issue_209 for live read request_id synthesis only", () => {
    const requestId = resolveIssue209CommandRequestIdForContract({
      options: {
        requested_execution_mode: "live_read_limited"
      },
      requestId: null
    });

    expect(requestId).toEqual(expect.stringMatching(/^issue209-live-/));
    const options = ensureIssue209AdmissionContextForContract({
      options: {
        target_domain: "www.xiaohongshu.com",
        target_tab_id: 32,
        target_page: "search_result_tab",
        action_type: "read",
        requested_execution_mode: "live_read_limited",
        risk_state: "limited"
      },
      runId: "run-cli-issue209-live-004",
      requestId,
      gateInvocationId: "issue209-gate-run-cli-issue209-live-004-001",
      sessionId: "nm-session-001"
    });

    expect(options).not.toHaveProperty("admission_context");
  });

  it("reuses caller request_id from synthesized admission_context when request_id is omitted", () => {
    const requestId = resolveIssue209CommandRequestIdForContract({
      options: {
        issue_scope: "issue_209",
        requested_execution_mode: "live_read_limited",
        admission_context: {
          approval_admission_evidence: {
            request_id: "issue209-live-existing-001",
            decision_id: "gate_decision_issue209-gate-run-cli-issue209-live-005-existing-001"
          },
          audit_admission_evidence: {
            request_id: "issue209-live-existing-001",
            decision_id: "gate_decision_issue209-gate-run-cli-issue209-live-005-existing-001"
          }
        }
      },
      requestId: null,
      runId: "run-cli-issue209-live-005"
    });

    expect(requestId).toBe("issue209-live-existing-001");
  });

  it("does not derive gate_invocation_id from caller admission_context", () => {
    const gateInvocationId = resolveIssue209GateInvocationIdForContract({
      options: {
        issue_scope: "issue_209",
        requested_execution_mode: "live_read_limited",
        admission_context: {
          approval_admission_evidence: {
            decision_id: "gate_decision_issue209-gate-run-cli-issue209-live-007-existing-001"
          },
          audit_admission_evidence: {
            decision_id: "gate_decision_issue209-gate-run-cli-issue209-live-007-existing-001"
          }
        }
      },
      runId: "run-cli-issue209-live-007"
    });

    expect(gateInvocationId).toBeNull();
  });

  it("keeps legacy request_id recovery for older admission decision ids", () => {
    const requestId = resolveIssue209CommandRequestIdForContract({
      options: {
        issue_scope: "issue_209",
        requested_execution_mode: "live_read_limited",
        admission_context: {
          approval_admission_evidence: {
            decision_id: "gate_decision_run-cli-issue209-live-008_issue209-live-existing-legacy-001"
          },
          audit_admission_evidence: {
            decision_id: "gate_decision_run-cli-issue209-live-008_issue209-live-existing-legacy-001"
          }
        }
      },
      requestId: null,
      runId: "run-cli-issue209-live-008"
    });

    expect(requestId).toBe("issue209-live-existing-legacy-001");
  });

  it("does not synthesize a conflicting request_id when caller admission_context is not derivable", () => {
    const requestId = resolveIssue209CommandRequestIdForContract({
      options: {
        issue_scope: "issue_209",
        requested_execution_mode: "live_read_limited",
        admission_context: {
          approval_admission_evidence: {
            decision_id: "gate_decision_external"
          }
        }
      },
      requestId: null,
      runId: "run-cli-issue209-live-006"
    });

    expect(requestId).toBeNull();
  });

  it("keeps caller-provided admission_context unchanged", () => {
    const options = ensureIssue209AdmissionContextForContract({
      options: {
        issue_scope: "issue_209",
        target_domain: "www.xiaohongshu.com",
        target_tab_id: 32,
        target_page: "search_result_tab",
        action_type: "read",
        requested_execution_mode: "live_read_limited",
        risk_state: "limited",
        admission_context: {
          approval_admission_evidence: {
            decision_id: "gate_decision_external",
            approval_id: "gate_appr_external"
          }
        }
      },
      runId: "run-cli-issue209-live-002",
      requestId: "issue209-live-limited-002"
    });

    expect(options.admission_context).toEqual({
      approval_admission_evidence: {
        decision_id: "gate_decision_external",
        approval_id: "gate_appr_external"
      }
    });
  });
});
