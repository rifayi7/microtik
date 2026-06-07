import {
  getConfiguredRouters,
  getRouterConfigById,
  type MikrotikRouterConfig,
} from "./config";

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
    camp: router.camp ? String(router.camp) : undefined,
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
      return getRouterConfigById(routerId) ?? null;
    }
  } catch {
    // No JSON body — fall through to env
  }

  const envRouters = getConfiguredRouters();
  return envRouters[0] ?? null;
}

export function resolveRouterFromRequestSync(
  body: unknown,
  routerId?: string | null
): MikrotikRouterConfig | null {
  const fromBody = parseRouterFromBody(body);
  if (fromBody) return fromBody;

  if (routerId) {
    return getRouterConfigById(routerId) ?? null;
  }

  const envRouters = getConfiguredRouters();
  return envRouters[0] ?? null;
}
