"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, UserX, Wifi } from "lucide-react";
import { toast } from "sonner";
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
import type { ActiveSession } from "@/lib/types";

export function SessionsClient() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [search, setSearch] = useState("");

  const loadSessions = useCallback(async () => {
    setError(null);

    try {
      const payload = await fetchMikrotikApi<{ sessions: ActiveSession[] }>(
        "/api/mikrotik/sessions"
      );
      setConfigured(payload.configured !== false);
      setSessions(payload.sessions);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load sessions";
      setError(message);
      setConfigured(!message.includes("not configured"));
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const filtered = sessions.filter(
    (s) =>
      s.username.toLowerCase().includes(search.toLowerCase()) ||
      s.routerName.toLowerCase().includes(search.toLowerCase()) ||
      s.ipAddress.includes(search)
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    toast.success("Sessions refreshed from MikroTik");
  };

  const handleDisconnect = async (session: ActiveSession) => {
    try {
      await fetchMikrotikApi("/api/mikrotik/sessions", {
        method: "DELETE",
        body: JSON.stringify({
          routerId: session.routerId,
          sessionId: session.id,
        }),
      });

      toast.success(`Session ${session.username} disconnected`);
      await loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Disconnect failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active Sessions"
        description="Live hotspot sessions fetched from MikroTik /ip/hotspot/active."
      >
        <Button variant="outline" onClick={() => void handleRefresh()} disabled={refreshing}>
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </PageHeader>

      <MikrotikSetupAlert error={error} configured={configured} />

      <DataTableToolbar
        searchPlaceholder="Search username, router, IP..."
        searchValue={search}
        onSearchChange={setSearch}
      />

      {loading ? (
        <TableSkeleton rows={5} />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Router</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>MAC Address</TableHead>
                <TableHead>Uptime</TableHead>
                <TableHead>Download</TableHead>
                <TableHead>Upload</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No active sessions
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{session.username}</TableCell>
                    <TableCell className="text-muted-foreground">{session.routerName}</TableCell>
                    <TableCell className="font-mono text-xs">{session.ipAddress}</TableCell>
                    <TableCell className="font-mono text-xs">{session.macAddress}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <Wifi className="size-3 text-emerald-500" />
                        {session.uptime}
                      </span>
                    </TableCell>
                    <TableCell>{session.download}</TableCell>
                    <TableCell>{session.upload}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => void handleDisconnect(session)}
                      >
                        <UserX className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
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
