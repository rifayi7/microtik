"use client";

import { useCallback, useEffect, useState } from "react";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  configured: boolean;
  reload: () => Promise<void>;
}

interface ApiEnvelope {
  configured?: boolean;
  error?: string;
  message?: string;
}

export async function fetchMikrotikApi<T>(
  path: string,
  init?: RequestInit
): Promise<T & ApiEnvelope> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const payload = (await response.json()) as T & ApiEnvelope;

  if (!response.ok) {
    throw new Error(payload.error ?? payload.message ?? "Request failed");
  }

  return payload;
}

export function useMikrotikApi<T>(
  path: string,
  pick: (payload: Record<string, unknown>) => T
): ApiState<T> {
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
