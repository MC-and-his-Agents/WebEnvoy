import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../native-host-platform.js", async () => {
  const actual = await vi.importActual<typeof import("../native-host-platform.js")>(
    "../native-host-platform.js"
  );

  return {
    ...actual,
    resolveManifestDiscoveryDirectory: vi.fn(() => {
      throw new Error("resolveManifestDiscoveryDirectory must not run on win32");
    })
  };
});

const { resolveInstallPaths } = await import("../native-host-paths.js");

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

const createTempCwd = async (): Promise<string> => {
  const cwd = await mkdtemp(join(tmpdir(), "webenvoy-native-host-paths-win32-"));
  tempDirs.push(cwd);
  return cwd;
};

describe("native-host-paths win32 guard", () => {
  it("keeps win32 install path resolution away from browser-default discovery when manifest_dir is omitted", async () => {
    const cwd = await createTempCwd();

    const resolved = resolveInstallPaths({
      command: "runtime.install",
      cwd,
      nativeHostName: "com.webenvoy.host",
      browserChannel: "chrome",
      platform: "win32"
    });

    expect(resolved.manifestDir).toBe(resolved.manifestRoot);
    expect(resolved.manifestPath).toBe(join(resolved.manifestRoot, "com.webenvoy.host.json"));
  });

  it("keeps win32 uninstall path resolution away from browser-default discovery when manifest_dir is explicit", async () => {
    const cwd = await createTempCwd();
    const manifestDir = join(cwd, "custom-manifests");

    const resolved = resolveInstallPaths({
      command: "runtime.uninstall",
      cwd,
      nativeHostName: "com.webenvoy.host",
      browserChannel: "chrome",
      manifestDir,
      platform: "win32"
    });

    expect(resolved.manifestDir).toBe(manifestDir);
    expect(resolved.manifestPath).toBe(join(manifestDir, "com.webenvoy.host.json"));
  });
});
