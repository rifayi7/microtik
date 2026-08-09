"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CreditCard, Router, Users, Wifi } from "lucide-react";
import { PageHeader, StatCard } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatCurrency } from "@/lib/format";
import type { ActiveSession, DashboardStats, Router as RouterType } from "@/lib/types";

export function DashboardClient() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [routers, setRouters] = useState<RouterType[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [statsPayload, routersPayload, sessionsPayload] = await Promise.all([
        fetchMikrotikApi<{ stats: DashboardStats }>("/api/mikrotik/dashboard"),
        fetchMikrotikApi<{ routers: RouterType[] }>("/api/mikrotik/routers"),
        fetchMikrotikApi<{ sessions: ActiveSession[] }>("/api/mikrotik/sessions"),
      ]);

      setConfigured(
        statsPayload.configured !== false &&
          routersPayload.configured !== false
      );
      setStats(statsPayload.stats);
      setRouters(routersPayload.routers);
      setSessions(sessionsPayload.sessions);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard";
      setError(message);
      setConfigured(!message.includes("not configured"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="space-y-8">
        <TableSkeleton rows={2} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
        <TableSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Live overview from your MikroTik hotspot network."
      >
        <Button variant="outline" onClick={() => void loadDashboard()}>
          Refresh
        </Button>
        <Button render={<Link href="/routers" />} nativeButton={false}>
          Manage Routers
          <ArrowUpRight className="size-4" />
        </Button>
      </PageHeader>

      <MikrotikSetupAlert error={error} configured={configured} />

      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Configured Routers"
              value={`${stats.onlineRouters}/${stats.totalRouters}`}
              description="Online / total from env"
              icon={Router}
            />
            <StatCard
              title="Active Sessions"
              value={stats.activeSessions}
              description="From /ip/hotspot/active"
              icon={Wifi}
            />
            <StatCard
              title="Hotspot Users"
              value={stats.totalUsers.toLocaleString()}
              description="From /ip/hotspot/user"
              icon={Users}
            />
            <StatCard
              title="Data Transferred"
              value={stats.dataTransferred}
              description="Active session traffic"
              icon={CreditCard}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Router Status</CardTitle>
                <Button variant="ghost" size="sm" render={<Link href="/routers" />} nativeButton={false}>
                  View all
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Host</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Active Users</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routers.map((router) => (
                      <TableRow key={router.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/routers/${router.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {router.sessionName}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{router.ipAddress}</TableCell>
                        <TableCell>
                          <StatusBadge status={router.status} />
                        </TableCell>
                        <TableCell className="text-right">{router.activeUsers}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Live Sessions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active sessions</p>
                ) : (
                  sessions.slice(0, 6).map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between rounded-lg border p-2 text-xs"
                    >
                      <span className="truncate">{session.username}</span>
                      <span className="text-muted-foreground">{session.uptime}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
