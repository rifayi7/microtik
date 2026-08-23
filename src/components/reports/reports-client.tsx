"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, TrendingUp, Users, Wifi, ShoppingCart, UserCheck, Clock, Layers, RefreshCw } from "lucide-react";
import { PageHeader, StatCard } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouterContext } from "@/contexts/router-context";
import { fetchForRouter, fetchMikrotikApi } from "@/lib/api/client";
import type { ConnectedDashboardData } from "@/lib/types";

interface SalesReportData {
  summary: {
    totalSold: number;
    salesByUser: { name: string; count: number }[];
  };
  sales: {
    code: string;
    validity: number;
    mobile: string;
    timestamp: string;
    seller: string;
    routerId: string;
  }[];
}

export function ReportsClient() {
  const { activeRouter, routers } = useRouterContext();
  const [salesReport, setSalesReport] = useState<SalesReportData | null>(null);
  const [dashboardData, setDashboardData] = useState<ConnectedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load sales report from database
      const reportRes = await fetchMikrotikApi<SalesReportData>("/api/mikrotik/reports");
      setSalesReport(reportRes);

      // 2. If active router connected, load live dashboard metrics
      if (activeRouter) {
        try {
          const dashRes = await fetchForRouter<{ dashboard: ConnectedDashboardData }>(
            "/api/mikrotik/dashboard",
            activeRouter
          );
          if (dashRes && dashRes.dashboard) {
            setDashboardData(dashRes.dashboard);
          }
        } catch (dashErr) {
          console.warn("Could not fetch live dashboard for active router:", dashErr);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [activeRouter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading && !salesReport) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sales & Network Reports" description="Loading metrics..." />
        <TableSkeleton rows={8} />
      </div>
    );
  }

  const salesSummary = salesReport?.summary;
  const salesHistory = salesReport?.sales ?? [];

  // Dynamic user sales breakdown
  const salesByUser = salesSummary?.salesByUser ?? [];
  const topAgents = salesByUser.slice(0, 3);
  const totalSold = salesSummary?.totalSold ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Reports & Analytics"
          description="Comprehensive sales reports and router network performance."
        />
        <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Sales Summary Cards */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Sales Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Total Vouchers Sold" 
            value={totalSold} 
            icon={ShoppingCart} 
          />
          {topAgents.map((agent, idx) => (
            <StatCard
              key={agent.name + idx}
              title={`Sales (${agent.name})`}
              value={agent.count}
              icon={UserCheck}
            />
          ))}
          {topAgents.length === 0 && (
            <StatCard 
              title="Configured Routers" 
              value={routers.length} 
              icon={BarChart3} 
            />
          )}
        </div>
      </div>

      {/* Network Stats Cards (only show if router is connected) */}
      {dashboardData && (
        <div className="space-y-4 pt-2">
          <h2 className="text-xl font-bold tracking-tight text-muted-foreground">
            Live Network Summary ({activeRouter?.sessionName})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard title="Active Hotspot Sessions" value={dashboardData.activeSessions} icon={Wifi} />
            <StatCard title="Total Registered Users" value={dashboardData.totalUsers} icon={Users} />
            <StatCard title="Total Memory Used" value={dashboardData.resource?.memoryUsed ?? "—"} icon={TrendingUp} />
          </div>
        </div>
      )}

      {/* Detailed Sales History */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recharge Sales History
            </CardTitle>
            <CardDescription>
              Chronological log of voucher codes sold through the mobile app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {salesHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <ShoppingCart className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No vouchers have been sold yet.</p>
                <p className="text-xs">Perform a recharge on the mobile app to see reports here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Voucher Code</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Customer Mobile</TableHead>
                      <TableHead>Sold By</TableHead>
                      <TableHead className="text-right">Date & Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesHistory.map((log, idx) => (
                      <TableRow key={log.code + idx}>
                        <TableCell className="font-mono font-bold text-primary">{log.code}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-500 ring-1 ring-inset ring-blue-500/20">
                            {log.validity} Days
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{log.mobile}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-500 ring-1 ring-inset ring-green-500/20">
                            {log.seller || "System"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Routers / General stats card */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Router & Operator List
            </CardTitle>
            <CardDescription>
              Registered router gateways sending reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {routers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No routers configured</p>
            ) : (
              routers.map((router) => (
                <div
                  key={router.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{router.sessionName}</span>
                    <span className="text-xs text-muted-foreground font-mono">{router.host}</span>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                    router.status === "online" 
                      ? "bg-green-500/10 text-green-500 ring-1 ring-inset ring-green-500/20" 
                      : "bg-zinc-500/10 text-zinc-500 ring-1 ring-inset ring-zinc-500/20"
                  }`}>
                    {router.status ?? "configured"}
                  </span>
                </div>
              ))
            )}
            <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
              <p className="font-semibold">Operator Accounts:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Fasil@2020</li>
                <li>Rifai</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
