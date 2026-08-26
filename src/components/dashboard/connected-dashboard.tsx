"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  Banknote,
  Cpu,
  HardDrive,
  MemoryStick,
  Plus,
  Tag,
  Users,
  Wifi,
} from "lucide-react";
import { useRouterContext } from "@/contexts/router-context";
import { fetchForRouter } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format";
import type { ConnectedDashboardData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TableSkeleton } from "@/components/shared/table-skeleton";

function LiveHeaderClock() {
  const [now, setNow] = useState("");

  useEffect(() => {
    const tick = () => {
      setNow(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Dubai",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(new Date())
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="text-xs text-muted-foreground">
      Asia/Dubai | {now.replace(",", " |")}
    </p>
  );
}

export function ConnectedDashboard() {
  const { activeRouter } = useRouterContext();
  const [data, setData] = useState<ConnectedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeRouter) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchForRouter<{ dashboard: ConnectedDashboardData }>(
        "/api/mikrotik/dashboard",
        activeRouter
      );
      setData(payload.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeRouter]);

  useEffect(() => {
    void load();
    if (activeRouter) {
      const id = setInterval(() => void load(), 30000);
      return () => clearInterval(id);
    }
  }, [load, activeRouter]);

  if (!activeRouter) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed bg-card p-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
          <Wifi className="size-7" />
        </div>
        <h3 className="text-lg font-semibold">No Router Connected</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
          Connect to a saved router or add a new MikroTik router / camp to view live metrics and manage sessions.
        </p>
        <Button render={<Link href="/settings/routers" />} nativeButton={false}>
          <Plus className="mr-2 size-4" /> Go to Routers & Settings
        </Button>
      </div>
    );
  }

  if (loading && !data) {
    return <TableSkeleton rows={8} />;
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          <div className="font-semibold flex items-center gap-2 text-base">
            <AlertCircle className="size-5" />
            <span>Unable to connect to router &quot;{activeRouter.sessionName}&quot;</span>
          </div>
          <p className="text-xs mt-1.5 opacity-90">{error}</p>
          <div className="mt-4 flex gap-3">
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
            <Button size="sm" variant="outline" render={<Link href="/settings/routers" />} nativeButton={false}>
              Manage Routers
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const displayData = data!;
  const routerInfo = activeRouter;

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 dark:bg-card">
        <div className="inline-flex items-center gap-2 font-semibold">
          <Tag className="size-4" />
          {routerInfo.sessionName.toUpperCase()}
        </div>
        <LiveHeaderClock />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="stat-card-red border-0 text-white shadow-md">
          <CardContent className="flex h-36 flex-col justify-between p-5">
            <p className="text-5xl font-bold">{displayData.activeSessions}</p>
            <div className="flex items-end justify-between">
              <span className="text-sm opacity-90">Active</span>
              <Wifi className="size-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-yellow border-0 text-white shadow-md">
          <CardContent className="flex h-36 flex-col justify-between p-5">
            <p className="text-5xl font-bold">{displayData.totalUsers}</p>
            <div className="flex items-end justify-between">
              <span className="text-sm opacity-90">Users</span>
              <Users className="size-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-income border-0 text-white shadow-md">
          <CardContent className="flex h-36 flex-col justify-between p-5">
            <div className="space-y-1 text-sm">
              <p>This month: {formatCurrency(displayData.incomeMonth, displayData.currency)}</p>
              <p>Today: {formatCurrency(displayData.incomeToday, displayData.currency)}</p>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-sm opacity-90">Income</span>
              <Banknote className="size-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Resource {routerInfo.sessionName.toUpperCase()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="inline-flex items-center gap-2">
                  <Cpu className="size-4" /> CPU Load
                </span>
                <span>
                  {displayData.resource.cpuLoad}% {displayData.resource.cpuCount}x {displayData.resource.cpuFrequency}
                </span>
              </div>
              <Progress value={Number(displayData.resource.cpuLoad)} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="inline-flex items-center gap-2">
                  <MemoryStick className="size-4" /> Memory
                </span>
                <span>
                  {displayData.resource.memoryUsed} / {displayData.resource.memoryTotal}
                </span>
              </div>
              <Progress value={displayData.resource.memoryPercent} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="inline-flex items-center gap-2">
                  <HardDrive className="size-4" /> HDD
                </span>
                <span>
                  {displayData.resource.hddUsed} / {displayData.resource.hddTotal}
                </span>
              </div>
              <Progress value={displayData.resource.hddPercent} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">Uptime</span>
              <span>{displayData.resource.uptime}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">Board Name</span>
              <span>{displayData.resource.boardName}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">Model</span>
              <span>{displayData.resource.boardName}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Router OS</span>
              <span>{displayData.resource.version} (stable)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <Activity className="size-4" />
              Traffic Monitor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-56 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
              Select interface to view live traffic
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">App Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-40 space-y-1 overflow-y-auto text-xs font-mono">
                {displayData.appLogs.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hotspot Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-y-auto text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-2">Time</th>
                      <th className="pb-2 pr-2">User (IP)</th>
                      <th className="pb-2">Messages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayData.hotspotLogs.map((log) => (
                      <tr key={log.id} className="border-b border-muted/50">
                        <td className="py-1.5 pr-2 align-top">{log.time}</td>
                        <td className="py-1.5 pr-2 align-top">{log.user}</td>
                        <td className="py-1.5 align-top">{log.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
