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

interface RouterContextValue {
  routers: StoredRouter[];
  activeRouter: StoredRouter | null;
  isConnected: boolean;
  isReady: boolean;
  addRouter: (router: Omit<StoredRouter, "id">) => StoredRouter;
  updateRouter: (id: string, patch: Partial<StoredRouter>) => void;
  removeRouter: (id: string) => void;
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
    status: "unknown",
  };
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [routers, setRouters] = useState<StoredRouter[]>([]);
  const [activeRouter, setActiveRouter] = useState<StoredRouter | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = loadRouters();
    setRouters(stored);
    const activeId = loadActiveRouterId();
    if (activeId) {
      const found = stored.find((item) => item.id === activeId) ?? null;
      setActiveRouter(found);
    }
    setIsReady(true);
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
      // Env not configured — user adds routers manually
    }
  }, [persist]);

  useEffect(() => {
    if (isReady && routers.length === 0) {
      void importEnvRouters();
    }
  }, [isReady, routers.length, importEnvRouters]);

  const addRouter = useCallback(
    (input: Omit<StoredRouter, "id">) => {
      const created: StoredRouter = { ...input, id: createRouterId(), status: "unknown" };
      persist([...routers, created]);
      return created;
    },
    [routers, persist]
  );

  const updateRouter = useCallback(
    (id: string, patch: Partial<StoredRouter>) => {
      const next = routers.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      );
      persist(next);
      if (activeRouter?.id === id) {
        setActiveRouter({ ...activeRouter, ...patch });
      }
    },
    [routers, activeRouter, persist]
  );

  const removeRouter = useCallback(
    (id: string) => {
      persist(routers.filter((item) => item.id !== id));
      if (activeRouter?.id === id) {
        setActiveRouter(null);
        saveActiveRouterId(null);
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
      isConnected: !!activeRouter,
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

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouterContext() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouterContext must be used within RouterProvider");
  }
  return context;
}
