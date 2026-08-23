import type { ConnectionStatus } from "@/lib/types";
import type { MikrotikRouterConfig } from "@/lib/mikrotik/config";

export interface StoredRouter {
  id: string;
  sessionName: string;
  host: string;
  port: number;
  username: string;
  password: string;
  useTls: boolean;
  hotspotName: string;
  dnsName: string;
  currency: string;
  sessionTimeout: string;
  liveReport: boolean;
  phone: string;
  camp?: string;
  status?: ConnectionStatus;
  verified?: boolean;
}

const ROUTERS_KEY = "hotspot-pro-routers";
const ACTIVE_KEY = "hotspot-pro-active-router";

export function toMikrotikConfig(router: StoredRouter): MikrotikRouterConfig {
  return {
    id: router.id,
    sessionName: router.sessionName,
    host: router.host,
    port: router.port,
    username: router.username,
    password: router.password,
    useTls: router.useTls,
    hotspotName: router.hotspotName,
    dnsName: router.dnsName,
    currency: router.currency,
    camp: router.camp,
    sessionTimeout: router.sessionTimeout,
    phone: router.phone,
    liveReport: router.liveReport,
  };
}

export function loadRouters(): StoredRouter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROUTERS_KEY);
    return raw ? (JSON.parse(raw) as StoredRouter[]) : [];
  } catch {
    return [];
  }
}

export function saveRouters(routers: StoredRouter[]): void {
  localStorage.setItem(ROUTERS_KEY, JSON.stringify(routers));
}

export function loadActiveRouterId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveRouterId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

export function createRouterId(): string {
  return `router-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
