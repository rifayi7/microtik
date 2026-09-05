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
import { getDB } from "@/lib/db";
import { CHARACTER_SETS } from "@/lib/constants";

export interface ConnectionTestResult {
  success: boolean;
  identity?: string;
  version?: string;
  boardName?: string;
  uptime?: string;
  serialNumber?: string;
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
        const [identity, resource, routerboard] = await Promise.all([
          mikrotikPrint(client, "/system/identity/print"),
          mikrotikPrint(client, "/system/resource/print"),
          mikrotikPrint(client, "/system/routerboard/print"),
        ]);

        return {
          identity: identity[0],
          resource: resource[0],
          routerboard: routerboard[0],
        };
      }
    );

    return {
      success: true,
      identity: getRecordValue(data.identity, "name"),
      version: getRecordValue(data.resource, "version"),
      boardName: getRecordValue(data.resource, "board-name"),
      uptime: getRecordValue(data.resource, "uptime"),
      serialNumber: getRecordValue(data.routerboard, "serial-number") || undefined,
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
  const routerUsers = records.map((record) => mapHotspotUser(record, config));

  try {
    const db = await getDB();
    const dbVouchers = await db.execute({
      sql: `SELECT voucher_code, status, sold_by, used_by, used_at, price_charged 
            FROM vouchers 
            WHERE router_id = ? OR router_id = ?`,
      args: [config.id, config.sessionName],
    });

    const voucherMap = new Map<string, any>();
    for (const v of dbVouchers.rows) {
      voucherMap.set(String(v.voucher_code).toLowerCase(), v);
    }

    for (const user of routerUsers) {
      const v = voucherMap.get(user.username.toLowerCase());
      if (v) {
        user.voucherStatus = (v.status as any) || "available";
        user.soldBy = v.sold_by ? String(v.sold_by) : undefined;
        user.usedBy = v.used_by ? String(v.used_by) : undefined;
        user.usedAt = v.used_at ? String(v.used_at) : undefined;
        user.priceCharged = v.price_charged ? Number(v.price_charged) : undefined;
      } else {
        user.voucherStatus = "available";
      }
    }
  } catch (err) {
    console.error("Failed to enrich hotspot users with voucher statuses:", err);
  }

  return routerUsers;
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

  let incomeToday = 0;
  let incomeMonth = 0;

  try {
    const db = await getDB();
    
    const todayResult = await db.execute({
      sql: `
        SELECT SUM(price_charged) as total 
        FROM vouchers 
        WHERE status = 'redeemed' 
          AND router_id = ? 
          AND date(used_at) = date('now')
      `,
      args: [config.id]
    });
    incomeToday = Number(todayResult.rows[0]?.total ?? 0);

    const monthResult = await db.execute({
      sql: `
        SELECT SUM(price_charged) as total 
        FROM vouchers 
        WHERE status = 'redeemed' 
          AND router_id = ? 
          AND strftime('%Y-%m', used_at) = strftime('%Y-%m', 'now')
      `,
      args: [config.id]
    });
    incomeMonth = Number(monthResult.rows[0]?.total ?? 0);
  } catch (dbError) {
    console.error("Failed to fetch income from DB", dbError);
  }

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
    incomeToday,
    incomeMonth,
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

  let revenueToday = 0;
  let revenueMonth = 0;
  try {
    const db = await getDB();
    const todayResult = await db.execute(`
      SELECT SUM(price_charged) as total 
      FROM vouchers 
      WHERE status = 'redeemed' 
        AND date(used_at) = date('now')
    `);
    revenueToday = Number(todayResult.rows[0]?.total ?? 0);

    const monthResult = await db.execute(`
      SELECT SUM(price_charged) as total 
      FROM vouchers 
      WHERE status = 'redeemed' 
        AND strftime('%Y-%m', used_at) = strftime('%Y-%m', 'now')
    `);
    revenueMonth = Number(monthResult.rows[0]?.total ?? 0);
  } catch (dbError) {
    console.error("Failed to fetch dashboard stats revenue from DB", dbError);
  }

  return {
    totalRouters: routers.length,
    onlineRouters,
    activeSessions: sessions.length,
    totalUsers: users.length,
    revenueToday,
    revenueMonth,
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

export interface ResetHotspotUserResult {
  userExists: boolean;
  disconnectedCount: number;
  macCleared: boolean;
  hadBoundMac: boolean;
  routerName?: string;
}

export async function resetHotspotActiveSessionByUsername(
  config: MikrotikRouterConfig,
  username: string
): Promise<ResetHotspotUserResult> {
  return await withMikrotikClient(toConnectionParams(config), async (client) => {
    const cleanUser = username.trim();
    let disconnectedCount = 0;
    let macCleared = false;
    let hadBoundMac = false;
    let userExists = false;
    const capturedMacs: string[] = [];

    // 1. Terminate all active HotSpot sessions for this user (with case-insensitive fallback)
    try {
      let activeRecords = (await client.write("/ip/hotspot/active/print", [
        `?user=${cleanUser}`,
      ])) as RouterOSRecord[];

      if (!activeRecords || activeRecords.length === 0) {
        const allActives = (await client.write("/ip/hotspot/active/print")) as RouterOSRecord[];
        activeRecords = allActives.filter(
          (a) => (a.user || "").toLowerCase() === cleanUser.toLowerCase()
        );
      }

      if (activeRecords && activeRecords.length > 0) {
        for (const record of activeRecords) {
          const sessionId = record[".id"];
          const mac = record["mac-address"];
          if (mac && typeof mac === "string" && mac.trim()) {
            capturedMacs.push(mac.trim());
          }
          if (sessionId) {
            await client.write("/ip/hotspot/active/remove", [`=.id=${sessionId}`]);
            disconnectedCount++;
          }
        }
      }
    } catch (e) {
      console.warn("Could not remove active session:", e);
    }

    // 2. Query and clear MAC-address binding from /ip/hotspot/user (with case-insensitive fallback)
    try {
      let userRecords = (await client.write("/ip/hotspot/user/print", [
        `?name=${cleanUser}`,
      ])) as RouterOSRecord[];

      if (!userRecords || userRecords.length === 0) {
        const allUsers = (await client.write("/ip/hotspot/user/print")) as RouterOSRecord[];
        userRecords = allUsers.filter(
          (u) => (u.name || "").toLowerCase() === cleanUser.toLowerCase()
        );
      }

      if (userRecords && userRecords.length > 0) {
        userExists = true;
        for (const uRecord of userRecords) {
          const userId = uRecord[".id"];
          const userMac = uRecord["mac-address"];
          if (userMac && typeof userMac === "string" && userMac.trim()) {
            capturedMacs.push(userMac.trim());
          }

          const isMacBound = Boolean(
            userMac &&
            userMac.trim() !== "" &&
            userMac.trim() !== "00:00:00:00:00:00"
          );

          if (isMacBound) {
            hadBoundMac = true;
          }

          if (userId) {
            try {
              // Setting mac-address=00:00:00:00:00:00 in RouterOS immediately clears and removes the MAC binding
              await client.write("/ip/hotspot/user/set", [
                `=.id=${userId}`,
                `=mac-address=00:00:00:00:00:00`,
              ]);

              // Verify the MAC is indeed cleared in RouterOS
              const verifyUser = (await client.write("/ip/hotspot/user/print", [
                `?.id=${userId}`,
              ])) as RouterOSRecord[];

              const isNowCleared =
                !verifyUser[0]?.["mac-address"] ||
                verifyUser[0]?.["mac-address"] === "00:00:00:00:00:00";

              if (isNowCleared && hadBoundMac) {
                macCleared = true;
              }
            } catch (errSet) {
              console.warn("Could not set user mac-address=00:00:00:00:00:00:", errSet);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Could not query or clear user records:", e);
    }

    // 3. Purge matching cookies from /ip/hotspot/cookie (by user name and captured MACs)
    try {
      const cookieRecords = (await client.write("/ip/hotspot/cookie/print", [
        `?user=${cleanUser}`,
      ])) as RouterOSRecord[];

      if (cookieRecords && cookieRecords.length > 0) {
        for (const cRecord of cookieRecords) {
          const cookieId = cRecord[".id"];
          if (cookieId) {
            await client.write("/ip/hotspot/cookie/remove", [`=.id=${cookieId}`]);
          }
        }
      }

      for (const mac of capturedMacs) {
        try {
          const macCookies = (await client.write("/ip/hotspot/cookie/print", [
            `?mac-address=${mac}`,
          ])) as RouterOSRecord[];
          for (const mc of macCookies) {
            if (mc[".id"]) {
              await client.write("/ip/hotspot/cookie/remove", [`=.id=${mc[".id"]}`]);
            }
          }
        } catch {}
      }
    } catch {
      // Cookies may not be enabled or present
    }

    // 4. Purge host entries from /ip/hotspot/host to drop cached authorization
    try {
      const hostRecords = (await client.write("/ip/hotspot/host/print", [
        `?user=${cleanUser}`,
      ])) as RouterOSRecord[];

      if (hostRecords && hostRecords.length > 0) {
        for (const hRecord of hostRecords) {
          const hostId = hRecord[".id"];
          if (hostId) {
            await client.write("/ip/hotspot/host/remove", [`=.id=${hostId}`]);
          }
        }
      }

      for (const mac of capturedMacs) {
        try {
          const macHosts = (await client.write("/ip/hotspot/host/print", [
            `?mac-address=${mac}`,
          ])) as RouterOSRecord[];
          for (const mh of macHosts) {
            if (mh[".id"]) {
              await client.write("/ip/hotspot/host/remove", [`=.id=${mh[".id"]}`]);
            }
          }
        } catch {}
      }
    } catch {
      // Host table purge is optional
    }

    return {
      userExists,
      disconnectedCount,
      macCleared,
      hadBoundMac,
      routerName: config.camp || config.sessionName,
    };
  });
}

export async function updateOrCreateHotspotUser(
  config: MikrotikRouterConfig,
  username: string,
  password: string,
  profile: string,
  comment: string
): Promise<void> {
  await withMikrotikClient(toConnectionParams(config), async (client) => {
    // 1. Find user by name (voucher code)
    const records = await client.write("/ip/hotspot/user/print", [
      `?name=${username}`,
    ]) as RouterOSRecord[];

    if (records.length > 0) {
      // User exists, update the comment
      const id = records[0][".id"];
      await client.write("/ip/hotspot/user/set", [
        `=.id=${id}`,
        `=comment=${comment}`,
      ]);
    } else {
      // User does not exist, create a new one
      await client.write("/ip/hotspot/user/add", [
        `=name=${username}`,
        `=password=${password}`,
        `=profile=${profile}`,
        `=comment=${comment}`,
      ]);
    }
  });
}

export async function addHotspotUser(
  config: MikrotikRouterConfig,
  user: {
    username: string;
    password?: string;
    profile?: string;
    limitUptime?: string;
    comment?: string;
  }
): Promise<void> {
  await withMikrotikClient(toConnectionParams(config), async (client) => {
    const queries = [
      `=name=${user.username}`,
      `=password=${user.password ?? ""}`,
      `=profile=${user.profile ?? "default"}`,
    ];
    if (user.limitUptime) {
      queries.push(`=limit-uptime=${user.limitUptime}`);
    }
    if (user.comment) {
      queries.push(`=comment=${user.comment}`);
    }
    await client.write("/ip/hotspot/user/add", queries);
  });
}

export async function generateHotspotUsers(
  config: MikrotikRouterConfig,
  params: {
    qty: number;
    server: string;
    userMode: "username_equals_password" | "username_and_password" | "username_only";
    nameLength: number;
    prefix: string;
    characters: string;
    profile: string;
    comment: string;
  }
): Promise<string[]> {
  // 1. Fetch existing users to check for duplicates
  const existingUsers = await fetchHotspotUsersForRouter(config);
  const existingSet = new Set(existingUsers.map((u) => u.username.toLowerCase()));

  // 2. Generate unique codes
  const newItems: { username: string; password: string }[] = [];
  const rawPool = params.characters || "1234";
  const charPool = CHARACTER_SETS[rawPool] || rawPool || "123456789";
  const prefix = params.prefix || "";
  const lengthToGen = Math.max(1, params.nameLength - prefix.length);

  const getRandomStr = (len: number) => {
    let s = "";
    for (let j = 0; j < len; j++) {
      const randIndex = Math.floor(Math.random() * charPool.length);
      s += charPool[randIndex];
    }
    return s;
  };

  for (let i = 0; i < params.qty; i++) {
    let attempts = 0;
    let username = "";
    do {
      username = prefix + getRandomStr(lengthToGen);
      attempts++;
    } while (
      (existingSet.has(username.toLowerCase()) || newItems.some((item) => item.username.toLowerCase() === username.toLowerCase())) &&
      attempts < 1000
    );

    if (attempts >= 1000) {
      throw new Error(
        "Could not generate enough unique codes. Please increase character pool or name length."
      );
    }

    let password = "";
    if (params.userMode === "username_equals_password") {
      password = username;
    } else if (params.userMode === "username_and_password") {
      password = getRandomStr(lengthToGen);
    } else if (params.userMode === "username_only") {
      password = "";
    }

    newItems.push({ username, password });
    // Keep set updated in real-time to avoid duplicate generation inside the loop
    existingSet.add(username.toLowerCase());
  }

  // 3. Write all generated users to the router
  await withMikrotikClient(toConnectionParams(config), async (client) => {
    for (const item of newItems) {
      const queries = [
        `=name=${item.username}`,
        `=password=${item.password}`,
        `=profile=${params.profile || "default"}`,
      ];
      if (params.server && params.server !== "all") {
        queries.push(`=server=${params.server}`);
      }
      if (params.comment) {
        queries.push(`=comment=${params.comment}`);
      }
      await client.write("/ip/hotspot/user/add", queries);
    }
  });

  return newItems.map((item) => item.username);
}

/**
 * Syncs live hotspot users from the router into the DB.
 *
 * Called on every successful connect so the DB always reflects what is on the router:
 * - INSERT OR REPLACE all users that exist on the router (preserving redeemed status / metadata
 *   for codes already in the DB that have been sold).
 * - DELETE rows whose codes no longer exist on the router (deleted from RouterOS).
 *
 * Returns the number of rows synced.
 */
export async function syncRouterUsersToDb(
  config: MikrotikRouterConfig
): Promise<{ synced: number; removed: number }> {
  const { getDB } = await import("@/lib/db");

  const liveUsers = await fetchHotspotUsersForRouter(config);

  if (liveUsers.length === 0) {
    return { synced: 0, removed: 0 };
  }

  const db = await getDB();
  const liveCodes = new Set(liveUsers.map((u) => u.username));

  // Build upsert statements — preserve existing redeemed/sold metadata when present
  const upsertStatements = liveUsers
    .map((user) => {
      const profile = user.profile;
      const match = profile.match(/(\d+)\D*days?/i);
      let validityDays = 0;
      if (match) {
        validityDays = Number(match[1]);
      } else {
        const numeric = Number(profile.replace(/[^0-9]/g, ""));
        validityDays = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
      }

      // Skip users with unparseable profiles (e.g. "default", "trial")
      if (validityDays <= 0) return null;

      const commentStr = user.comment ?? "";
      const isRedeemed =
        commentStr.includes("Mobile:") || commentStr.includes("Mobile :");
      const routerStatus =
        user.status === "disabled" ? "disabled" : "active";

      let mobile = "";
      let salesperson = "";
      if (isRedeemed) {
        const mobileMatch = commentStr.match(/Mobile\s*:\s*([+\w\s-]+)/i);
        if (mobileMatch) mobile = mobileMatch[1].trim();
        const sellerMatch = commentStr.match(/Sold\s*by\s*:\s*([\w-]+)/i);
        if (sellerMatch) salesperson = sellerMatch[1].trim();
      }

      return {
        sql: `
          INSERT INTO vouchers (
            voucher_code, validity_days, status, router_id,
            used_by, sold_by, activation_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(voucher_code) DO UPDATE SET
            validity_days   = excluded.validity_days,
            router_id       = excluded.router_id,
            -- Only update status if the DB row is 'available' or 'disabled'.
            -- Keep 'redeemed' / 'reserved' rows intact so sales history is preserved.
            status          = CASE
              WHEN vouchers.status IN ('redeemed', 'reserved') THEN vouchers.status
              ELSE excluded.status
            END,
            used_by         = CASE
              WHEN vouchers.status = 'redeemed' THEN vouchers.used_by
              ELSE excluded.used_by
            END,
            sold_by         = CASE
              WHEN vouchers.status = 'redeemed' THEN vouchers.sold_by
              ELSE excluded.sold_by
            END
        `,
        args: [
          user.username,
          validityDays,
          isRedeemed ? "redeemed" : routerStatus === "disabled" ? "disabled" : "available",
          config.id,
          isRedeemed ? mobile || null : null,
          isRedeemed ? salesperson || null : null,
          "pending",
        ],
      };
    })
    .filter((s) => s !== null) as { sql: string; args: (string | number | null)[] }[];

  if (upsertStatements.length > 0) {
    await db.batch(upsertStatements, "write");
  }

  // Remove DB rows that no longer exist on the router
  // (only touch 'available' / 'disabled' rows — keep redeemed history)
  const dbResult = await db.execute({
    sql: "SELECT voucher_code FROM vouchers WHERE router_id = ? AND status IN ('available', 'disabled')",
    args: [config.id],
  });

  const orphans = dbResult.rows
    .map((r) => String(r.voucher_code))
    .filter((code) => !liveCodes.has(code));

  if (orphans.length > 0) {
    // Delete in chunks of 50 to stay within SQL parameter limits
    for (let i = 0; i < orphans.length; i += 50) {
      const chunk = orphans.slice(i, i + 50);
      const placeholders = chunk.map(() => "?").join(", ");
      await db.execute({
        sql: `DELETE FROM vouchers WHERE router_id = ? AND voucher_code IN (${placeholders}) AND status IN ('available', 'disabled')`,
        args: [config.id, ...chunk],
      });
    }
  }

  console.log(
    `[sync] router=${config.sessionName} synced=${upsertStatements.length} removed=${orphans.length}`
  );
  return { synced: upsertStatements.length, removed: orphans.length };
}

/**
 * Deletes one or multiple hotspot users from MikroTik RouterOS
 * and purges matching available/disabled rows from the vouchers DB table.
 */
export async function removeHotspotUsersFromRouter(
  config: MikrotikRouterConfig,
  usernamesOrIds: string[]
): Promise<{ deletedCount: number }> {
  if (!usernamesOrIds || usernamesOrIds.length === 0) {
    return { deletedCount: 0 };
  }

  const deletedUsernames: string[] = [];

  // 1. Remove from MikroTik live RouterOS
  await withMikrotikClient(toConnectionParams(config), async (client) => {
    for (const item of usernamesOrIds) {
      try {
        let userId = item;
        let userName = item;

        // If not starting with "*", find by name
        if (!item.startsWith("*")) {
          const records = (await client.write("/ip/hotspot/user/print", [
            `?name=${item}`,
          ])) as RouterOSRecord[];
          if (records.length > 0 && records[0][".id"]) {
            userId = records[0][".id"];
            userName = records[0]["name"] || item;
          } else {
            // Already deleted from router
            deletedUsernames.push(item);
            continue;
          }
        } else {
          const records = (await client.write("/ip/hotspot/user/print", [
            `?.id=${item}`,
          ])) as RouterOSRecord[];
          if (records.length > 0) {
            userName = records[0]["name"] || item;
          }
        }

        // Drop any active session for this user
        try {
          const activeRecs = (await client.write("/ip/hotspot/active/print", [
            `?user=${userName}`,
          ])) as RouterOSRecord[];
          for (const aRec of activeRecs) {
            if (aRec[".id"]) {
              await client.write("/ip/hotspot/active/remove", [`=.id=${aRec[".id"]}`]);
            }
          }
        } catch {}

        // Remove the user from /ip/hotspot/user
        await client.write("/ip/hotspot/user/remove", [`=.id=${userId}`]);
        deletedUsernames.push(userName);
      } catch (err) {
        console.warn(`[removeHotspotUser] Failed to remove ${item} from router:`, err);
        // Even if router remove fails or already gone, still add to purge DB
        deletedUsernames.push(item);
      }
    }
  });

  // 2. Remove matching codes from vouchers database (ONLY delete available/disabled inventory, NEVER delete redeemed sales history)
  if (deletedUsernames.length > 0) {
    try {
      const db = await getDB();
      for (let i = 0; i < deletedUsernames.length; i += 50) {
        const chunk = deletedUsernames.slice(i, i + 50);
        const placeholders = chunk.map(() => "?").join(", ");
        await db.execute({
          sql: `DELETE FROM vouchers WHERE router_id = ? AND voucher_code IN (${placeholders}) AND status IN ('available', 'disabled')`,
          args: [config.id, ...chunk],
        });
      }
    } catch (dbErr) {
      console.error("[removeHotspotUser] Failed to delete from DB vouchers:", dbErr);
    }
  }

  return { deletedCount: deletedUsernames.length };
}
