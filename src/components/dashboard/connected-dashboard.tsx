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

import type { StoredRouter } from "@/lib/router-store";

const MOCK_ROUTER: StoredRouter = {
  id: "demo-router",
  sessionName: "SmartWifi-Demo",
  host: "192.168.88.1",
  port: 8728,
  username: "demo",
  password: "",
  useTls: false,
  hotspotName: "SmartWifi-Hotspot",
  dnsName: "smartwifi.net",
  currency: "AED",
  sessionTimeout: "30 minutes",
  liveReport: true,
  phone: "",
  status: "online",
};

const MOCK_DASHBOARD_DATA: ConnectedDashboardData = {
  resource: {
    cpuLoad: "8",
    cpuCount: "4",
    cpuFrequency: "716 MHz",
    memoryUsed: "42.8 MB",
    memoryTotal: "128.0 MB",
    memoryPercent: 33,
    hddUsed: "9.2 MB",
    hddTotal: "16.0 MB",
    hddPercent: 57,
    uptime: "2w4d18h",
    version: "7.12.1",
    boardName: "hAP ac lite",
    identity: "SmartWifi-Demo",
  },
  activeSessions: 18,
  totalUsers: 120,
  incomeToday: 85,
  incomeMonth: 2150,
  currency: "AED",
  appLogs: [
    "10:47:12 Loading Hotspot Info",
    "10:47:13 Connected in Demo Mode",
    "10:47:14 Dashboard synced",
  ],
  hotspotLogs: [
    { id: "log-1", time: "22:45:01", user: "guest_7342", message: "guest_7342 connected (IP: 192.168.88.254)" },
    { id: "log-2", time: "22:41:12", user: "guest_1109", message: "guest_1109 logged in successfully" },
    { id: "log-3", time: "22:35:48", user: "admin", message: "admin logged in from 192.168.88.15" },
    { id: "log-4", time: "22:15:22", user: "guest_8922", message: "guest_8922 disconnected: keepalive timeout" },
  ],
  sessions: [
    {
      id: "sess-1",
      username: "guest_7342",
      routerId: "demo-router",
      routerName: "SmartWifi-Demo",
      ipAddress: "192.168.88.254",
      macAddress: "00:0C:42:F3:81:4A",
      uptime: "00:15:32",
      download: "24.5 MB",
      upload: "4.8 MB",
      profile: "1-Day",
    },
    {
      id: "sess-2",
      username: "guest_1109",
      routerId: "demo-router",
      routerName: "SmartWifi-Demo",
      ipAddress: "192.168.88.253",
      macAddress: "00:0C:42:E2:12:9F",
      uptime: "01:22:10",
      download: "95.2 MB",
      upload: "18.1 MB",
      profile: "30-Days",
    },
  ],
};

export function ConnectedDashboard() {
  const { activeRouter } = useRouterContext();
  const [data, setData] = useState<ConnectedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeRouter) {
      setData(MOCK_DASHBOARD_DATA);
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
      // Fallback to mock data if no data was loaded previously
      setData((prev) => prev || MOCK_DASHBOARD_DATA);
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

  if (loading && !data) {
    return <TableSkeleton rows={8} />;
  }

  const displayData = data || MOCK_DASHBOARD_DATA;
  const routerInfo = activeRouter || MOCK_ROUTER;
  const isDemo = !activeRouter || !!error;

  return (
    <div className="space-y-4">
      {isDemo && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-800 dark:text-yellow-200">
          <div className="font-semibold flex items-center gap-1.5">
            <span>⚠️ Demo Mode Active</span>
          </div>
          <p className="text-xs mt-1 opacity-90">
            {!activeRouter 
              ? "No active router connected. Please go to Settings -> Routers to connect a MikroTik router. Showing simulated data."
              : `Unable to connect to router "${activeRouter.sessionName}". Showing simulated/fallback data. Error: ${error}`}
          </p>
        </div>
      )}

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
