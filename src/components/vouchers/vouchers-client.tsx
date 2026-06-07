"use client";

import { Ticket } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export function VouchersClient() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Voucher Generation"
        description="Generate vouchers via MikroTik hotspot users. Batch tracking will be added next."
      />
      <EmptyState
        icon={Ticket}
        title="Voucher batches coming soon"
        description="Hotspot users can be created on MikroTik directly. This screen will generate printable voucher batches using your template editor."
      />
    </div>
  );
}
