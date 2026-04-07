import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { CliError } from "../core/errors.js";

export const DEFAULT_NATIVE_HOST_NAME = "com.webenvoy.host";
export const DEFAULT_BROWSER_CHANNEL = "chrome";

export const BROWSER_CHANNELS = ["chrome", "chrome_beta", "chromium", "brave", "edge"] as const;
export type BrowserChannel = (typeof BROWSER_CHANNELS)[number];

export const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;
const NATIVE_HOST_NAME_PATTERN = /^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/;

export const isBrowserChannel = (value: string): value is BrowserChannel =>
  BROWSER_CHANNELS.includes(value as BrowserChannel);

export const isValidExtensionId = (value: string): boolean => EXTENSION_ID_PATTERN.test(value);

export const isValidNativeHostName = (value: string): boolean =>
  NATIVE_HOST_NAME_PATTERN.test(value);

const resolveDefaultManifestDirectory = (browserChannel: BrowserChannel, platform: NodeJS.Platform): string => {
  if (platform === "darwin") {
    const baseByChannel: Record<BrowserChannel, string> = {
      chrome: join(homedir(), "Library", "Application Support", "Google", "Chrome"),
      chrome_beta: join(homedir(), "Library", "Application Support", "Google", "Chrome Beta"),
      chromium: join(homedir(), "Library", "Application Support", "Chromium"),
      brave: join(
        homedir(),
        "Library",
        "Application Support",
        "BraveSoftware",
        "Brave-Browser"
      ),
      edge: join(homedir(), "Library", "Application Support", "Microsoft Edge")
    };
    return join(baseByChannel[browserChannel], "NativeMessagingHosts");
  }

  if (platform === "linux") {
    const baseByChannel: Record<BrowserChannel, string> = {
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

const resolveManifestDirectoryOverride = (): string | null => {
  const override = process.env.WEBENVOY_NATIVE_HOST_MANIFEST_DIR;
  if (typeof override !== "string" || override.trim().length === 0) {
    return null;
  }
  return resolve(override.trim());
};

export const resolveManifestDiscoveryDirectory = (
  browserChannel: BrowserChannel,
  platform: NodeJS.Platform = process.platform
): string => resolveManifestDirectoryOverride() ?? resolveDefaultManifestDirectory(browserChannel, platform);

export const resolveManifestPathForChannel = (
  browserChannel: BrowserChannel,
  nativeHostName: string,
  platform: NodeJS.Platform = process.platform
): string => join(resolveManifestDiscoveryDirectory(browserChannel, platform), `${nativeHostName}.json`);
