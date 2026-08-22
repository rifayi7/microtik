import { getDB } from "../db";
import {
  getConfiguredRouters,
  getRouterConfigById,
  type MikrotikRouterConfig,
} from "./config";

async function getRouterFromDatabase(id: string): Promise<MikrotikRouterConfig | null> {
  try {
    const database = await getDB();
    const result = await database.execute({
      sql: "SELECT * FROM routers WHERE id = ?",
      args: [id],
    });
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: String(row.id),
      sessionName: String(row.sessionName),
      host: String(row.host),
      port: Number(row.port),
      username: String(row.username),
      password: String(row.password ?? ""),
      useTls: Boolean(row.useTls),
      hotspotName: row.hotspotName ? String(row.hotspotName) : undefined,
      dnsName: row.dnsName ? String(row.dnsName) : undefined,
      currency: row.currency ? String(row.currency) : undefined,
      camp: row.camp ? String(row.camp) : undefined,
      sessionTimeout: row.sessionTimeout ? String(row.sessionTimeout) : undefined,
      phone: row.phone ? String(row.phone) : undefined,
      liveReport: row.liveReport !== undefined ? Boolean(row.liveReport) : true,
    };
  } catch (e) {
    console.warn("Failed to load router config from database:", e);
    return null;
  }
}

export function parseRouterFromBody(body: unknown): MikrotikRouterConfig | null {
  if (!body || typeof body !== "object") return null;

  const payload = body as Record<string, unknown>;
  const router = payload.router as Record<string, unknown> | undefined;

  if (!router?.host || !router?.username) return null;

  return {
    id: String(router.id ?? "custom"),
    sessionName: String(router.sessionName ?? router.host),
    host: String(router.host),
    port: Number(router.port ?? 8728),
    username: String(router.username),
    password: String(router.password ?? ""),
    useTls: Boolean(router.useTls),
    hotspotName: router.hotspotName ? String(router.hotspotName) : undefined,
    dnsName: router.dnsName ? String(router.dnsName) : undefined,
    currency: router.currency ? String(router.currency) : undefined,
    camp: router.camp ? String(router.camp) : undefined, // fallback/safeguard
    sessionTimeout: router.sessionTimeout ? String(router.sessionTimeout) : undefined,
    phone: router.phone ? String(router.phone) : undefined,
    liveReport:
      router.liveReport === undefined ? undefined : Boolean(router.liveReport),
  };
}

export async function resolveRouterFromRequest(
  request: Request
): Promise<MikrotikRouterConfig | null> {
  try {
    const body = await request.clone().json();
    const fromBody = parseRouterFromBody(body);
    if (fromBody) return fromBody;

    const routerId = (body as Record<string, unknown>).routerId;
    if (typeof routerId === "string") {
      const dbRouter = await getRouterFromDatabase(routerId);
      if (dbRouter) return dbRouter;
      return getRouterConfigById(routerId) ?? null;
    }
  } catch {
    // No JSON body — fall through to env
  }

  const envRouters = getConfiguredRouters();
  return envRouters[0] ?? null;
}

export async function resolveRouterFromRequestSync(
  body: unknown,
  routerId?: string | null
): Promise<MikrotikRouterConfig | null> {
  const fromBody = parseRouterFromBody(body);
  if (fromBody) return fromBody;

  if (routerId) {
    const dbRouter = await getRouterFromDatabase(routerId);
    if (dbRouter) return dbRouter;
    return getRouterConfigById(routerId) ?? null;
  }

  const envRouters = getConfiguredRouters();
  return envRouters[0] ?? null;
}
