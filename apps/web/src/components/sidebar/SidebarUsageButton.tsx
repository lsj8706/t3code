import { useAtomValue } from "@effect/atom-react";
import { refreshUsageLimits } from "@t3tools/client-runtime/state/usage";
import {
  collectLimitAccounts,
  collectLimitPools,
  displayLimitWindows,
  providersWithLimits,
} from "@t3tools/shared/usageLimits";
import { cursorUsageWindowDetails } from "@t3tools/shared/usageLimitsCopy";
import { ChartNoAxesColumnIcon } from "lucide-react";
import { useState } from "react";
import { useGT, useMessages } from "gt-react";

import { appAtomRegistry } from "~/rpc/atomRegistry";
import { environmentPresentations } from "../../state/presentation";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { providerClients } from "../settings/providerDriverMeta";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "../ui/preview-card";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { readUsagePagePreferences } from "../usage/usagePagePreferences";
import { PROVIDER_PRESENTATION } from "../usage/usageProviders";

function SidebarUsageLimits() {
  const gt = useGT();
  const m = useMessages();
  const presentations = useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
  const [openedAt] = useState(Date.now);
  const [preferences] = useState(readUsagePagePreferences);
  const hidden = new Set(
    preferences.hiddenProviders?.map((p) => PROVIDER_PRESENTATION[p].driverKind),
  );
  const pools = collectLimitPools(collectLimitAccounts(presentations), openedAt);
  const byDriver = new Map(pools.map((pool) => [pool.driver, pool]));
  const drivers = new Set(byDriver.keys());
  for (const { serverConfig } of presentations.values()) {
    for (const provider of providersWithLimits(serverConfig?.providers ?? []))
      drivers.add(provider.driver);
    for (const source of serverConfig?.usageLimitSources ?? []) {
      for (const account of source.accounts) drivers.add(account.driver);
    }
  }
  const visible = [...drivers].filter((driver) => !hidden.has(driver));
  return (
    <div className="max-h-[min(60vh,var(--available-height))] space-y-3 overflow-y-auto p-3">
      <h2 className="text-xs font-medium text-muted-foreground">{gt("Usage limits")}</h2>
      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">{gt("No limits reported.")}</p>
      )}
      {visible.map((driver) => {
        const label = providerClients.get(driver)?.label ?? driver;
        const pool = byDriver.get(driver);
        const windows = pool ? displayLimitWindows(pool) : [];
        return (
          <section key={driver} className="space-y-1.5">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <ProviderInstanceIcon
                driverKind={driver}
                displayName={label}
                indicatorBackground="var(--popover)"
                className="size-4"
                iconClassName="size-4"
              />
              {label}
            </h3>
            {windows.length === 0 && (
              <p className="text-xs text-muted-foreground">{gt("No limits reported.")}</p>
            )}
            {windows.map((window) => (
              <div
                key={`${window.kind}:${window.id}`}
                className="grid grid-cols-[minmax(0,1fr)_4rem_auto] items-center gap-2 text-xs"
              >
                <span className="min-w-0 break-words">
                  {window.label === "Session" &&
                  window.members.every(({ window }) => window.windowDurationMins === 300)
                    ? gt("{hours}h", { hours: 5 })
                    : driver === "cursor" && pool
                      ? (cursorUsageWindowDetails(window.id, pool, m)?.label ?? window.label)
                      : window.label}
                </span>
                <span aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-foreground/65"
                    style={{ width: `${window.remainingPercent}%` }}
                  />
                </span>
                <span className="text-end tabular-nums">
                  {gt("{left}% left", { left: window.remainingPercent })}
                </span>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

export function SidebarUsageButton({ onClick }: { onClick: () => void }) {
  const gt = useGT();
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  const onOpenChange = (open: boolean) => {
    if (!open) return;
    const presentations = appAtomRegistry.get(environmentPresentations.presentationsAtom);
    void Promise.allSettled(
      [...presentations].flatMap(([environmentId, presentation]) =>
        presentation.connection.phase === "connected" && presentation.serverConfig
          ? [
              refreshUsageLimits(
                environmentId,
                () => refreshProviders({ environmentId, input: {} }),
                true,
              ),
            ]
          : [],
      ),
    );
  };
  return (
    <SidebarMenuItem className="shrink-0">
      <PreviewCard onOpenChange={onOpenChange}>
        <PreviewCardTrigger
          delay={300}
          closeDelay={140}
          render={
            <SidebarMenuButton aria-label={gt("Usage")} onClick={onClick} size="icon">
              <ChartNoAxesColumnIcon />
            </SidebarMenuButton>
          }
        />
        <PreviewCardPopup side="top" align="start" className="w-72 max-w-[calc(100vw-1rem)]">
          <SidebarUsageLimits />
        </PreviewCardPopup>
      </PreviewCard>
    </SidebarMenuItem>
  );
}
