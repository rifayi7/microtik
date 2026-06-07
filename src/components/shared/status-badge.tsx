"use client";

import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/lib/types";

const statusConfig: Record<
  ConnectionStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  online: {
    label: "Online",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  offline: {
    label: "Offline",
    dotClass: "bg-red-500",
    badgeClass: "bg-red-500/10 text-red-700 dark:text-red-400",
  },
  unknown: {
    label: "Unknown",
    dotClass: "bg-zinc-400",
    badgeClass: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  },
  connecting: {
    label: "Connecting",
    dotClass: "bg-amber-500 animate-pulse",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
};

interface StatusBadgeProps {
  status: ConnectionStatus;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  showDot = true,
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.badgeClass,
        className
      )}
    >
      {showDot && (
        <span
          className={cn("size-1.5 rounded-full shrink-0", config.dotClass)}
        />
      )}
      {config.label}
    </span>
  );
}

export function UserStatusBadge({
  status,
  className,
}: {
  status: "active" | "disabled" | "expired" | "unused" | "used" | "completed" | "pending" | "failed" | "refunded";
  className?: string;
}) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    disabled: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
    expired: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    unused: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    used: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
    completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    failed: "bg-red-500/10 text-red-700 dark:text-red-400",
    refunded: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        styles[status],
        className
      )}
    >
      {status}
    </span>
  );
}

export function SeverityBadge({
  severity,
  className,
}: {
  severity: "info" | "warning" | "error" | "success";
  className?: string;
}) {
  const styles: Record<string, string> = {
    info: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    error: "bg-red-500/10 text-red-700 dark:text-red-400",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        styles[severity],
        className
      )}
    >
      {severity}
    </span>
  );
}
