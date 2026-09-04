import type { ConnectionStatus, Router } from "@/lib/types";

export interface MikrotikRouterConfig {
  id: string;
  sessionName: string;
  host: string;
  port: number;
  username: string;
  password: string;
  useTls: boolean;
  hotspotName?: string;
  dnsName?: string;
  currency?: string;
  camp?: string;
  sessionTimeout?: string;
  phone?: string;
  liveReport?: boolean;
  serialNumber?: string;
}

export interface MikrotikConnectionParams {
  host: string;
  port: number;
  username: string;
  password: string;
  useTls: boolean;
  timeout: number;
}

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  return value === "true" || value === "1";
}

function parsePort(value: string | undefined, useTls: boolean): number {
  if (value) return Number(value);
  return useTls ? 8729 : 8728;
}

function parseRoutersJson(raw: string): MikrotikRouterConfig[] {
  const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;

  return parsed.map((entry, index) => {
    const useTls = parseBoolean(entry.useTls as string | undefined);
    return {
      id: String(entry.id ?? index + 1),
      sessionName: String(entry.sessionName ?? entry.host ?? `router-${index + 1}`),
      host: String(entry.host),
      port: Number(entry.port ?? parsePort(undefined, useTls)),
      username: String(entry.username),
      password: String(entry.password ?? ""),
      useTls,
      hotspotName: entry.hotspotName ? String(entry.hotspotName) : undefined,
      dnsName: entry.dnsName ? String(entry.dnsName) : undefined,
      currency: entry.currency ? String(entry.currency) : undefined,
      camp: entry.camp ? String(entry.camp) : undefined,
      sessionTimeout: entry.sessionTimeout
        ? String(entry.sessionTimeout)
        : undefined,
      phone: entry.phone ? String(entry.phone) : undefined,
      liveReport:
        entry.liveReport === undefined
          ? undefined
          : parseBoolean(String(entry.liveReport)),
    };
  });
}

export function getMikrotikTimeout(): number {
  const raw = process.env.MIKROTIK_TIMEOUT;
  const timeout = raw ? Number(raw) : 15;
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 15;
}

export function getConfiguredRouters(): MikrotikRouterConfig[] {
  const json = process.env.MIKROTIK_ROUTERS?.trim();
  if (json) {
    return parseRoutersJson(json);
  }

  const host = process.env.MIKROTIK_HOST?.trim();
  const username = process.env.MIKROTIK_USERNAME?.trim();

  if (!host || !username) {
    return [];
  }

  const useTls = parseBoolean(process.env.MIKROTIK_USE_TLS);

  return [
    {
      id: "1",
      sessionName:
        process.env.MIKROTIK_SESSION_NAME?.trim() ||
        process.env.MIKROTIK_HOTSPOT_NAME?.trim() ||
        host,
      host,
      port: parsePort(process.env.MIKROTIK_PORT, useTls),
      username,
      password: process.env.MIKROTIK_PASSWORD ?? "",
      useTls,
      hotspotName:
        process.env.MIKROTIK_HOTSPOT_NAME?.trim() ||
        process.env.MIKROTIK_SESSION_NAME?.trim(),
      dnsName: process.env.MIKROTIK_DNS_NAME?.trim(),
      currency: process.env.MIKROTIK_CURRENCY?.trim() || "AED",
      camp: process.env.MIKROTIK_CAMP?.trim(),
      sessionTimeout: "30 minutes",
      liveReport: true,
    },
  ];
}

export function getRouterConfigById(id: string): MikrotikRouterConfig | undefined {
  return getConfiguredRouters().find((router) => router.id === id);
}

export function isMikrotikConfigured(): boolean {
  return getConfiguredRouters().length > 0;
}

export function toConnectionParams(
  config: MikrotikRouterConfig
): MikrotikConnectionParams {
  return {
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    useTls: config.useTls,
    timeout: getMikrotikTimeout(),
  };
}

export function toRouterModel(
  config: MikrotikRouterConfig,
  options: {
    status?: ConnectionStatus;
    activeUsers?: number;
    lastConnected?: string;
  } = {}
): Router {
  return {
    id: config.id,
    sessionName: config.sessionName,
    hotspotName: config.hotspotName ?? config.sessionName,
    ipAddress: config.host,
    port: config.port,
    username: config.username,
    password: "",
    dnsName: config.dnsName ?? "",
    currency: config.currency ?? "AED",
    sessionTimeout: config.sessionTimeout ?? "30 minutes",
    liveReport: config.liveReport ?? true,
    phone: config.phone ?? "",
    status: options.status ?? "unknown",
    lastConnected: options.lastConnected,
    activeUsers: options.activeUsers ?? 0,
    camp: config.camp,
  };
}
