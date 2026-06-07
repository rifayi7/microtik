"use client";

import { BarChart3, TrendingUp, Users, Wifi } from "lucide-react";
import { PageHeader, StatCard } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMikrotikApi } from "@/lib/api/client";
import { MikrotikSetupAlert } from "@/components/shared/mikrotik-setup-alert";
import type { DashboardStats, Router } from "@/lib/types";

export function ReportsClient() {
  const dashboard = useMikrotikApi<{ stats: DashboardStats }>(
    "/api/mikrotik/dashboard",
    (payload) => ({ stats: payload.stats as DashboardStats })
  );
  const routers = useMikrotikApi<Router[]>(
    "/api/mikrotik/routers",
    (payload) => (payload.routers as Router[]) ?? []
  );

  const loading = dashboard.loading || routers.loading;
  const stats = dashboard.data?.stats;

  if (loading) {
    return <TableSkeleton rows={6} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Analytics derived from live MikroTik hotspot data."
      >
        <Select defaultValue="7d">
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline">Export CSV</Button>
      </PageHeader>

      <MikrotikSetupAlert
        error={dashboard.error ?? routers.error}
        configured={dashboard.configured && routers.configured}
      />

      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Active Sessions" value={stats.activeSessions} icon={Wifi} />
            <StatCard title="Hotspot Users" value={stats.totalUsers} icon={Users} />
            <StatCard title="Data Transferred" value={stats.dataTransferred} icon={TrendingUp} />
            <StatCard
              title="Routers Online"
              value={`${stats.onlineRouters}/${stats.totalRouters}`}
              icon={BarChart3}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Router Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(routers.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No routers configured</p>
              ) : (
                (routers.data ?? []).map((router) => (
                  <div
                    key={router.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <span>{router.sessionName}</span>
                    <span className="text-muted-foreground">{router.ipAddress}</span>
                  </div>
                ))
              )}
              <p className="text-xs text-muted-foreground pt-2">
                Revenue and voucher reports require a database — not available from MikroTik API alone.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
