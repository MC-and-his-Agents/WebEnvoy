import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  readPersistentExtensionBindingFromMetaValue
} from "../persistent-extension-binding.js";

describe("readPersistentExtensionBindingFromMetaValue", () => {
  it("normalizes a persisted relative manifestPath to an absolute path", () => {
    const relativeManifestPath = "profiles/identity/com.webenvoy.host.json";

    const binding = readPersistentExtensionBindingFromMetaValue({
      extensionId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      nativeHostName: "com.webenvoy.host",
      browserChannel: "chrome",
      manifestPath: relativeManifestPath
    });

    expect(binding).toMatchObject({
      extensionId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      nativeHostName: "com.webenvoy.host",
      browserChannel: "chrome",
      manifestPath: resolve(relativeManifestPath)
    });
  });
});
