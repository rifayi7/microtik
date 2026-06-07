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

  const handleConnectSuccess = (target: Router) => {
    setRouters((prev) =>
      prev.map((r) =>
        r.id === target.id
          ? { ...r, status: "online", lastConnected: new Date().toISOString() }
          : r
      )
    );
    setConnectTarget(null);
    toast.success(`Connected to ${target.sessionName}`);
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
                : "No routers are defined in MIKROTIK_HOST or MIKROTIK_ROUTERS."
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Session Name</TableHead>
                <TableHead>Hotspot Name</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Camp</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item, index) => (
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
                  <TableCell className="text-right">{item.activeUsers}</TableCell>
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
                          Remove from env
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
