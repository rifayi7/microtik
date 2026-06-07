import { NextResponse } from "next/server";
import { isMikrotikConfigured } from "@/lib/mikrotik/config";

export function mikrotikNotConfiguredResponse() {
  return NextResponse.json(
    {
      error: "MikroTik is not configured",
      message:
        "Add MIKROTIK_HOST, MIKROTIK_USERNAME, and MIKROTIK_PASSWORD to .env.local (see .env.example).",
      configured: false,
    },
    { status: 503 }
  );
}

export function mikrotikErrorResponse(error: unknown, fallback = "MikroTik request failed") {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message, configured: true }, { status: 500 });
}

export function ensureMikrotikConfigured(): NextResponse {
  return mikrotikNotConfiguredResponse();
}
