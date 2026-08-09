"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Filter,
  Minus,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { useRouterContext } from "@/contexts/router-context";
import { fetchForRouter } from "@/lib/api/client";
import type { HotspotUser } from "@/lib/types";
import { HotspotTabs } from "@/components/hotspot/hotspot-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/table-skeleton";

export function HotspotUsersView() {
  const { activeRouter } = useRouterContext();
  const [users, setUsers] = useState<HotspotUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const load = useCallback(async () => {
    if (!activeRouter) return;
    setLoading(true);
    try {
      const payload = await fetchForRouter<{ users: HotspotUser[] }>(
        "/api/mikrotik/users",
        activeRouter
      );
      setUsers(payload.users);
    } finally {
      setLoading(false);
    }
  }, [activeRouter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return users.filter(
      (user) =>
        user.username.toLowerCase().includes(search.toLowerCase()) ||
        user.profile.toLowerCase().includes(search.toLowerCase()) ||
        (user.comment ?? "").toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="toetik-panel space-y-4">
      <HotspotTabs />

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border bg-white px-3 py-1 text-sm font-semibold dark:bg-card">
          {filtered.length}
        </span>
        <Button variant="outline" size="icon-sm" className="bg-white dark:bg-card" onClick={() => void load()}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="bg-white dark:bg-card pl-8"
            placeholder="Search..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button variant="outline" size="icon-sm" className="bg-white dark:bg-card">
          <Filter className="size-4" />
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" className="bg-white dark:bg-card">
            <Plus className="size-4" /> Add
          </Button>
          <Button variant="outline" className="bg-white dark:bg-card">Generate</Button>
          <Button variant="outline" className="bg-white dark:bg-card">Profile</Button>
          <Button variant="outline" className="bg-white dark:bg-card">Comment</Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="w-10" />
                <TableHead>Server</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>MAC Address</TableHead>
                <TableHead>Uptime</TableHead>
                <TableHead>Bytes In</TableHead>
                <TableHead>Bytes Out</TableHead>
                <TableHead>Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((user, index) => (
                <TableRow key={user.id} className={index % 2 ? "bg-muted/20" : ""}>
                  <TableCell>
                    <Button variant="ghost" size="icon-xs">
                      <Minus className="size-4 text-red-500" />
                    </Button>
                  </TableCell>
                  <TableCell>{user.server ?? "all"}</TableCell>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.profile}</TableCell>
                  <TableCell className="font-mono text-xs">{user.macAddress || "—"}</TableCell>
                  <TableCell>{user.uptime}</TableCell>
                  <TableCell>{user.bytesIn ?? user.dataUsed}</TableCell>
                  <TableCell>{user.bytesOut ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {user.comment || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {Array.from({ length: Math.min(totalPages, 8) }).map((_, i) => {
          const pageNum = i + 1;
          return (
            <Button
              key={pageNum}
              variant={page === pageNum ? "default" : "outline"}
              size="xs"
              onClick={() => setPage(pageNum)}
            >
              {pageNum}
            </Button>
          );
        })}
        {totalPages > 8 && <span className="text-muted-foreground">… {totalPages}</span>}
      </div>
    </div>
  );
}
