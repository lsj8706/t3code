import { describe, expect, it, vi } from "vite-plus/test";
import { DEFAULT_BROWSER_PROFILE_ID, INCOGNITO_BROWSER_PROFILE_ID } from "@t3tools/contracts";

const settings = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("~/hooks/useSettings", () => ({
  getClientSettings: () => settings.current,
  useClientSettings: () => undefined,
  ensureClientSettingsHydrated: vi.fn(async () => undefined),
}));

const { browserViewportForFirstNavigation, browserViewportForUrl, getBrowserDefaults } =
  await import("./browserDefaults");

const withDefaultProfile = (browserDefaultProfileId: string) => {
  settings.current = {
    browserDefaultViewport: { _tag: "fill" },
    browserDefaultZoomFactor: 1,
    browserDefaultAppearance: "system",
    browserAutoShowFloatingPreview: true,
    browserProfiles: [{ id: "work", name: "Work", kind: "persistent" }],
    browserDefaultProfileId,
  };
  return getBrowserDefaults();
};

describe("getBrowserDefaults profile resolution", () => {
  it("refuses incognito as the default", () => {
    expect(withDefaultProfile(INCOGNITO_BROWSER_PROFILE_ID).profileId).toBe(
      DEFAULT_BROWSER_PROFILE_ID,
    );
  });
});

describe("browserViewportForUrl", () => {
  const fill = { _tag: "fill" } as const;
  const phone = { _tag: "freeform", width: 390, height: 844 } as const;
  const defaults = { viewport: fill, localViewport: phone };

  it.each([
    ["http://localhost:5173/app", phone],
    ["localhost:3000", phone],
    ["http://127.0.0.1:8080", phone],
    ["http://[::1]:4000", phone],
    ["http://web.localhost:3000", phone],
    ["https://github.com/org/repo/pull/1", fill],
    ["https://localhost.example.com", fill],
    ["not a url", fill],
    [undefined, fill],
  ])("opens %s at its address's viewport", (url, expected) => {
    expect(browserViewportForUrl(defaults, url)).toEqual(expected);
  });

  it("follows the default viewport when no local viewport is set", () => {
    expect(browserViewportForUrl({ viewport: fill, localViewport: null }, "localhost:3000")).toBe(
      fill,
    );
  });

  it("resizes a blank tab on its first local address unless the user resized it", () => {
    expect(browserViewportForFirstNavigation(defaults, fill, "localhost:3000")).toEqual(phone);
    expect(browserViewportForFirstNavigation(defaults, fill, "https://github.com")).toBeNull();
    const resized = { _tag: "freeform", width: 800, height: 600 } as const;
    expect(browserViewportForFirstNavigation(defaults, resized, "localhost:3000")).toBeNull();
  });
});
