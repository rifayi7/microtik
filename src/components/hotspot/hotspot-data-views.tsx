"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouterContext } from "@/contexts/router-context";
import { fetchForRouter } from "@/lib/api/client";
import type { ActiveSession, HotspotHost, UserProfile } from "@/lib/types";
import { HotspotTabs } from "@/components/hotspot/hotspot-tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/table-skeleton";

function HotspotTableShell({
  loading,
  headers,
  rows,
}: {
  loading: boolean;
  headers: string[];
  rows: React.ReactNode;
}) {
  if (loading) return <TableSkeleton rows={6} />;

  return (
    <div className="overflow-x-auto rounded-lg border bg-white dark:bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60">
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{rows}</TableBody>
      </Table>
    </div>
  );
}

export function HotspotProfilesView() {
  const { activeRouter } = useRouterContext();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeRouter) return;
    setLoading(true);
    try {
      const payload = await fetchForRouter<{ profiles: UserProfile[] }>(
        "/api/mikrotik/profiles",
        activeRouter
      );
      setProfiles(payload.profiles);
    } finally {
      setLoading(false);
    }
  }, [activeRouter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="toetik-panel space-y-4">
      <HotspotTabs />
      <HotspotTableShell
        loading={loading}
        headers={["Name", "Rate Limit", "Session Timeout", "Idle Timeout", "Shared Users"]}
        rows={
          profiles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                No profiles found
              </TableCell>
            </TableRow>
          ) : (
            profiles.map((profile) => (
              <TableRow key={profile.id}>
                <TableCell className="font-medium">{profile.name}</TableCell>
                <TableCell>{profile.rateLimit}</TableCell>
                <TableCell>{profile.sessionTimeout}</TableCell>
                <TableCell>{profile.idleTimeout}</TableCell>
                <TableCell>{profile.sharedUsers}</TableCell>
              </TableRow>
            ))
          )
        }
      />
    </div>
  );
}

export function HotspotActiveView() {
  const { activeRouter } = useRouterContext();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeRouter) return;
    setLoading(true);
    try {
      const payload = await fetchForRouter<{ sessions: ActiveSession[] }>(
        "/api/mikrotik/sessions",
        activeRouter
      );
      setSessions(payload.sessions);
    } finally {
      setLoading(false);
    }
  }, [activeRouter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="toetik-panel space-y-4">
      <HotspotTabs />
      <HotspotTableShell
        loading={loading}
        headers={["User", "IP Address", "MAC Address", "Uptime", "Download", "Upload"]}
        rows={
          sessions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                No active sessions
              </TableCell>
            </TableRow>
          ) : (
            sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="font-medium">{session.username}</TableCell>
                <TableCell className="font-mono text-xs">{session.ipAddress}</TableCell>
                <TableCell className="font-mono text-xs">{session.macAddress}</TableCell>
                <TableCell>{session.uptime}</TableCell>
                <TableCell>{session.download}</TableCell>
                <TableCell>{session.upload}</TableCell>
              </TableRow>
            ))
          )
        }
      />
    </div>
  );
}

export function HotspotHostsView() {
  const { activeRouter } = useRouterContext();
  const [hosts, setHosts] = useState<HotspotHost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeRouter) return;
    setLoading(true);
    try {
      const payload = await fetchForRouter<{ hosts: HotspotHost[] }>(
        "/api/mikrotik/hosts",
        activeRouter
      );
      setHosts(payload.hosts);
    } finally {
      setLoading(false);
    }
  }, [activeRouter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="toetik-panel space-y-4">
      <HotspotTabs />
      <HotspotTableShell
        loading={loading}
        headers={["MAC Address", "Address", "Server", "Uptime"]}
        rows={
          hosts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                No hosts found
              </TableCell>
            </TableRow>
          ) : (
            hosts.map((host) => (
              <TableRow key={host.id}>
                <TableCell className="font-mono text-xs">{host.macAddress}</TableCell>
                <TableCell>{host.address}</TableCell>
                <TableCell>{host.server}</TableCell>
                <TableCell>{host.uptime}</TableCell>
              </TableRow>
            ))
          )
        }
      />
    </div>
  );
}
