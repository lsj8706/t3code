import {
  DEFAULT_BROWSER_PROFILE_ID,
  resolveBrowserProfiles,
  type BrowserProfile,
  type DesktopPreviewTabDefaults,
  type PreviewAppearancePreference,
  type PreviewViewportSetting,
  type PreviewZoomFactor,
} from "@t3tools/contracts";

import { isLoopbackHost, normalizePreviewUrl } from "@t3tools/shared/preview";

import {
  ensureClientSettingsHydrated,
  getClientSettings,
  useClientSettings,
} from "~/hooks/useSettings";

import { resolveResponsiveBrowserViewportSize } from "./browserViewportLayout";

export interface BrowserDefaults {
  readonly viewport: PreviewViewportSetting;
  /** For loopback addresses, where dev servers run; null follows `viewport`. */
  readonly localViewport: PreviewViewportSetting | null;
  readonly zoomFactor: PreviewZoomFactor;
  readonly appearance: PreviewAppearancePreference;
  readonly autoShowFloatingPreview: boolean;
  readonly profiles: ReadonlyArray<BrowserProfile>;
  readonly profileId: string;
}

const toBrowserDefaults = (settings: {
  readonly browserDefaultViewport: PreviewViewportSetting;
  readonly browserLocalDefaultViewport: PreviewViewportSetting | null;
  readonly browserDefaultZoomFactor: PreviewZoomFactor;
  readonly browserDefaultAppearance: PreviewAppearancePreference;
  readonly browserAutoShowFloatingPreview: boolean;
  readonly browserProfiles: ReadonlyArray<BrowserProfile>;
  readonly browserDefaultProfileId: string;
}): BrowserDefaults => {
  const profiles = resolveBrowserProfiles(settings.browserProfiles);
  return {
    viewport: settings.browserDefaultViewport,
    localViewport: settings.browserLocalDefaultViewport,
    zoomFactor: settings.browserDefaultZoomFactor,
    appearance: settings.browserDefaultAppearance,
    autoShowFloatingPreview: settings.browserAutoShowFloatingPreview,
    profiles,
    profileId:
      profiles.find(
        (profile) =>
          profile.id === settings.browserDefaultProfileId && profile.kind !== "incognito",
      )?.id ?? DEFAULT_BROWSER_PROFILE_ID,
  };
};

export function getBrowserDefaults(): BrowserDefaults {
  return toBrowserDefaults(getClientSettings());
}

/** New tabs retain their initial defaults, so wait for settings hydration. Read failures reject. */
export async function resolveBrowserDefaults(): Promise<BrowserDefaults> {
  await ensureClientSettingsHydrated();
  return getBrowserDefaults();
}

export function useBrowserDefaults(): BrowserDefaults {
  return useClientSettings(toBrowserDefaults);
}

function isLocalAddress(url: string): boolean {
  try {
    const { hostname } = new URL(normalizePreviewUrl(url));
    return isLoopbackHost(hostname) || hostname.endsWith(".localhost");
  } catch {
    return false;
  }
}

/** The viewport a new tab opens at for this address. */
export function browserViewportForUrl(
  defaults: Pick<BrowserDefaults, "viewport" | "localViewport">,
  url: string | undefined,
): PreviewViewportSetting {
  return defaults.localViewport !== null && url !== undefined && isLocalAddress(url)
    ? defaults.localViewport
    : defaults.viewport;
}

const sameViewport = (left: PreviewViewportSetting, right: PreviewViewportSetting) =>
  left._tag === "fill" || right._tag === "fill"
    ? left._tag === right._tag
    : left._tag === right._tag && left.width === right.width && left.height === right.height;

/**
 * A blank tab took the default viewport before it had an address. Its first address gets the
 * viewport it would have opened at, unless the user already resized it. Null keeps it.
 */
export function browserViewportForFirstNavigation(
  defaults: Pick<BrowserDefaults, "viewport" | "localViewport">,
  current: PreviewViewportSetting,
  url: string,
): PreviewViewportSetting | null {
  if (!sameViewport(current, defaults.viewport)) return null;
  const next = browserViewportForUrl(defaults, url);
  return sameViewport(next, current) ? null : next;
}

export function browserDefaultTabState(defaults: BrowserDefaults): DesktopPreviewTabDefaults {
  return { zoomFactor: defaults.zoomFactor, colorScheme: defaults.appearance };
}

const FALLBACK_RESPONSIVE_VIEWPORT_SIZE = { width: 1024, height: 768 } as const;

export function browserResponsiveViewportForToggle(input: {
  readonly defaults?: BrowserDefaults;
  readonly panelRect: { readonly width: number; readonly height: number } | null;
  readonly zoomFactor: number | undefined;
  readonly url?: string | undefined;
}): PreviewViewportSetting {
  const preferred = browserViewportForUrl(input.defaults ?? getBrowserDefaults(), input.url);
  if (preferred._tag !== "fill") return preferred;
  const size = input.panelRect
    ? resolveResponsiveBrowserViewportSize(input.panelRect, input.zoomFactor)
    : FALLBACK_RESPONSIVE_VIEWPORT_SIZE;
  return { _tag: "freeform", ...size };
}
