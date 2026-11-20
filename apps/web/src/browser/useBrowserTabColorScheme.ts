import type { DesktopPreviewColorScheme, ScopedThreadRef } from "@t3tools/contracts";

import { previewBridge } from "~/components/preview/previewBridge";
import { updatePreviewServerSnapshot, useThreadPreviewState } from "~/previewStateStore";
import { previewEnvironment } from "~/state/preview";
import { useAtomCommand } from "~/state/use-atom-command";

/** A tab's color scheme and its setter: the server owns server-driven tabs, Electron the rest. */
export function useBrowserTabColorScheme(input: {
  readonly threadRef: ScopedThreadRef;
  readonly tabId: string;
  readonly runtimeTabId: string;
  readonly serverColorScheme: DesktopPreviewColorScheme | undefined;
}) {
  const { threadRef, tabId, runtimeTabId, serverColorScheme } = input;
  const desktopColorScheme = useThreadPreviewState(threadRef).desktopByTabId[tabId]?.colorScheme;
  const adjust = useAtomCommand(previewEnvironment.adjust, "preview appearance or zoom");
  const setColorScheme = (colorScheme: DesktopPreviewColorScheme) => {
    if (serverColorScheme === undefined) {
      void previewBridge?.setColorScheme(runtimeTabId, colorScheme).catch(() => undefined);
      return;
    }
    void adjust({
      environmentId: threadRef.environmentId,
      input: { threadId: threadRef.threadId, tabId, colorScheme },
    }).then((result) => {
      if (result._tag === "Success") updatePreviewServerSnapshot(threadRef, result.value);
    });
  };
  return {
    colorScheme: serverColorScheme ?? desktopColorScheme ?? "system",
    setColorScheme,
  };
}
