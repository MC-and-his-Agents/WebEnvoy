import "../extension.service-worker.contract.shared.js";

const ctx = (globalThis as { __webenvoyExtensionServiceWorkerContract: Record<string, any> }).__webenvoyExtensionServiceWorkerContract;
const {
  describe,
  expect,
  it,
  vi,
  startChromeBackgroundBridge,
  createMockPort,
  createChromeApi,
  respondHandshake,
  waitForBridgeTurn,
  createEditorInputProbeResult
} = ctx;

describe("extension service worker recovery contract / recovery and main-world signature", () => {
  it("returns current runtime tabs through the native bridge diagnostics path", async () => {
    const firstPort = createMockPort();
    const { chromeApi } = createChromeApi([firstPort]);
    chromeApi.tabs.query.mockImplementation(async (query: { currentWindow?: boolean; url?: string | string[] }) => {
      expect(query).toEqual({
        currentWindow: true,
        url: ["https://creator.xiaohongshu.com/*"]
      });
      return [
        {
          id: 44,
          active: true,
          url: "https://creator.xiaohongshu.com/publish/publish?from=menu&target=article"
        }
      ];
    });

    startChromeBackgroundBridge(chromeApi);
    respondHandshake(firstPort);
    await Promise.resolve();

    firstPort.onMessageListeners[0]?.({
      id: "run-runtime-tabs-001",
      method: "bridge.forward",
      profile: "xhs_208_probe",
      params: {
        session_id: "nm-session-001",
        run_id: "run-runtime-tabs-001",
        command: "runtime.tabs",
        command_params: {
          current_window_only: true,
          url_patterns: ["https://creator.xiaohongshu.com/*"]
        },
        cwd: "/workspace/WebEnvoy"
      },
      timeout_ms: 100
    });
    await Promise.resolve();

    expect(firstPort.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "run-runtime-tabs-001",
        status: "success",
        summary: expect.objectContaining({
          command: "runtime.tabs",
          relay_path: "host>background"
        }),
        payload: {
          tabs: [
            {
              tab_id: 44,
              active: true,
              url: "https://creator.xiaohongshu.com/publish/publish?from=menu&target=article"
            }
          ]
        },
        error: null
      })
    );
  });

  it("queues forwards during recovering and replays after reopen", async () => {
    vi.useFakeTimers();
    try {
      const ports = [createMockPort(), createMockPort()];
      const { chromeApi } = createChromeApi(ports);

      startChromeBackgroundBridge(chromeApi, {
        heartbeatIntervalMs: 10_000,
        recoveryRetryIntervalMs: 5,
        recoveryWindowMs: 100
      });

      respondHandshake(ports[0]);
      ports[0].onDisconnectListeners[0]?.();
      await Promise.resolve();
      vi.advanceTimersByTime(5);
      expect(chromeApi.runtime.connectNative).toHaveBeenCalledTimes(2);

      ports[1].onMessageListeners[0]?.({
        id: "queued-forward-001",
        method: "bridge.forward",
        profile: "profile-a",
        params: {
          session_id: "nm-session-001",
          run_id: "queued-forward-001",
          command: "runtime.ping",
          command_params: {},
          cwd: "/workspace/WebEnvoy"
        },
        timeout_ms: 50
      });
      await Promise.resolve();

      const queuedError = ports[1].postMessage.mock.calls.find(
        (call) => (call[0] as { id?: string }).id === "queued-forward-001"
      );
      expect(queuedError).toBeUndefined();
      expect(chromeApi.tabs.sendMessage).not.toHaveBeenCalled();

      respondHandshake(ports[1]);

      await Promise.resolve();
      await Promise.resolve();
      expect(chromeApi.tabs.sendMessage).toHaveBeenCalledWith(
        11,
        expect.objectContaining({
          id: "queued-forward-001"
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops heartbeat on disconnect and restarts it after recovery handshake", async () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    try {
      const ports = [createMockPort(), createMockPort()];
      const { chromeApi } = createChromeApi(ports);

      startChromeBackgroundBridge(chromeApi, {
        heartbeatIntervalMs: 10_000,
        recoveryRetryIntervalMs: 5,
        recoveryWindowMs: 100
      });

      respondHandshake(ports[0]);
      await Promise.resolve();

      expect(
        setIntervalSpy.mock.calls.filter(([, intervalMs]) => intervalMs === 10_000)
      ).toHaveLength(1);
      expect(
        setIntervalSpy.mock.calls.filter(([, intervalMs]) => intervalMs === 5)
      ).toHaveLength(0);

      ports[0].onDisconnectListeners[0]?.();
      await Promise.resolve();

      expect(clearIntervalSpy.mock.calls).toHaveLength(1);
      expect(
        setIntervalSpy.mock.calls.filter(([, intervalMs]) => intervalMs === 5)
      ).toHaveLength(1);

      vi.advanceTimersByTime(5);
      await Promise.resolve();
      await Promise.resolve();

      respondHandshake(ports[1]);
      await Promise.resolve();

      expect(
        setIntervalSpy.mock.calls.filter(([, intervalMs]) => intervalMs === 10_000)
      ).toHaveLength(2);
      expect(clearIntervalSpy.mock.calls).toHaveLength(2);
    } finally {
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("fails only when recovery queue exceeds limit", async () => {
    const ports = [createMockPort(), createMockPort()];
    const { chromeApi } = createChromeApi(ports);

    startChromeBackgroundBridge(chromeApi, {
      heartbeatIntervalMs: 10_000,
      recoveryRetryIntervalMs: 5,
      recoveryWindowMs: 500
    });

    respondHandshake(ports[0]);
    ports[0].onDisconnectListeners[0]?.();
    await Promise.resolve();

    for (let i = 1; i <= 6; i += 1) {
      ports[1].onMessageListeners[0]?.({
        id: `queued-overflow-${i}`,
        method: "bridge.forward",
        profile: "profile-a",
        params: {
          session_id: "nm-session-001",
          run_id: `queued-overflow-${i}`,
          command: "runtime.ping",
          command_params: {},
          cwd: "/workspace/WebEnvoy"
        },
        timeout_ms: 50
      });
    }

    await Promise.resolve();
    const overflowError = ports[1].postMessage.mock.calls.find(
      (call) => (call[0] as { id?: string }).id === "queued-overflow-6"
    );
    expect(overflowError).toBeDefined();
    expect((overflowError?.[0] as { error?: { code?: string } }).error?.code).toBe(
      "ERR_TRANSPORT_DISCONNECTED"
    );

    for (let i = 1; i <= 5; i += 1) {
      const queuedFailure = ports[1].postMessage.mock.calls.find(
        (call) => (call[0] as { id?: string }).id === `queued-overflow-${i}`
      );
      expect(queuedFailure).toBeUndefined();
    }
  });

  it("fails queued forwards when recovery window exhausts", async () => {
    vi.useFakeTimers();
    try {
      const ports = [createMockPort(), createMockPort()];
      const { chromeApi } = createChromeApi(ports);

      startChromeBackgroundBridge(chromeApi, {
        heartbeatIntervalMs: 10_000,
        recoveryRetryIntervalMs: 10,
        recoveryWindowMs: 30
      });

      respondHandshake(ports[0]);
      ports[0].onDisconnectListeners[0]?.();

      ports[1].onMessageListeners[0]?.({
        id: "queued-expire-001",
        method: "bridge.forward",
        profile: "profile-a",
        params: {
          session_id: "nm-session-001",
          run_id: "queued-expire-001",
          command: "runtime.ping",
          command_params: {},
          cwd: "/workspace/WebEnvoy"
        },
        timeout_ms: 50
      });

      vi.advanceTimersByTime(40);
      await Promise.resolve();
      await Promise.resolve();

      expect(ports[1].postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "queued-expire-001",
          status: "error",
          error: expect.objectContaining({
            code: "ERR_TRANSPORT_DISCONNECTED"
          })
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("expires short-timeout queued forward before recovery window ends", async () => {
    vi.useFakeTimers();
    try {
      const ports = [createMockPort(), createMockPort()];
      const { chromeApi } = createChromeApi(ports);

      startChromeBackgroundBridge(chromeApi, {
        heartbeatIntervalMs: 10_000,
        recoveryRetryIntervalMs: 5,
        recoveryWindowMs: 200
      });

      respondHandshake(ports[0]);
      ports[0].onDisconnectListeners[0]?.();

      ports[1].onMessageListeners[0]?.({
        id: "queued-short-timeout-001",
        method: "bridge.forward",
        profile: "profile-a",
        params: {
          session_id: "nm-session-001",
          run_id: "queued-short-timeout-001",
          command: "runtime.ping",
          command_params: {},
          cwd: "/workspace/WebEnvoy"
        },
        timeout_ms: 20
      });

      vi.advanceTimersByTime(30);
      await Promise.resolve();

      expect(ports[1].postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "queued-short-timeout-001",
          status: "error",
          error: expect.objectContaining({
            code: "ERR_TRANSPORT_TIMEOUT"
          })
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("executes xhs-sign in MAIN world through extension-private rpc", async () => {
    const firstPort = createMockPort();
    const { chromeApi, runtimeMessageListeners, executeScript } = createChromeApi([firstPort]);

    startChromeBackgroundBridge(chromeApi);

    let response: unknown;
    runtimeMessageListeners[0]?.(
      {
        kind: "xhs-sign-request",
        uri: "/api/sns/web/v1/search/notes",
        body: { keyword: "露营" }
      },
      {
        tab: {
          id: 32,
          url: "https://www.xiaohongshu.com/search_result?keyword=露营"
        }
      },
      (message) => {
        response = message;
      }
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 32 },
        world: "MAIN",
        args: ["/api/sns/web/v1/search/notes", { keyword: "露营" }]
      })
    );
    expect(response).toEqual({
      ok: true,
      result: {
        "X-s": "signed",
        "X-t": "1700000000"
      }
    });
  });

  it("rejects xhs-sign requests from non-allowlisted sender tabs", async () => {
    const firstPort = createMockPort();
    const { chromeApi, runtimeMessageListeners, executeScript } = createChromeApi([firstPort]);

    startChromeBackgroundBridge(chromeApi);

    let response: unknown;
    runtimeMessageListeners[0]?.(
      {
        kind: "xhs-sign-request",
        uri: "/api/sns/web/v1/search/notes",
        body: { keyword: "露营" }
      },
      {
        tab: {
          id: 44,
          url: "https://example.com/"
        }
      },
      (message) => {
        response = message;
      }
    );

    await Promise.resolve();

    expect(executeScript).not.toHaveBeenCalled();
    expect(response).toEqual({
      ok: false,
      error: {
        code: "ERR_XHS_SIGN_FORBIDDEN",
        message: "xhs-sign request is out of allowlist scope"
      }
    });
  });

  it("returns xhs-sign failure when MAIN world executeScript fails", async () => {
    const firstPort = createMockPort();
    const { chromeApi, runtimeMessageListeners, executeScript } = createChromeApi([firstPort]);
    executeScript.mockRejectedValueOnce(new Error("window._webmsxyw is not available"));

    startChromeBackgroundBridge(chromeApi);

    let response: unknown;
    runtimeMessageListeners[0]?.(
      {
        kind: "xhs-sign-request",
        uri: "/api/sns/web/v1/search/notes",
        body: { keyword: "露营" }
      },
      {
        tab: {
          id: 32,
          url: "https://www.xiaohongshu.com/search_result?keyword=露营"
        }
      },
      (message) => {
        response = message;
      }
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(executeScript).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      ok: false,
      error: {
        code: "ERR_XHS_SIGN_FAILED",
        message: "window._webmsxyw is not available"
      }
    });
  });
});
