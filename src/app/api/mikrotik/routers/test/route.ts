import { NextResponse } from "next/server";
import { withMikrotikClient, mikrotikPrint } from "@/lib/mikrotik/client";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const host = String(body.host || "").trim();
    const port = Number(body.port ?? 8728);
    const username = String(body.username || "").trim();
    const password = String(body.password ?? "");
    const useTls = Boolean(body.useTls);
    const timeout = Number(body.timeout ?? 10);
    const currentRouterId = body.currentRouterId ? String(body.currentRouterId) : undefined;

    if (!host || !username) {
      return NextResponse.json(
        { error: "Missing required fields: host, username" },
        { status: 400 }
      );
    }

    // 1. Connect to RouterOS and fetch hardware identity, resource, cloud, routerboard
    let discovery;
    try {
      discovery = await withMikrotikClient(
        {
          host,
          port,
          username,
          password,
          useTls,
          timeout,
        },
        async (client) => {
          const [
            identityRes,
            resourceRes,
            routerboardRes,
            cloudRes,
          ] = await Promise.all([
            mikrotikPrint(client, "/system/identity/print").catch(() => []),
            mikrotikPrint(client, "/system/resource/print").catch(() => []),
            mikrotikPrint(client, "/system/routerboard/print").catch(() => []),
            mikrotikPrint(client, "/ip/cloud/print").catch(() => []),
          ]);

          const identity = identityRes[0]?.name || "";
          const boardName = resourceRes[0]?.["board-name"] || resourceRes[0]?.platform || "MikroTik";
          const version = resourceRes[0]?.version || "";
          const uptime = resourceRes[0]?.uptime || "";
          const serialNumber = routerboardRes[0]?.["serial-number"] || "";
          const model = routerboardRes[0]?.model || boardName;
          const cloudDns = cloudRes[0]?.["dns-name"] || "";
          const publicIp = cloudRes[0]?.["public-address"] || "";

          return {
            identity,
            boardName,
            version,
            uptime,
            serialNumber,
            model,
            cloudDns,
            publicIp,
          };
        }
      );
    } catch (connErr) {
      return NextResponse.json(
        {
          success: false,
          error: connErr instanceof Error ? connErr.message : "Failed to connect to MikroTik router",
        },
        { status: 400 }
      );
    }

    // 2. Perform DB Duplicate Check by Hardware Serial Number or Cloud DNS
    const database = await getDB();
    let existingRouter: Record<string, unknown> | null = null;
    let duplicateReason: string | null = null;

    if (discovery.serialNumber) {
      const dupRes = await database.execute({
        sql: `
          SELECT r.id, r.sessionName, r.host, r.port, r.company_id, r.serialNumber, c.name as company_name
          FROM routers r
          LEFT JOIN companies c ON r.company_id = c.id
          WHERE r.serialNumber = ?
        `,
        args: [discovery.serialNumber],
      });

      if (dupRes.rows.length > 0) {
        const found = dupRes.rows[0];
        // If it's a different router ID, flag as duplicate
        if (!currentRouterId || String(found.id) !== currentRouterId) {
          existingRouter = {
            id: String(found.id),
            sessionName: String(found.sessionName),
            host: String(found.host),
            port: Number(found.port),
            companyId: found.company_id ? Number(found.company_id) : null,
            companyName: found.company_name ? String(found.company_name) : null,
            serialNumber: String(found.serialNumber),
          };
          duplicateReason = `This physical router (Serial #${discovery.serialNumber}) is already registered as "${found.sessionName}" under Company "${found.company_name || 'Unassigned'}".`;
        }
      }
    }

    // 3. Fallback duplicate check by Cloud DNS if serial number is unavailable (e.g. CHR)
    if (!existingRouter && discovery.cloudDns) {
      const dupCloudRes = await database.execute({
        sql: `
          SELECT r.id, r.sessionName, r.host, r.port, r.company_id, c.name as company_name
          FROM routers r
          LEFT JOIN companies c ON r.company_id = c.id
          WHERE LOWER(r.dnsName) = LOWER(?) OR LOWER(r.host) = LOWER(?)
        `,
        args: [discovery.cloudDns, discovery.cloudDns],
      });

      if (dupCloudRes.rows.length > 0) {
        const found = dupCloudRes.rows[0];
        if (!currentRouterId || String(found.id) !== currentRouterId) {
          existingRouter = {
            id: String(found.id),
            sessionName: String(found.sessionName),
            host: String(found.host),
            port: Number(found.port),
            companyId: found.company_id ? Number(found.company_id) : null,
            companyName: found.company_name ? String(found.company_name) : null,
          };
          duplicateReason = `This router is already registered under Cloud DNS "${discovery.cloudDns}" as "${found.sessionName}".`;
        }
      }
    }

    return NextResponse.json({
      success: true,
      discovery,
      isDuplicate: Boolean(existingRouter),
      duplicateReason,
      existingRouter,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal error testing router",
      },
      { status: 500 }
    );
  }
}
