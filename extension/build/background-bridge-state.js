export class PendingRequestState {
    #pending = new Map();
    register(id, pending) {
        this.#pending.set(id, pending);
    }
    take(id) {
        const pending = this.#pending.get(id);
        if (!pending) {
            return null;
        }
        clearTimeout(pending.timeout);
        this.#pending.delete(id);
        return pending;
    }
    fail(id, error, emit) {
        const pending = this.take(id);
        if (!pending || pending.suppressHostResponse) {
            return;
        }
        emit({
            id,
            status: "error",
            summary: {
                relay_path: "host>background>content-script>background>host"
            },
            error
        });
    }
    failAll(error, emit) {
        for (const id of [...this.#pending.keys()]) {
            this.fail(id, error, emit);
        }
    }
}
export class RecoveryQueueState {
    hooks;
    maxQueueSize;
    resolveTimeoutMs;
    resolveRequestId;
    #queue = [];
    constructor(hooks, maxQueueSize, resolveTimeoutMs, resolveRequestId) {
        this.hooks = hooks;
        this.maxQueueSize = maxQueueSize;
        this.resolveTimeoutMs = resolveTimeoutMs;
        this.resolveRequestId = resolveRequestId;
    }
    queueRequest(request) {
        const timeoutMs = this.resolveTimeoutMs(request);
        const deadlineMs = Date.now() + timeoutMs;
        if (Date.now() >= deadlineMs) {
            this.hooks.emit(this.#createTimeoutResponse(request));
            return;
        }
        if (this.#queue.length >= this.maxQueueSize) {
            this.hooks.emit({
                id: this.resolveRequestId(request),
                status: "error",
                summary: {
                    relay_path: "host>background>content-script>background>host"
                },
                error: {
                    code: "ERR_TRANSPORT_DISCONNECTED",
                    message: `recovery queue exhausted (${this.maxQueueSize})`
                }
            });
            return;
        }
        this.#queue.push({ request, deadlineMs });
    }
    async replayQueuedRequests(dispatchRequest) {
        if (this.#queue.length === 0) {
            return;
        }
        this.expireQueuedRequests(Date.now());
        const queued = [...this.#queue];
        this.#queue.length = 0;
        for (const entry of queued) {
            if (Date.now() >= entry.deadlineMs) {
                this.hooks.emit(this.#createTimeoutResponse(entry.request));
                continue;
            }
            if (this.hooks.getState() !== "ready") {
                this.#queue.push(entry);
                continue;
            }
            await dispatchRequest(entry.request, entry.deadlineMs);
        }
    }
    failQueue(message) {
        const queued = [...this.#queue];
        this.#queue.length = 0;
        for (const entry of queued) {
            this.hooks.emit({
                id: this.resolveRequestId(entry.request),
                status: "error",
                summary: {
                    relay_path: "host>background>content-script>background>host"
                },
                error: {
                    code: "ERR_TRANSPORT_DISCONNECTED",
                    message
                }
            });
        }
    }
    expireQueuedRequests(nowMs) {
        if (this.#queue.length === 0) {
            return;
        }
        const keep = [];
        for (const entry of this.#queue) {
            if (nowMs < entry.deadlineMs) {
                keep.push(entry);
                continue;
            }
            this.hooks.emit(this.#createTimeoutResponse(entry.request));
        }
        this.#queue = keep;
    }
    #createTimeoutResponse(request) {
        return {
            id: this.resolveRequestId(request),
            status: "error",
            summary: {
                relay_path: "host>background>content-script>background>host"
            },
            error: {
                code: "ERR_TRANSPORT_TIMEOUT",
                message: "forward request timed out during recovery"
            }
        };
    }
}
