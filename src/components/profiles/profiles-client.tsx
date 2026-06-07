"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
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

export function ProfilesClient() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [search, setSearch] = useState("");

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await fetchMikrotikApi<{ profiles: UserProfile[] }>(
        "/api/mikrotik/profiles"
      );
      setConfigured(payload.configured !== false);
      setProfiles(payload.profiles);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load profiles";
      setError(message);
      setConfigured(!message.includes("not configured"));
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const filtered = profiles.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Profiles"
        description="Hotspot profiles from MikroTik /ip/hotspot/user/profile."
      >
        <Button>
          <Plus className="size-4" />
          Create Profile
        </Button>
      </PageHeader>

      <MikrotikSetupAlert error={error} configured={configured} />

      <DataTableToolbar
        searchPlaceholder="Search profiles..."
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
                <TableHead>Shared Users</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No profiles found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.name}</TableCell>
                    <TableCell className="font-mono text-sm">{profile.rateLimit}</TableCell>
                    <TableCell>{profile.sessionTimeout}</TableCell>
                    <TableCell>{profile.idleTimeout}</TableCell>
                    <TableCell>{profile.sharedUsers}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
