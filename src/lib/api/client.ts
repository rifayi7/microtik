"use client";

import { useCallback, useEffect, useState } from "react";
import { toMikrotikConfig, type StoredRouter } from "@/lib/router-store";

interface ApiEnvelope {
  configured?: boolean;
  error?: string;
  message?: string;
}

export async function fetchMikrotikApi<T>(
  path: string,
  init?: RequestInit
): Promise<T & ApiEnvelope> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init?.headers as Record<string, string>) || {}),
  };

  const response = await fetch(path, {
    ...init,
    headers,
  });

  const payload = (await response.json()) as T & ApiEnvelope;

  if (!response.ok) {
    throw new Error(payload.error ?? payload.message ?? "Request failed");
  }

  return payload;
}

export async function fetchForRouter<T>(
  path: string,
  router: StoredRouter,
  init?: RequestInit
): Promise<T & ApiEnvelope> {
  const existingBody =
    init?.body && typeof init.body === "string"
      ? (JSON.parse(init.body) as Record<string, unknown>)
      : {};

  return fetchMikrotikApi<T>(path, {
    ...init,
    method: init?.method ?? "POST",
    body: JSON.stringify({
      router: toMikrotikConfig(router),
      ...existingBody,
    }),
  });
}

export function useMikrotikApi<T>(
  path: string,
  pick: (payload: Record<string, unknown>) => T
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  configured: boolean;
  reload: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await fetchMikrotikApi<Record<string, unknown> & ApiEnvelope>(path);
      setConfigured(payload.configured !== false);
      setData(pick(payload));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load data";
      setError(message);
      setConfigured(!message.includes("not configured"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [path, pick]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, configured, reload };
}
