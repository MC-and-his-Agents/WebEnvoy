import { access, chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { CliError } from "../core/errors.js";
export const DEFAULT_NATIVE_HOST_NAME = "com.webenvoy.host";
export const DEFAULT_BROWSER_CHANNEL = "chrome";
const NATIVE_HOST_DESCRIPTION = "WebEnvoy CLI ↔ Extension bridge";
const BROWSER_CHANNELS = ["chrome", "chrome_beta", "chromium", "brave", "edge"];
export const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;
const NATIVE_HOST_NAME_PATTERN = /^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/;
const asAbsolutePath = (cwd, input) => isAbsolute(input) ? input : resolve(cwd, input);
const pathExists = async (filePath) => {
    try {
        await access(filePath);
        return true;
    }
    catch {
        return false;
    }
};
export const isBrowserChannel = (value) => BROWSER_CHANNELS.includes(value);
export const isValidExtensionId = (value) => EXTENSION_ID_PATTERN.test(value);
export const isValidNativeHostName = (value) => NATIVE_HOST_NAME_PATTERN.test(value);
const resolveDefaultManifestDirectory = (browserChannel) => {
    if (process.platform === "darwin") {
        const baseByChannel = {
            chrome: join(homedir(), "Library", "Application Support", "Google", "Chrome"),
            chrome_beta: join(homedir(), "Library", "Application Support", "Google", "Chrome Beta"),
            chromium: join(homedir(), "Library", "Application Support", "Chromium"),
            brave: join(homedir(), "Library", "Application Support", "BraveSoftware", "Brave-Browser"),
            edge: join(homedir(), "Library", "Application Support", "Microsoft Edge")
        };
        return join(baseByChannel[browserChannel], "NativeMessagingHosts");
    }
    if (process.platform === "linux") {
        const baseByChannel = {
            chrome: join(homedir(), ".config", "google-chrome"),
            chrome_beta: join(homedir(), ".config", "google-chrome-beta"),
            chromium: join(homedir(), ".config", "chromium"),
            brave: join(homedir(), ".config", "BraveSoftware", "Brave-Browser"),
            edge: join(homedir(), ".config", "microsoft-edge")
        };
        return join(baseByChannel[browserChannel], "NativeMessagingHosts");
    }
    throw new CliError("ERR_RUNTIME_UNAVAILABLE", "runtime.install 当前仅支持 darwin/linux", {
        retryable: false
    });
};
const buildLauncherScript = (hostCommand) => `#!/usr/bin/env bash
set -euo pipefail
exec ${hostCommand} "$@"
`;
const resolveInstallPaths = (input) => {
    const manifestDir = typeof input.manifestDir === "string" && input.manifestDir.length > 0
        ? asAbsolutePath(input.cwd, input.manifestDir)
        : resolveDefaultManifestDirectory(input.browserChannel);
    const manifestPath = join(manifestDir, `${input.nativeHostName}.json`);
    const launcherPath = typeof input.launcherPath === "string" && input.launcherPath.length > 0
        ? asAbsolutePath(input.cwd, input.launcherPath)
        : join(manifestDir, `${input.nativeHostName}-launcher`);
    return {
        manifestDir,
        manifestPath,
        launcherPath
    };
};
export const installNativeHost = async (input) => {
    const resolvedPaths = resolveInstallPaths({
        cwd: input.cwd,
        nativeHostName: input.nativeHostName,
        browserChannel: input.browserChannel,
        manifestDir: input.manifestDir,
        launcherPath: input.launcherPath
    });
    const allowedOrigin = `chrome-extension://${input.extensionId}/`;
    await mkdir(resolvedPaths.manifestDir, { recursive: true });
    await mkdir(dirname(resolvedPaths.launcherPath), { recursive: true });
    await writeFile(resolvedPaths.launcherPath, buildLauncherScript(input.hostCommand), "utf8");
    await chmod(resolvedPaths.launcherPath, 0o755);
    const manifest = {
        name: input.nativeHostName,
        description: NATIVE_HOST_DESCRIPTION,
        path: resolvedPaths.launcherPath,
        type: "stdio",
        allowed_origins: [allowedOrigin]
    };
    await writeFile(resolvedPaths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return {
        operation: "install",
        native_host_name: input.nativeHostName,
        browser_channel: input.browserChannel,
        extension_id: input.extensionId,
        manifest_path: resolvedPaths.manifestPath,
        launcher_path: resolvedPaths.launcherPath,
        host_command: input.hostCommand,
        allowed_origins: [allowedOrigin],
        created: {
            manifest: true,
            launcher: true
        }
    };
};
export const uninstallNativeHost = async (input) => {
    const resolvedPaths = resolveInstallPaths({
        cwd: input.cwd,
        nativeHostName: input.nativeHostName,
        browserChannel: input.browserChannel,
        manifestDir: input.manifestDir,
        launcherPath: input.launcherPath
    });
    const manifestExisted = await pathExists(resolvedPaths.manifestPath);
    const launcherExisted = await pathExists(resolvedPaths.launcherPath);
    await rm(resolvedPaths.manifestPath, { force: true });
    await rm(resolvedPaths.launcherPath, { force: true });
    return {
        operation: "uninstall",
        native_host_name: input.nativeHostName,
        browser_channel: input.browserChannel,
        manifest_path: resolvedPaths.manifestPath,
        launcher_path: resolvedPaths.launcherPath,
        removed: {
            manifest: manifestExisted,
            launcher: launcherExisted
        }
    };
};
