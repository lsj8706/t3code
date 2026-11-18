import type { ContextWindowSnapshot } from "@t3tools/client-runtime/state/context-window";
import { useGT, useLocale } from "gt-react";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function ComposerContextMeter({ usage }: { usage: ContextWindowSnapshot }) {
  const gt = useGT();
  const locale = useLocale();
  if (usage.usedPercentage === null || !usage.maxTokens) return null;

  const used = Math.round(Math.max(0, Math.min(100, usage.usedPercentage)));
  const label = gt("Context: {used}% used", { used });
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            data-composer-context-meter
            role="meter"
            tabIndex={0}
            aria-label={gt("Context window")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={used}
            aria-valuetext={label}
            className="inline-flex size-6 shrink-0 cursor-default items-center justify-center rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          />
        }
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-3.5 -rotate-90 stroke-current"
          fill="none"
          strokeWidth={2.4}
        >
          <circle cx="8" cy="8" r="6" opacity=".25" />
          <circle
            cx="8"
            cy="8"
            r="6"
            pathLength="100"
            strokeDasharray={`${used} 100`}
            className={cn(used >= 90 ? "text-error" : used >= 80 && "text-warning")}
          />
        </svg>
      </TooltipTrigger>
      <TooltipPopup>
        <span className="flex flex-col gap-0.5 tabular-nums">
          <span>
            {label} · {gt("{left}% left", { left: 100 - used })}
          </span>
          <span>
            {gt("{used} of {max} tokens", {
              used: usage.usedTokens.toLocaleString(locale),
              max: usage.maxTokens.toLocaleString(locale),
            })}
          </span>
        </span>
      </TooltipPopup>
    </Tooltip>
  );
}
