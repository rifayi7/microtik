import type {
  ActiveSession,
  ConnectedDashboardData,
  DashboardStats,
  HotspotHost,
  HotspotLogEntry,
  HotspotUser,
  UserProfile,
} from "@/lib/types";
import { formatBytes, formatUptime } from "@/lib/format";
import {
  getConfiguredRouters,
  toConnectionParams,
  toRouterModel,
  type MikrotikRouterConfig,
} from "./config";
import {
  mikrotikPrint,
  withMikrotikClient,
  type RouterOSRecord,
} from "./client";
import type { ConnectionStatus, Router } from "@/lib/types";

export interface ConnectionTestResult {
  success: boolean;
  identity?: string;
  version?: string;
  boardName?: string;
  uptime?: string;
  error?: string;
  testedAt: string;
}

function getRecordValue(record: RouterOSRecord, key: string): string {
  return record[key] ?? "";
}

function mapHotspotUser(
  record: RouterOSRecord,
  router: MikrotikRouterConfig
): HotspotUser {
  const disabled = getRecordValue(record, "disabled") === "true";
  const uptimeLimit = getRecordValue(record, "limit-uptime");
  const isExpired = uptimeLimit === "00:00:00";

  return {
    id: getRecordValue(record, ".id"),
    username: getRecordValue(record, "name"),
    profile: getRecordValue(record, "profile") || "default",
    routerId: router.id,
    routerName: router.sessionName,
    status: disabled ? "disabled" : isExpired ? "expired" : "active",
    uptime: formatUptime(getRecordValue(record, "uptime")),
    dataUsed: formatBytes(getRecordValue(record, "bytes-in")),
    dataLimit: formatBytes(getRecordValue(record, "limit-bytes-total")) || "Unlimited",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    createdAt: new Date().toISOString(),
    server: getRecordValue(record, "server") || "all",
    macAddress: getRecordValue(record, "mac-address"),
    bytesIn: formatBytes(getRecordValue(record, "bytes-in")),
    bytesOut: formatBytes(getRecordValue(record, "bytes-out")),
    comment: getRecordValue(record, "comment"),
  };
}

function mapActiveSession(
  record: RouterOSRecord,
  router: MikrotikRouterConfig
): ActiveSession {
  return {
    id: getRecordValue(record, ".id"),
    username: getRecordValue(record, "user"),
    routerId: router.id,
    routerName: router.sessionName,
    ipAddress: getRecordValue(record, "address"),
    macAddress: getRecordValue(record, "mac-address"),
    uptime: formatUptime(getRecordValue(record, "uptime")),
    download: formatBytes(getRecordValue(record, "bytes-in")),
    upload: formatBytes(getRecordValue(record, "bytes-out")),
    profile: getRecordValue(record, "server") || "default",
  };
}

function mapUserProfile(record: RouterOSRecord): UserProfile {
  return {
    id: getRecordValue(record, ".id"),
    name: getRecordValue(record, "name"),
    sharedUsers: Number(getRecordValue(record, "shared-users") || 1),
    rateLimit: getRecordValue(record, "rate-limit") || "—",
    sessionTimeout: getRecordValue(record, "session-timeout") || "—",
    idleTimeout: getRecordValue(record, "idle-timeout") || "—",
    validity: getRecordValue(record, "keepalive-timeout") || "—",
    price: 0,
    currency: "AED",
    routerCount: 1,
  };
}

export async function testRouterConnection(
  config: MikrotikRouterConfig
): Promise<ConnectionTestResult> {
  const testedAt = new Date().toISOString();

  try {
    const data = await withMikrotikClient(
      toConnectionParams(config),
      async (client) => {
        const [identity, resource] = await Promise.all([
          mikrotikPrint(client, "/system/identity/print"),
          mikrotikPrint(client, "/system/resource/print"),
        ]);

        return { identity: identity[0], resource: resource[0] };
      }
    );

    return {
      success: true,
      identity: getRecordValue(data.identity, "name"),
      version: getRecordValue(data.resource, "version"),
      boardName: getRecordValue(data.resource, "board-name"),
      uptime: getRecordValue(data.resource, "uptime"),
      testedAt,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
      testedAt,
    };
  }
}

export async function fetchRouterWithStatus(
  config: MikrotikRouterConfig
): Promise<Router> {
  const result = await testRouterConnection(config);
  let activeUsers = 0;

  if (result.success) {
    try {
      activeUsers = await withMikrotikClient(
        toConnectionParams(config),
        async (client) => {
          const sessions = await mikrotikPrint(client, "/ip/hotspot/active/print");
          return sessions.length;
        }
      );
    } catch {
      activeUsers = 0;
    }
  }

  const status: ConnectionStatus = result.success ? "online" : "offline";

  return toRouterModel(config, {
    status,
    activeUsers,
    lastConnected: result.success ? result.testedAt : undefined,
  });
}

export async function fetchAllRouters(options?: {
  testConnections?: boolean;
}): Promise<Router[]> {
  const configs = getConfiguredRouters();

  if (options?.testConnections) {
    return Promise.all(configs.map((config) => fetchRouterWithStatus(config)));
  }

  return configs.map((config) => toRouterModel(config, { status: "unknown" }));
}

export async function fetchActiveSessionsForRouter(
  config: MikrotikRouterConfig
): Promise<ActiveSession[]> {
  const records = await withMikrotikClient(toConnectionParams(config), (client) =>
    mikrotikPrint(client, "/ip/hotspot/active/print")
  );
  return records.map((record) => mapActiveSession(record, config));
}

export async function fetchHotspotUsersForRouter(
  config: MikrotikRouterConfig
): Promise<HotspotUser[]> {
  const records = await withMikrotikClient(toConnectionParams(config), (client) =>
    mikrotikPrint(client, "/ip/hotspot/user/print")
  );
  return records.map((record) => mapHotspotUser(record, config));
}

export async function fetchUserProfilesForRouter(
  config: MikrotikRouterConfig
): Promise<UserProfile[]> {
  const records = await withMikrotikClient(toConnectionParams(config), (client) =>
    mikrotikPrint(client, "/ip/hotspot/user/profile/print")
  );
  return records.map(mapUserProfile);
}

export async function fetchHotspotHostsForRouter(
  config: MikrotikRouterConfig
): Promise<HotspotHost[]> {
  const records = await withMikrotikClient(toConnectionParams(config), (client) =>
    mikrotikPrint(client, "/ip/hotspot/host/print")
  );

  return records.map((record) => ({
    id: getRecordValue(record, ".id"),
    macAddress: getRecordValue(record, "mac-address"),
    address: getRecordValue(record, "address"),
    server: getRecordValue(record, "server") || "all",
    uptime: formatUptime(getRecordValue(record, "uptime")),
  }));
}

export async function fetchConnectedDashboard(
  config: MikrotikRouterConfig
): Promise<ConnectedDashboardData> {
  const data = await withMikrotikClient(toConnectionParams(config), async (client) => {
    const [identity, resource, sessions, users, logs] = await Promise.all([
      mikrotikPrint(client, "/system/identity/print"),
      mikrotikPrint(client, "/system/resource/print"),
      mikrotikPrint(client, "/ip/hotspot/active/print"),
      mikrotikPrint(client, "/ip/hotspot/user/print"),
      mikrotikPrint(client, "/log/print", ["?topics~hotspot"]),
    ]);

    return { identity: identity[0], resource: resource[0], sessions, users, logs };
  });

  const resource = data.resource;
  const totalMemory = Number(getRecordValue(resource, "total-memory") || 0);
  const freeMemory = Number(getRecordValue(resource, "free-memory") || 0);
  const totalHdd = Number(getRecordValue(resource, "total-hdd-space") || 0);
  const freeHdd = Number(getRecordValue(resource, "free-hdd-space") || 0);

  const hotspotLogs: HotspotLogEntry[] = data.logs.slice(-20).reverse().map((log, index) => {
    const message = getRecordValue(log, "message");
    const userMatch = message.match(/\(([^)]+)\)/);
    return {
      id: getRecordValue(log, ".id") || String(index),
      time: getRecordValue(log, "time"),
      user: userMatch?.[1] ?? "—",
      message,
    };
  });

  return {
    resource: {
      identity: getRecordValue(data.identity, "name"),
      cpuLoad: getRecordValue(resource, "cpu-load"),
      cpuCount: getRecordValue(resource, "cpu-count"),
      cpuFrequency: getRecordValue(resource, "cpu-frequency"),
      memoryUsed: formatBytes(totalMemory - freeMemory),
      memoryTotal: formatBytes(totalMemory),
      memoryPercent: totalMemory
        ? Math.round(((totalMemory - freeMemory) / totalMemory) * 100)
        : 0,
      hddUsed: formatBytes(totalHdd - freeHdd),
      hddTotal: formatBytes(totalHdd),
      hddPercent: totalHdd ? Math.round(((totalHdd - freeHdd) / totalHdd) * 100) : 0,
      uptime: getRecordValue(resource, "uptime"),
      version: getRecordValue(resource, "version"),
      boardName: getRecordValue(resource, "board-name"),
    },
    activeSessions: data.sessions.length,
    totalUsers: data.users.length,
    incomeToday: 0,
    incomeMonth: 0,
    currency: config.currency ?? "AED",
    appLogs: [
      `${new Date().toLocaleTimeString()} Loading Hotspot Info`,
      `${new Date().toLocaleTimeString()} Connected to ${config.sessionName}`,
      `${new Date().toLocaleTimeString()} Dashboard synced`,
    ],
    hotspotLogs,
    sessions: data.sessions.map((record) => mapActiveSession(record, config)),
  };
}

export async function fetchActiveSessions(): Promise<ActiveSession[]> {
  const configs = getConfiguredRouters();
  const sessions: ActiveSession[] = [];

  for (const config of configs) {
    try {
      sessions.push(...(await fetchActiveSessionsForRouter(config)));
    } catch {
      // Skip unreachable routers
    }
  }

  return sessions;
}

export async function fetchHotspotUsers(routerId?: string): Promise<HotspotUser[]> {
  const configs = getConfiguredRouters().filter(
    (config) => !routerId || config.id === routerId
  );
  const users: HotspotUser[] = [];

  for (const config of configs) {
    try {
      users.push(...(await fetchHotspotUsersForRouter(config)));
    } catch {
      // Skip unreachable routers
    }
  }

  return users;
}

export async function fetchUserProfiles(routerId?: string): Promise<UserProfile[]> {
  const configs = getConfiguredRouters().filter(
    (config) => !routerId || config.id === routerId
  );
  const profiles: UserProfile[] = [];

  for (const config of configs) {
    try {
      profiles.push(...(await fetchUserProfilesForRouter(config)));
    } catch {
      // Skip unreachable routers
    }
  }

  return profiles;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const routers = getConfiguredRouters();
  const sessions = await fetchActiveSessions();
  const users = await fetchHotspotUsers();

  let onlineRouters = 0;
  if (routers.length === 1) {
    const test = await testRouterConnection(routers[0]);
    onlineRouters = test.success ? 1 : 0;
  }

  const totalBytes = sessions.reduce((sum, session) => {
    const download = Number.parseFloat(session.download) || 0;
    const upload = Number.parseFloat(session.upload) || 0;
    return sum + download + upload;
  }, 0);

  return {
    totalRouters: routers.length,
    onlineRouters,
    activeSessions: sessions.length,
    totalUsers: users.length,
    revenueToday: 0,
    revenueMonth: 0,
    vouchersGenerated: 0,
    dataTransferred: formatBytes(totalBytes),
  };
}

export async function disconnectHotspotSession(
  config: MikrotikRouterConfig,
  sessionId: string
): Promise<void> {
  await withMikrotikClient(toConnectionParams(config), async (client) => {
    await client.write("/ip/hotspot/active/remove", [`=.id=${sessionId}`]);
  });
}
