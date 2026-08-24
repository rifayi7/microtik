"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  PlugZap,
  Plus,
  Router as RouterIcon,
  Settings,
  Tag,
  Trash2,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTableToolbar } from "@/components/shared/data-table-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConnectDialog } from "@/components/routers/connect-dialog";
import { fetchMikrotikApi } from "@/lib/api/client";
import { MikrotikSetupAlert } from "@/components/shared/mikrotik-setup-alert";
import type { Router } from "@/lib/types";

export function RouterListClient() {
  const router = useRouter();
  const [routers, setRouters] = useState<Router[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<Router | null>(null);
  const [connectTarget, setConnectTarget] = useState<Router | null>(null);

  const loadRouters = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await fetchMikrotikApi<{ routers: Router[] }>(
        "/api/mikrotik/routers"
      );
      setConfigured(payload.configured !== false);
      setRouters(payload.routers);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load routers";
      setError(message);
      setConfigured(!message.includes("not configured"));
      setRouters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRouters();
  }, [loadRouters]);

  const filtered = routers.filter((r) => {
    const matchesSearch =
      r.sessionName.toLowerCase().includes(search.toLowerCase()) ||
      r.hotspotName.toLowerCase().includes(search.toLowerCase()) ||
      r.camp?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = () => {
    if (!deleteTarget) return;
    toast.info(
      "Remove router credentials from .env.local to delete it from this app."
    );
    setDeleteTarget(null);
  };

  const handleConnectSuccess = async (target: Router) => {
    toast.success(`Connected to ${target.sessionName}`);
    setConnectTarget(null);
    await loadRouters();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Routers & Camps"
        description="Manage MikroTik router connections from your environment configuration."
      >
        <Button variant="outline" onClick={() => void loadRouters()}>
          Refresh
        </Button>
      </PageHeader>

      <MikrotikSetupAlert error={error} configured={configured} />

      <DataTableToolbar
        searchPlaceholder="Search routers, hotspots, camps..."
        searchValue={search}
        onSearchChange={setSearch}
      >
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
      </DataTableToolbar>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={RouterIcon}
          title="No routers found"
          description={
            !configured
              ? "Add MikroTik credentials to .env.local and restart the dev server."
              : search || statusFilter !== "all"
                ? "Try adjusting your search or filters."
                : "No routers configured in database or environment."
          }
        />
      ) : (
        <div className="space-y-8">
          {/* 1. Verified & Active Camps Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20"></span>
                  Verified & Active Camps
                  <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                    {filtered.filter((r) => r.verified !== false).length}
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Camps with successful connection history, active inventory, and visible in Mobile App.
                </p>
              </div>
            </div>

            {filtered.filter((r) => r.verified !== false).length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No active verified camps yet. Connect to a router below to activate it.
              </div>
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Camp / Session</TableHead>
                      <TableHead>Hotspot Name</TableHead>
                      <TableHead>Host (IP / Port)</TableHead>
                      <TableHead>Camp Name</TableHead>
                      <TableHead>Live Status</TableHead>
                      <TableHead className="text-right">Users</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered
                      .filter((r) => r.verified !== false)
                      .map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell>
                            <Link
                              href={`/routers/${item.id}`}
                              className="inline-flex items-center gap-2 font-medium hover:text-primary"
                            >
                              <Tag className="size-3.5 text-muted-foreground" />
                              {item.sessionName}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                              <Wifi className="size-3.5" />
                              {item.hotspotName}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{item.ipAddress}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.camp ?? "—"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} />
                          </TableCell>
                          <TableCell className="text-right font-medium">{item.activeUsers}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="ghost" size="icon-xs">
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => router.push(`/routers/${item.id}`)}
                                >
                                  <Settings className="size-4" />
                                  Edit settings
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setConnectTarget(item)}>
                                  <PlugZap className="size-4" />
                                  Test connection
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteTarget(item)}
                                >
                                  <Trash2 className="size-4" />
                                  Delete router
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* 2. Pending / Unverified Routers Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-500/20"></span>
                  Pending / Unverified Routers (Drafts)
                  <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
                    {filtered.filter((r) => r.verified === false).length}
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Newly added or offline routers awaiting a successful live connection. Hidden from mobile app until verified.
                </p>
              </div>
            </div>

            {filtered.filter((r) => r.verified === false).length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No pending routers. All added routers are verified and active.
              </div>
            ) : (
              <div className="rounded-xl border bg-card/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Session Name</TableHead>
                      <TableHead>Hotspot Name</TableHead>
                      <TableHead>Host (IP / Port)</TableHead>
                      <TableHead>Camp Name</TableHead>
                      <TableHead>Verification</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered
                      .filter((r) => r.verified === false)
                      .map((item, index) => (
                        <TableRow key={item.id} className="bg-amber-500/[0.02]">
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell>
                            <Link
                              href={`/routers/${item.id}`}
                              className="inline-flex items-center gap-2 font-medium hover:text-primary"
                            >
                              <Tag className="size-3.5 text-muted-foreground" />
                              {item.sessionName}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                              <Wifi className="size-3.5" />
                              {item.hotspotName}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{item.ipAddress}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.camp ?? "—"}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 ring-1 ring-inset ring-amber-500/20">
                              Pending Connect
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="xs"
                              variant="outline"
                              className="border-amber-500/30 text-amber-600 hover:bg-amber-50"
                              onClick={() => setConnectTarget(item)}
                            >
                              <PlugZap className="mr-1 size-3.5" />
                              Verify Now
                            </Button>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="ghost" size="icon-xs">
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => router.push(`/routers/${item.id}`)}
                                >
                                  <Settings className="size-4" />
                                  Edit credentials
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteTarget(item)}
                                >
                                  <Trash2 className="size-4" />
                                  Delete router
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      <ConnectDialog
        router={connectTarget}
        open={!!connectTarget}
        onOpenChange={(open) => !open && setConnectTarget(null)}
        onConnect={handleConnectSuccess}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove router?</AlertDialogTitle>
            <AlertDialogDescription>
              Routers are loaded from environment variables. Edit{" "}
              <code className="font-mono">.env.local</code> to remove &quot;
              {deleteTarget?.sessionName}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
