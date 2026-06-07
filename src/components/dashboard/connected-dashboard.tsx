"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Banknote,
  Cpu,
  HardDrive,
  MemoryStick,
  Tag,
  Users,
  Wifi,
} from "lucide-react";
import { useRouterContext } from "@/contexts/router-context";
import { fetchForRouter } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format";
import type { ConnectedDashboardData } from "@/lib/types";
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
    if (!activeRouter) return;
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
    } finally {
      setLoading(false);
    }
  }, [activeRouter]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30000);
    return () => clearInterval(id);
  }, [load]);

  if (!activeRouter) return null;

  if (loading && !data) {
    return <TableSkeleton rows={8} />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 dark:bg-card">
        <div className="inline-flex items-center gap-2 font-semibold">
          <Tag className="size-4" />
          {activeRouter.sessionName.toUpperCase()}
        </div>
        <LiveHeaderClock />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="stat-card-red border-0 text-white shadow-md">
          <CardContent className="flex h-36 flex-col justify-between p-5">
            <p className="text-5xl font-bold">{data.activeSessions}</p>
            <div className="flex items-end justify-between">
              <span className="text-sm opacity-90">Active</span>
              <Wifi className="size-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-yellow border-0 text-white shadow-md">
          <CardContent className="flex h-36 flex-col justify-between p-5">
            <p className="text-5xl font-bold">{data.totalUsers}</p>
            <div className="flex items-end justify-between">
              <span className="text-sm opacity-90">Users</span>
              <Users className="size-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-income border-0 text-white shadow-md">
          <CardContent className="flex h-36 flex-col justify-between p-5">
            <div className="space-y-1 text-sm">
              <p>This month: {formatCurrency(data.incomeMonth, data.currency)}</p>
              <p>Today: {formatCurrency(data.incomeToday, data.currency)}</p>
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
              Resource {activeRouter.sessionName.toUpperCase()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="inline-flex items-center gap-2">
                  <Cpu className="size-4" /> CPU Load
                </span>
                <span>
                  {data.resource.cpuLoad}% {data.resource.cpuCount}x {data.resource.cpuFrequency}
                </span>
              </div>
              <Progress value={Number(data.resource.cpuLoad)} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="inline-flex items-center gap-2">
                  <MemoryStick className="size-4" /> Memory
                </span>
                <span>
                  {data.resource.memoryUsed} / {data.resource.memoryTotal}
                </span>
              </div>
              <Progress value={data.resource.memoryPercent} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="inline-flex items-center gap-2">
                  <HardDrive className="size-4" /> HDD
                </span>
                <span>
                  {data.resource.hddUsed} / {data.resource.hddTotal}
                </span>
              </div>
              <Progress value={data.resource.hddPercent} className="h-2" />
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
              <span>{data.resource.uptime}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">Board Name</span>
              <span>{data.resource.boardName}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">Model</span>
              <span>{data.resource.boardName}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Router OS</span>
              <span>{data.resource.version} (stable)</span>
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
                {data.appLogs.map((line) => (
                  <p key={line}>{line}</p>
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
                    {data.hotspotLogs.map((log) => (
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
