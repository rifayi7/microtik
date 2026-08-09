"use client";

import { BarChart3, TrendingUp, Users, Wifi, ShoppingCart, UserCheck, Clock, Layers } from "lucide-react";
import { PageHeader, StatCard } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMikrotikApi } from "@/lib/api/client";
import { MikrotikSetupAlert } from "@/components/shared/mikrotik-setup-alert";
import type { DashboardStats, Router } from "@/lib/types";

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
  const dashboard = useMikrotikApi<{ stats: DashboardStats }>(
    "/api/mikrotik/dashboard",
    (payload) => ({ stats: payload.stats as DashboardStats })
  );
  
  const routers = useMikrotikApi<Router[]>(
    "/api/mikrotik/routers",
    (payload) => (payload.routers as Router[]) ?? []
  );

  const salesReport = useMikrotikApi<SalesReportData>(
    "/api/mikrotik/reports",
    (payload) => ({
      summary: (payload.summary || { totalSold: 0, salesByUser: [] }) as any,
      sales: (payload.sales || []) as any,
    })
  );

  const loading = dashboard.loading || routers.loading || salesReport.loading;
  
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sales & Network Reports" description="Loading metrics..." />
        <TableSkeleton rows={8} />
      </div>
    );
  }

  const stats = dashboard.data?.stats;
  const salesSummary = salesReport.data?.summary;
  const salesHistory = salesReport.data?.sales ?? [];

  // Get sales by user
  const salesByFasil = salesSummary?.salesByUser.find(u => u.name.toLowerCase().includes("fasil"))?.count ?? 0;
  const salesByRifai = salesSummary?.salesByUser.find(u => u.name.toLowerCase().includes("rifai"))?.count ?? 0;
  const otherSales = (salesSummary?.totalSold ?? 0) - salesByFasil - salesByRifai;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Comprehensive sales reports and router network performance."
      />

      <MikrotikSetupAlert
        error={dashboard.error ?? routers.error ?? salesReport.error}
        configured={dashboard.configured && routers.configured}
      />

      {/* Sales Summary Cards */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Sales Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Total Vouchers Sold" 
            value={salesSummary?.totalSold ?? 0} 
            icon={ShoppingCart} 
          />
          <StatCard 
            title="Sales (Fasil@2020)" 
            value={salesByFasil} 
            icon={UserCheck} 
          />
          <StatCard 
            title="Sales (Rifai)" 
            value={salesByRifai} 
            icon={UserCheck} 
          />
          {otherSales > 0 ? (
            <StatCard 
              title="Other Sales" 
              value={otherSales} 
              icon={Users} 
            />
          ) : (
            <StatCard 
              title="Active Routers" 
              value={`${stats?.onlineRouters ?? 0}/${stats?.totalRouters ?? 0}`} 
              icon={BarChart3} 
            />
          )}
        </div>
      </div>

      {/* Network Stats Cards (only show if router is connected) */}
      {stats && (
        <div className="space-y-4 pt-2">
          <h2 className="text-xl font-bold tracking-tight text-muted-foreground">Network Summary</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard title="Active Hotspot Sessions" value={stats.activeSessions} icon={Wifi} />
            <StatCard title="Total Registered Users" value={stats.totalUsers} icon={Users} />
            <StatCard title="Total Data Usage" value={stats.dataTransferred} icon={TrendingUp} />
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
            {(routers.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No routers configured</p>
            ) : (
              (routers.data ?? []).map((router) => (
                <div
                  key={router.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{router.sessionName}</span>
                    <span className="text-xs text-muted-foreground font-mono">{router.ipAddress}</span>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                    router.status === "online" 
                      ? "bg-green-500/10 text-green-500 ring-1 ring-inset ring-green-500/20" 
                      : "bg-red-500/10 text-red-500 ring-1 ring-inset ring-red-500/20"
                  }`}>
                    {router.status}
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
