"use client";

import { Activity } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export function LogsClient() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Logs"
        description="Admin audit logs are stored in the app database, not on MikroTik."
      />
      <EmptyState
        icon={Activity}
        title="No activity logs yet"
        description="Connection tests, user changes, and admin actions will be logged here once a database is connected."
      />
    </div>
  );
}
