"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createRouterId,
  loadActiveRouterId,
  loadRouters,
  saveActiveRouterId,
  saveRouters,
  toMikrotikConfig,
  type StoredRouter,
} from "@/lib/router-store";
import { fetchMikrotikApi } from "@/lib/api/client";
import type { ConnectionStatus } from "@/lib/types";

interface RouterContextValue {
  routers: StoredRouter[];
  activeRouter: StoredRouter | null;
  isConnected: boolean;
  isReady: boolean;
  addRouter: (router: Omit<StoredRouter, "id">) => Promise<StoredRouter | undefined>;
  updateRouter: (id: string, patch: Partial<StoredRouter>) => Promise<void>;
  removeRouter: (id: string) => Promise<void>;
  connectRouter: (id: string) => Promise<boolean>;
  disconnectRouter: () => void;
  importEnvRouters: () => Promise<void>;
}

const RouterContext = createContext<RouterContextValue | null>(null);

function mapEnvRouter(raw: Record<string, unknown>): StoredRouter {
  return {
    id: String(raw.id ?? createRouterId()),
    sessionName: String(raw.sessionName ?? raw.host ?? "Router"),
    host: String(raw.host ?? raw.ipAddress ?? ""),
    port: Number(raw.port ?? 8728),
    username: String(raw.username ?? ""),
    password: String(raw.password ?? ""),
    useTls: Boolean(raw.useTls),
    hotspotName: String(raw.hotspotName ?? raw.sessionName ?? ""),
    dnsName: String(raw.dnsName ?? ""),
    currency: String(raw.currency ?? "AED"),
    sessionTimeout: String(raw.sessionTimeout ?? "30 minutes"),
    liveReport: Boolean(raw.liveReport ?? true),
    phone: String(raw.phone ?? ""),
    camp: raw.camp ? String(raw.camp) : undefined,
    status: (raw.status as ConnectionStatus) ?? "unknown",
    verified: Boolean(raw.verified ?? (Number(raw.verified_status) === 1)),
  };
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [routers, setRouters] = useState<StoredRouter[]>([]);
  const [activeRouter, setActiveRouter] = useState<StoredRouter | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Load configuration from database API on mount (fallback to localStorage if offline)
  useEffect(() => {
    async function loadFromDB() {
      try {
        const companyName = typeof window !== "undefined" ? localStorage.getItem("admin_company_name") : null;
        const url = companyName ? `/api/mikrotik/routers?company=${encodeURIComponent(companyName)}` : "/api/mikrotik/routers";
        const payload = await fetchMikrotikApi<{ routers: Record<string, unknown>[]; configured: boolean }>(url);
        const mapped = (payload.routers || []).map(mapEnvRouter);
        setRouters(mapped);
        saveRouters(mapped); // Cache locally for offline availability

        const activeId = loadActiveRouterId();
        if (activeId && mapped.some((m) => m.id === activeId)) {
          const found = mapped.find((item) => item.id === activeId) ?? null;
          setActiveRouter(found);
        } else if (mapped.length > 0) {
          setActiveRouter(mapped[0]);
          saveActiveRouterId(mapped[0].id);
        } else {
          setActiveRouter(null);
        }
      } catch (err) {
        console.warn("Failed to load routers from server database. Using offline cache.", err);
        const stored = loadRouters();
        setRouters(stored);
        const activeId = loadActiveRouterId();
        if (activeId) {
          const found = stored.find((item) => item.id === activeId) ?? null;
          setActiveRouter(found);
        }
      } finally {
        setIsReady(true);
      }
    }
    void loadFromDB();
  }, []);

  const persist = useCallback((next: StoredRouter[]) => {
    setRouters(next);
    saveRouters(next);
  }, []);

  const importEnvRouters = useCallback(async () => {
    try {
      const payload = await fetchMikrotikApi<{ routers: Record<string, unknown>[] }>(
        "/api/mikrotik/routers"
      );
      if (!payload.routers?.length) return;

      const existing = loadRouters();
      const merged = [...existing];

      for (const envRouter of payload.routers) {
        const mapped = mapEnvRouter(envRouter as Record<string, unknown>);
        const duplicate = merged.find(
          (item) =>
            item.host === mapped.host &&
            item.port === mapped.port &&
            item.username === mapped.username
        );
        if (!duplicate) merged.push(mapped);
      }

      persist(merged);
    } catch {
      // Env not configured
    }
  }, [persist]);

  const addRouter = useCallback(
    async (input: Omit<StoredRouter, "id">) => {
      try {
        const payload = await fetchMikrotikApi<{ router: Record<string, unknown>; success: boolean; error?: string }>(
          "/api/mikrotik/routers",
          {
            method: "POST",
            body: JSON.stringify(input),
          }
        );

        if (payload.success && payload.router) {
          const created = mapEnvRouter(payload.router);
          const next = [...routers, created];
          persist(next);
          return created;
        } else {
          throw new Error(payload.error ?? "Failed to save router");
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Network error";
        toast.error("Failed to save router: " + errMsg);
        throw err;
      }
    },
    [routers, persist]
  );

  const updateRouter = useCallback(
    async (id: string, patch: Partial<StoredRouter>) => {
      try {
        await fetchMikrotikApi(`/api/mikrotik/routers/${id}`, {
          method: "PUT",
          body: JSON.stringify(patch),
        });

        const next = routers.map((item) =>
          item.id === id ? { ...item, ...patch } : item
        );
        persist(next);
        if (activeRouter?.id === id) {
          setActiveRouter({ ...activeRouter, ...patch });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Network error";
        toast.error("Failed to update router: " + errMsg);
      }
    },
    [routers, activeRouter, persist]
  );

  const removeRouter = useCallback(
    async (id: string) => {
      try {
        await fetchMikrotikApi(`/api/mikrotik/routers/${id}`, {
          method: "DELETE",
        });

        persist(routers.filter((item) => item.id !== id));
        if (activeRouter?.id === id) {
          setActiveRouter(null);
          saveActiveRouterId(null);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Network error";
        toast.error("Failed to delete router: " + errMsg);
      }
    },
    [routers, activeRouter, persist]
  );

  const connectRouter = useCallback(
    async (id: string) => {
      const target = routers.find((item) => item.id === id);
      if (!target) return false;

      const result = await fetchMikrotikApi<{ success: boolean; error?: string }>(
        "/api/mikrotik/connect",
        {
          method: "POST",
          body: JSON.stringify({ router: toMikrotikConfig(target) }),
        }
      );

      if (!result.success) {
        throw new Error(result.error ?? "Connection failed");
      }

      const connected = { ...target, status: "online" as const };
      updateRouter(id, { status: "online" });
      setActiveRouter(connected);
      saveActiveRouterId(id);
      router.push("/dashboard");
      return true;
    },
    [routers, updateRouter, router]
  );

  const disconnectRouter = useCallback(() => {
    setActiveRouter(null);
    saveActiveRouterId(null);
    router.push("/settings/routers");
  }, [router]);

  const value = useMemo(
    () => ({
      routers,
      activeRouter,
      isConnected: activeRouter !== null,
      isReady,
      addRouter,
      updateRouter,
      removeRouter,
      connectRouter,
      disconnectRouter,
      importEnvRouters,
    }),
    [
      routers,
      activeRouter,
      isReady,
      addRouter,
      updateRouter,
      removeRouter,
      connectRouter,
      disconnectRouter,
      importEnvRouters,
    ]
  );

  return (
    <RouterContext.Provider value={value}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouterContext() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouterContext must be used within RouterProvider");
  }
  return context;
}
