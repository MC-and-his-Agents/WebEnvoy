import { describe, expect, it, vi } from "vitest";

import {
  buildOfficialChromeRuntimeStatusParams,
  prepareOfficialChromeRuntime
} from "../official-chrome-runtime.js";

describe("prepareOfficialChromeRuntime", () => {
  it("forwards persistent extension identity into runtime.status params", () => {
    expect(
      buildOfficialChromeRuntimeStatusParams(
        {
          cwd: "/tmp/webenvoy",
          profile: "official_ready_profile",
          run_id: "run-runtime-ready-identity-001",
          command: "runtime.prepare",
          params: {
            persistentExtensionIdentity: {
              extensionId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              manifestPath: "/tmp/native-host-manifest.json"
            }
          }
        },
        "live_read_high_risk"
      )
    ).toMatchObject({
      requested_execution_mode: "live_read_high_risk",
      persistent_extension_identity: {
        extensionId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        manifestPath: "/tmp/native-host-manifest.json"
      }
    });
  });

  it("converges pending bootstrap to ready through the shared runtime contract", async () => {
    const readStatus = vi
      .fn()
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        profileState: "ready",
        runtimeReadiness: "pending",
        identityBindingState: "bound",
        bootstrapState: "pending",
        transportState: "ready",
        lockHeld: true
      })
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        profileState: "ready",
        runtimeReadiness: "ready",
        identityBindingState: "bound",
        bootstrapState: "ready",
        transportState: "ready",
        lockHeld: true
      });
    const bridge = {
      runCommand: vi.fn(async (request: { params: { runtime_context_id: string } }) => ({
        ok: true,
        payload: {
          result: {
            version: "v1",
            run_id: "run-runtime-ready-001",
            runtime_context_id: request.params.runtime_context_id,
            profile: "official_ready_profile",
            status: "ready"
          }
        },
        error: null
      }))
    };

    await expect(
      prepareOfficialChromeRuntime({
        context: {
          cwd: "/tmp/webenvoy",
          profile: "official_ready_profile",
          run_id: "run-runtime-ready-001",
          command: "runtime.prepare",
          params: {}
        } as never,
        consumerId: "runtime.prepare",
        requestedExecutionMode: "live_read_high_risk",
        bridge: bridge as never,
        fingerprintContext: {
          fingerprint_profile_bundle: null
        } as never,
        readStatus
      })
    ).resolves.toMatchObject({
      runtimeReadiness: "ready",
      identityBindingState: "bound",
      bootstrapState: "ready",
      transportState: "ready",
      lockHeld: true
    });

    expect(bridge.runCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "runtime.bootstrap",
        params: expect.objectContaining({
          run_id: "run-runtime-ready-001",
          profile: "official_ready_profile"
        })
      })
    );
  });

  it("waits for bridge readiness when bootstrap is initially not delivered", async () => {
    const readStatus = vi
      .fn()
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        profileState: "ready",
        runtimeReadiness: "pending",
        identityBindingState: "bound",
        bootstrapState: "pending",
        transportState: "ready",
        lockHeld: true
      })
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        profileState: "ready",
        runtimeReadiness: "pending",
        identityBindingState: "bound",
        bootstrapState: "pending",
        transportState: "ready",
        lockHeld: true
      });
    const bridge = {
      runCommand: vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          error: {
            code: "ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED",
            message: "runtime bootstrap 尚未获得执行面确认"
          }
        })
        .mockResolvedValueOnce({
          ok: true,
          payload: {
            transport_state: "ready",
            bootstrap_state: "pending"
          },
          error: null
        })
        .mockResolvedValueOnce({
          ok: true,
          payload: {
            transport_state: "ready",
            bootstrap_state: "ready"
          },
          error: null
        })
    };

    await expect(
      prepareOfficialChromeRuntime({
        context: {
          cwd: "/tmp/webenvoy",
          profile: "official_first_prepare_profile",
          run_id: "run-runtime-first-prepare-001",
          command: "runtime.prepare",
          params: {}
        } as never,
        consumerId: "runtime.prepare",
        requestedExecutionMode: "live_read_high_risk",
        bridge: bridge as never,
        fingerprintContext: {
          fingerprint_profile_bundle: null
        } as never,
        readStatus
      })
    ).resolves.toMatchObject({
      runtimeReadiness: "ready",
      bootstrapState: "ready",
      transportState: "ready"
    });

    expect(bridge.runCommand).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        command: "runtime.bootstrap"
      })
    );
    expect(bridge.runCommand).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        command: "runtime.readiness"
      })
    );
    expect(bridge.runCommand).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        command: "runtime.readiness"
      })
    );
  });

  it("keeps runtime blocked when the profile lock is lost before final convergence", async () => {
    const readStatus = vi
      .fn()
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        profileState: "ready",
        runtimeReadiness: "pending",
        identityBindingState: "bound",
        bootstrapState: "pending",
        transportState: "ready",
        lockHeld: true
      })
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        profileState: "ready",
        runtimeReadiness: "blocked",
        identityBindingState: "bound",
        bootstrapState: "ready",
        transportState: "ready",
        lockHeld: false
      });
    const bridge = {
      runCommand: vi.fn(async (request: { params: { runtime_context_id: string } }) => ({
        ok: true,
        payload: {
          result: {
            version: "v1",
            run_id: "run-runtime-lock-lost-001",
            runtime_context_id: request.params.runtime_context_id,
            profile: "official_lock_lost_profile",
            status: "ready"
          }
        },
        error: null
      }))
    };

    await expect(
      prepareOfficialChromeRuntime({
        context: {
          cwd: "/tmp/webenvoy",
          profile: "official_lock_lost_profile",
          run_id: "run-runtime-lock-lost-001",
          command: "runtime.prepare",
          params: {}
        } as never,
        consumerId: "runtime.prepare",
        requestedExecutionMode: "live_read_high_risk",
        bridge: bridge as never,
        fingerprintContext: {
          fingerprint_profile_bundle: null
        } as never,
        readStatus
      })
    ).rejects.toMatchObject({
      code: "ERR_PROFILE_LOCKED",
      details: expect.objectContaining({
        runtime_readiness: "blocked",
        bootstrap_state: "ready",
        transport_state: "ready",
        lock_held: false,
        reason: "ERR_PROFILE_LOCKED"
      })
    });
  });
});
