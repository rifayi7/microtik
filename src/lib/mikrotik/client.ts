import { RouterOSAPI } from "node-routeros";
import type { MikrotikConnectionParams } from "./config";

export type RouterOSRecord = Record<string, string>;

export class MikrotikApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "MikrotikApiError";
  }
}

function normalizeError(error: unknown): MikrotikApiError {
  if (error instanceof MikrotikApiError) return error;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown MikroTik API error";

  return new MikrotikApiError(message);
}

export async function withMikrotikClient<T>(
  params: MikrotikConnectionParams,
  operation: (client: RouterOSAPI) => Promise<T>
): Promise<T> {
  const client = new RouterOSAPI({
    host: params.host,
    port: params.port,
    user: params.username,
    password: params.password,
    timeout: params.timeout,
    tls: params.useTls
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  });

  try {
    await client.connect();
    return await operation(client);
  } catch (error) {
    throw normalizeError(error);
  } finally {
    client.close();
  }
}

export async function mikrotikPrint(
  client: RouterOSAPI,
  path: string,
  queries: string[] = []
): Promise<RouterOSRecord[]> {
  const result = await client.write(path, queries);
  return result as RouterOSRecord[];
}
