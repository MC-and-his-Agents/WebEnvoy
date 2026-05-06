const asObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const asString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const asStringArray = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
const blocker = (blockerLayer, blockerCode, requiredRecoveryAction) => ({
    blocker_layer: blockerLayer,
    blocker_code: blockerCode,
    required_recovery_action: requiredRecoveryAction
});
const isCloseoutRhythmAllowed = (rhythmState) => rhythmState === "not_required" || rhythmState === "single_probe_passed";
export const buildCloseoutGateAggregator = (input) => {
    const status = input.status;
    const params = input.params ?? {};
    const identityPreflight = asObject(status.identityPreflight);
    const accountSafety = asObject(status.account_safety);
    const closeoutRhythm = asObject(status.xhs_closeout_rhythm);
    const validationView = input.antiDetectionValidationView ?? null;
    const identityPreflightMode = asString(identityPreflight?.mode);
    const accountSafetyState = asString(accountSafety?.state);
    const rhythmState = asString(closeoutRhythm?.state);
    const validationReady = validationView?.all_required_ready === true;
    const gateState = {
        profile_ref: asString(status.profile),
        run_id: asString(status.runId),
        requested_execution_mode: asString(params.requested_execution_mode),
        identity_preflight_mode: identityPreflightMode,
        account_safety_state: accountSafetyState,
        xhs_closeout_rhythm_state: rhythmState,
        anti_detection_validation_ready: validationReady,
        anti_detection_missing_target_fr_refs: asStringArray(validationView?.missing_target_fr_refs),
        runtime_decision: input.runtimePreflight.decision,
        runtime_recovery_mode: input.runtimePreflight.recovery_mode,
        target_binding_state: input.runtimePreflight.target_binding.state,
        execution_surface: input.runtimePreflight.runtime_status.execution_surface,
        headless: input.runtimePreflight.runtime_status.headless
    };
    if (identityPreflightMode !== "official_chrome_persistent_extension") {
        return {
            decision: "NO_GO",
            blocker: blocker("profile_binding", "managed_profile_mismatch", "bind_webenvoy_managed_official_chrome_profile"),
            gate_state: gateState
        };
    }
    if (accountSafetyState !== "clear") {
        return {
            decision: "NO_GO",
            blocker: blocker("account_safety", "account_safety_not_clear", "hard_stop_and_restore_account_safety_clear_state"),
            gate_state: gateState
        };
    }
    if (!isCloseoutRhythmAllowed(rhythmState)) {
        return {
            decision: "NO_GO",
            blocker: blocker("rhythm", "xhs_closeout_rhythm_blocked", "wait_for_or_complete_allowed_closeout_rhythm_window"),
            gate_state: gateState
        };
    }
    if (input.runtimePreflight.target_binding.state !== "verified") {
        return {
            decision: "NO_GO",
            blocker: blocker("target_binding", "target_mismatch", "restore_or_rebind_managed_target_tab"),
            gate_state: gateState
        };
    }
    if (input.runtimePreflight.runtime_status.execution_surface !== "real_browser" ||
        input.runtimePreflight.runtime_status.headless !== false) {
        return {
            decision: "NO_GO",
            blocker: blocker("runtime_readiness", "execution_surface_blocked", "restart_official_chrome_real_browser_headful"),
            gate_state: gateState
        };
    }
    if (input.runtimePreflight.decision === "RECOVERABLE") {
        return {
            decision: "NO_GO",
            blocker: blocker("runtime_readiness", "runtime_recovery_required", "recover_runtime_then_rerun_closeout_gate"),
            gate_state: gateState
        };
    }
    if (input.runtimePreflight.decision !== "GO") {
        const runtimeBlockerCode = input.runtimePreflight.blocker?.blocker_code ?? "runtime_not_ready";
        return {
            decision: "NO_GO",
            blocker: blocker("runtime_readiness", runtimeBlockerCode, input.runtimePreflight.blocker?.required_recovery_action ??
                "start_or_restore_official_chrome_runtime"),
            gate_state: gateState
        };
    }
    if (!validationReady) {
        return {
            decision: "NO_GO",
            blocker: blocker("anti_detection_validation", "anti_detection_validation_baseline_blocked", "complete_fr_0012_fr_0013_fr_0014_validation_baseline"),
            gate_state: gateState
        };
    }
    return {
        decision: "GO",
        blocker: null,
        gate_state: gateState
    };
};
