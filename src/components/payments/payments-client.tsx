"use client";

import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export function PaymentsClient() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Payment tracking is not stored on MikroTik. Connect a database to enable this module."
      />
      <EmptyState
        icon={CreditCard}
        title="Payments require a database"
        description="MikroTik exposes hotspot users and sessions, but not payment history. Add a Postgres/SQLite store to track transactions."
      />
    </div>
  );
}
