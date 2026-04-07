export const browserStateFromProfileState = (profileState, lockHeld) => {
    if (!lockHeld) {
        if (profileState === "disconnected") {
            return "disconnected";
        }
        return "absent";
    }
    if (profileState === "starting") {
        return "starting";
    }
    if (profileState === "logging_in") {
        return "logging_in";
    }
    if (profileState === "stopping") {
        return "stopping";
    }
    if (profileState === "disconnected") {
        return "disconnected";
    }
    return "ready";
};
export const buildRuntimeReadiness = (input) => {
    if (input.identityBindingState === "mismatch" || input.identityBindingState === "missing") {
        return "blocked";
    }
    if (!input.lockHeld) {
        return input.transportState === "disconnected" ? "recoverable" : "blocked";
    }
    if (input.identityBindingState === "bound" &&
        input.transportState === "ready" &&
        input.bootstrapState === "ready") {
        return "ready";
    }
    if (input.transportState === "disconnected") {
        return "recoverable";
    }
    if (input.identityBindingState === "bound" &&
        (input.bootstrapState === "pending" || input.bootstrapState === "not_started")) {
        return "pending";
    }
    if (input.bootstrapState === "failed") {
        return "recoverable";
    }
    if (input.bootstrapState === "stale") {
        return "blocked";
    }
    return "unknown";
};
export const mapTransportErrorToReadiness = (error) => {
    const details = {
        code: error.code,
        message: error.message
    };
    if (error.code === "ERR_TRANSPORT_HANDSHAKE_FAILED") {
        return {
            transportState: "not_connected",
            bootstrapState: "not_started",
            runtimeReadiness: "recoverable",
            details
        };
    }
    return {
        transportState: "disconnected",
        bootstrapState: "not_started",
        runtimeReadiness: "recoverable",
        details
    };
};
export const mapBootstrapCliErrorToReadiness = (error, identityBindingState = "bound") => {
    const details = {
        code: error.code,
        message: error.message
    };
    switch (error.code) {
        case "ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED":
            return {
                identityBindingState,
                transportState: "ready",
                bootstrapState: "pending",
                runtimeReadiness: "pending",
                details
            };
        case "ERR_RUNTIME_BOOTSTRAP_ACK_TIMEOUT":
            return {
                identityBindingState,
                transportState: "ready",
                bootstrapState: "pending",
                runtimeReadiness: "recoverable",
                details
            };
        case "ERR_RUNTIME_BOOTSTRAP_ACK_STALE":
            return {
                identityBindingState,
                transportState: "ready",
                bootstrapState: "stale",
                runtimeReadiness: "blocked",
                details
            };
        case "ERR_RUNTIME_BOOTSTRAP_IDENTITY_MISMATCH":
            return {
                identityBindingState: "mismatch",
                transportState: "ready",
                bootstrapState: "failed",
                runtimeReadiness: "blocked",
                details
            };
        case "ERR_RUNTIME_READY_SIGNAL_CONFLICT":
            return {
                identityBindingState,
                transportState: "ready",
                bootstrapState: "failed",
                runtimeReadiness: "unknown",
                details
            };
        default:
            return {
                identityBindingState,
                transportState: "ready",
                bootstrapState: "failed",
                runtimeReadiness: "recoverable",
                details
            };
    }
};
export const buildNonPersistentRuntimeReadiness = (input) => {
    const transportState = input.lockHeld && input.profileState === "ready" ? "ready" : "not_connected";
    const bootstrapState = input.lockHeld && input.profileState === "ready" ? "ready" : "not_started";
    return {
        identityBindingState: input.identityBindingState,
        transportState,
        bootstrapState,
        runtimeReadiness: input.lockHeld && input.profileState === "ready" ? "ready" : "unknown"
    };
};
export const buildUnlockedPersistentRuntimeReadiness = (input) => {
    const transportState = input.profileState === "disconnected" ? "disconnected" : "not_connected";
    const bootstrapState = input.identityBindingState === "bound" && transportState === "disconnected"
        ? "pending"
        : "not_started";
    return {
        identityBindingState: input.identityBindingState,
        transportState,
        bootstrapState,
        runtimeReadiness: buildRuntimeReadiness({
            lockHeld: false,
            identityBindingState: input.identityBindingState,
            transportState,
            bootstrapState
        })
    };
};
export const buildBoundlessRuntimeReadiness = (input) => {
    const transportState = "not_connected";
    const bootstrapState = "not_started";
    return {
        identityBindingState: input.identityBindingState,
        transportState,
        bootstrapState,
        runtimeReadiness: buildRuntimeReadiness({
            lockHeld: input.lockHeld,
            identityBindingState: input.identityBindingState,
            transportState,
            bootstrapState
        })
    };
};
export const mapRuntimeReadinessPayload = (input) => {
    const transportState = input.payload?.transport_state === "disconnected"
        ? "disconnected"
        : input.payload?.transport_state === "ready"
            ? "ready"
            : "not_connected";
    const bootstrapState = input.payload?.bootstrap_state === "not_started" ||
        input.payload?.bootstrap_state === "pending" ||
        input.payload?.bootstrap_state === "ready" ||
        input.payload?.bootstrap_state === "stale" ||
        input.payload?.bootstrap_state === "failed"
        ? input.payload.bootstrap_state
        : "not_started";
    return {
        identityBindingState: input.identityBindingState,
        transportState,
        bootstrapState,
        runtimeReadiness: buildRuntimeReadiness({
            lockHeld: input.lockHeld,
            identityBindingState: input.identityBindingState,
            transportState,
            bootstrapState
        }),
        details: input.payload ? input.payload : undefined
    };
};
