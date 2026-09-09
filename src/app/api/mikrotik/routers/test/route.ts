import { NextResponse } from "next/server";
import { withMikrotikClient, mikrotikPrint } from "@/lib/mikrotik/client";
import { getDB } from "@/lib/db";
import { extractAuthToken } from "@/lib/auth-crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authUser = extractAuthToken(request);
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

    // 2. Perform DB Duplicate Check with Multi-Tenant Privacy Protection
    const database = await getDB();
    const targetCompanyId = body.companyId ? Number(body.companyId) : (authUser?.companyId ? Number(authUser.companyId) : null);
    const isSuperAdmin = authUser?.role === "superadmin";

    let existingRouter: Record<string, unknown> | null = null;
    let duplicateReason: string | null = null;

    if (discovery.serialNumber) {
      const dupRes = await database.execute({
        sql: `
          SELECT r.id, r.sessionName, r.host, r.port, r.company_id, r.serialNumber, r.is_active, c.name as company_name
          FROM routers r
          LEFT JOIN companies c ON r.company_id = c.id
          WHERE r.serialNumber = ? AND (r.is_active = 1 OR r.is_active IS NULL)
        `,
        args: [discovery.serialNumber],
      });

      if (dupRes.rows.length > 0) {
        const found = dupRes.rows[0];
        const ownerCompanyId = found.company_id ? Number(found.company_id) : null;
        const ownerCompanyName = found.company_name ? String(found.company_name) : "Unassigned";

        if (!currentRouterId || String(found.id) !== currentRouterId) {
          existingRouter = {
            id: String(found.id),
            serialNumber: String(found.serialNumber),
          };

          if (isSuperAdmin) {
            duplicateReason = `This router is currently registered under "${ownerCompanyName}" as "${found.sessionName}". You can reassign it by choosing another company.`;
            existingRouter.companyId = ownerCompanyId;
            existingRouter.companyName = ownerCompanyName;
            existingRouter.sessionName = String(found.sessionName);
          } else if (targetCompanyId && ownerCompanyId === targetCompanyId) {
            duplicateReason = `This router (Serial #${discovery.serialNumber}) is already registered in your company as "${found.sessionName}".`;
            existingRouter.sessionName = String(found.sessionName);
          } else {
            // Completely hide other company's name and details for 100% privacy
            duplicateReason = `This router hardware (Serial #${discovery.serialNumber}) is already registered in the system under another account. If you believe this is an error, please contact your Super Administrator.`;
          }
        }
      }
    }

    // 3. Fallback duplicate check by Cloud DNS
    if (!existingRouter && discovery.cloudDns) {
      const dupCloudRes = await database.execute({
        sql: `
          SELECT r.id, r.sessionName, r.host, r.port, r.company_id, c.name as company_name
          FROM routers r
          LEFT JOIN companies c ON r.company_id = c.id
          WHERE (LOWER(r.dnsName) = LOWER(?) OR LOWER(r.host) = LOWER(?)) AND (r.is_active = 1 OR r.is_active IS NULL)
        `,
        args: [discovery.cloudDns, discovery.cloudDns],
      });

      if (dupCloudRes.rows.length > 0) {
        const found = dupCloudRes.rows[0];
        const ownerCompanyId = found.company_id ? Number(found.company_id) : null;
        const ownerCompanyName = found.company_name ? String(found.company_name) : "Unassigned";

        if (!currentRouterId || String(found.id) !== currentRouterId) {
          existingRouter = {
            id: String(found.id),
          };

          if (isSuperAdmin) {
            duplicateReason = `This router is registered under Cloud DNS for "${ownerCompanyName}" as "${found.sessionName}".`;
            existingRouter.companyId = ownerCompanyId;
            existingRouter.companyName = ownerCompanyName;
          } else if (targetCompanyId && ownerCompanyId === targetCompanyId) {
            duplicateReason = `This router is already registered in your company under Cloud DNS as "${found.sessionName}".`;
          } else {
            duplicateReason = `This router is already registered in the system under another account. If you believe this is an error, please contact your Super Administrator.`;
          }
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
