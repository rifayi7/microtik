"use client";

import { useCallback, useEffect, useState } from "react";
import { Gauge, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTableToolbar } from "@/components/shared/data-table-toolbar";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchMikrotikApi } from "@/lib/api/client";
import { MikrotikSetupAlert } from "@/components/shared/mikrotik-setup-alert";
import type { UserProfile } from "@/lib/types";

export function PlansClient() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [search, setSearch] = useState("");

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await fetchMikrotikApi<{ profiles: UserProfile[] }>(
        "/api/mikrotik/profiles"
      );
      setConfigured(payload.configured !== false);
      setProfiles(payload.profiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plans");
      setConfigured(!(err instanceof Error && err.message.includes("not configured")));
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const filtered = profiles.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bandwidth & Speed Plans"
        description="Rate limits from MikroTik hotspot user profiles."
      >
        <Button>
          <Plus className="size-4" />
          Add Plan
        </Button>
      </PageHeader>

      <MikrotikSetupAlert error={error} configured={configured} />

      <DataTableToolbar
        searchPlaceholder="Search plans..."
        searchValue={search}
        onSearchChange={setSearch}
      />

      {loading ? (
        <TableSkeleton rows={4} />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rate Limit</TableHead>
                <TableHead>Session Timeout</TableHead>
                <TableHead>Idle Timeout</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Gauge className="size-3.5 text-muted-foreground" />
                      {plan.name}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono">{plan.rateLimit}</TableCell>
                  <TableCell>{plan.sessionTimeout}</TableCell>
                  <TableCell>{plan.idleTimeout}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
