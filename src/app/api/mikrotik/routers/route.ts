import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import { testRouterConnection } from "@/lib/mikrotik/queries";
import { extractAuthToken } from "@/lib/auth-crypto";

export const runtime = "nodejs";

// GET /api/mikrotik/routers
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const verifiedOnly = searchParams.get("verified") === "true";
    const companyFilter = searchParams.get("company");
    const salespersonFilter = searchParams.get("salesperson");
    const salesPersonIdFilter = searchParams.get("salesPersonId");
    
    let authUser = extractAuthToken(request);
    
    const database = await getDB();
    
    // Dynamically query latest allowed_camps and company_id from DB for salesperson
    if (authUser?.role === "salesperson" || (!authUser && (salesPersonIdFilter || salespersonFilter))) {
      try {
        const lookupId = salesPersonIdFilter || (authUser?.userId ? String(authUser.userId) : "");
        const lookupName = salespersonFilter || (authUser?.sub ? String(authUser.sub) : "");
        const spRes = await database.execute({
          sql: "SELECT id, username, display_name, role, company_id, allowed_camps FROM sales_persons WHERE id = ? OR username = ? OR display_name = ? LIMIT 1",
          args: [lookupId, lookupName, lookupName],
        });
        if (spRes.rows.length > 0) {
          const row = spRes.rows[0];
          let liveAllowedCamps: string[] = [];
          if (row.allowed_camps) {
            try {
              liveAllowedCamps = JSON.parse(String(row.allowed_camps));
            } catch {
              liveAllowedCamps = [String(row.allowed_camps)];
            }
          }
          authUser = {
            sub: String(row.username),
            userId: Number(row.id),
            role: String(row.role || "salesperson"),
            companyId: row.company_id ? Number(row.company_id) : (authUser?.companyId ? Number(authUser.companyId) : undefined),
            allowedCamps: liveAllowedCamps,
          };
        }
      } catch (err) {
        console.warn("Could not query dynamic salesperson permissions:", err);
      }
    }

    // Join with companies table to resolve dynamic company_name and enforce ID relationships (Active routers only)
    const conditions = ["(r.is_active = 1 OR r.is_active IS NULL)"];
    if (verifiedOnly) {
      conditions.push("r.verified_status = 1");
    }

    const query = `
      SELECT r.*, c.name as company_name, c.id as resolved_company_id
      FROM routers r
      LEFT JOIN companies c ON r.company_id = c.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY r.sessionName ASC
    `;
    const result = await database.execute(query);
    
    let dbRouters = result.rows.map((row) => ({
      id: String(row.id),
      sessionName: String(row.sessionName),
      host: String(row.host),
      ipAddress: String(row.host),
      port: Number(row.port),
      username: String(row.username),
      password: String(row.password ?? ""),
      useTls: Boolean(row.useTls),
      hotspotName: String(row.hotspotName ?? row.sessionName),
      dnsName: String(row.dnsName ?? ""),
      currency: String(row.currency ?? "AED"),
      sessionTimeout: String(row.sessionTimeout ?? "30 minutes"),
      liveReport: Boolean(row.liveReport ?? true),
      phone: String(row.phone ?? ""),
      camp: row.company_name ? String(row.company_name) : (row.camp ? String(row.camp) : undefined),
      company: row.company_name ? String(row.company_name) : undefined,
      companyId: row.resolved_company_id ? Number(row.resolved_company_id) : (row.company_id ? Number(row.company_id) : undefined),
      serialNumber: row.serialNumber ? String(row.serialNumber) : undefined,
      status: Number(row.verified_status) === 1 ? "offline" : "unknown",
      verified: Number(row.verified_status) === 1,
    }));

    // Company filter
    if (companyFilter && companyFilter.trim()) {
      const cLower = companyFilter.trim().toLowerCase();
      dbRouters = dbRouters.filter((r) => {
        return (r.company && r.company.toLowerCase() === cLower) ||
               (r.camp && r.camp.toLowerCase() === cLower);
      });
    }

    // Salesperson scoping: filter by explicitly allowed router IDs in allowed_camps
    if (authUser && authUser.role !== "superadmin") {
      if (authUser.role === "salesperson") {
        const allowedCampsLower = (authUser.allowedCamps || []).map((c) => c.toLowerCase());
        dbRouters = dbRouters.filter((r) => {
          return allowedCampsLower.includes(r.id.toLowerCase()) ||
                 (r.camp && allowedCampsLower.includes(r.camp.toLowerCase())) ||
                 (r.sessionName && allowedCampsLower.includes(r.sessionName.toLowerCase()));
        });
      } else if (authUser.companyId || (authUser.allowedCamps && authUser.allowedCamps.length > 0)) {
        const allowedCampsLower = (authUser.allowedCamps || []).map((c) => c.toLowerCase());
        dbRouters = dbRouters.filter((r) => {
          const idMatch = allowedCampsLower.includes(r.id.toLowerCase());
          const campMatch = (r.camp && allowedCampsLower.includes(r.camp.toLowerCase())) ||
                            (r.sessionName && allowedCampsLower.includes(r.sessionName.toLowerCase()));
          const companyMatch = authUser?.companyId && r.companyId === authUser.companyId;
          return idMatch || campMatch || companyMatch;
        });
      }
    }

    return NextResponse.json({ routers: dbRouters, configured: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load routers");
  }
}

// POST /api/mikrotik/routers
export async function POST(request: Request) {
  try {
    const authUser = extractAuthToken(request);
    const body = await request.json();
    const {
      sessionName,
      host,
      port,
      username,
      password,
      useTls,
      hotspotName,
      dnsName,
      currency,
      companyId,
      companyName,
      sessionTimeout,
      phone,
      liveReport,
    } = body;

    if (!sessionName || !host || !port || !username) {
      return NextResponse.json(
        { error: "Missing required fields (sessionName, host, port, username)" },
        { status: 400 }
      );
    }

    const database = await getDB();

    // 1. Resolve Company ID (Superadmin or Company Admin scope)
    let resolvedCompanyId: number | null = companyId ? Number(companyId) : null;
    if (!resolvedCompanyId && authUser?.companyId) {
      resolvedCompanyId = Number(authUser.companyId);
    }
    if (!resolvedCompanyId && companyName) {
      const compRes = await database.execute({
        sql: "SELECT id FROM companies WHERE LOWER(name) = LOWER(?) LIMIT 1",
        args: [String(companyName).trim()],
      });
      if (compRes.rows.length > 0) {
        resolvedCompanyId = Number(compRes.rows[0].id);
      }
    }

    if (!resolvedCompanyId) {
      return NextResponse.json(
        { error: "Assigning router to a company is mandatory. Please select a company." },
        { status: 400 }
      );
    }

    // 2. Test Connection and Extract Permanent Hardware Identity
    const tempConfig = {
      id: "test",
      sessionName,
      host: String(host).trim(),
      port: Number(port) || 8728,
      username: String(username).trim(),
      password: password ?? "",
      useTls: Boolean(useTls),
      hotspotName: hotspotName ?? sessionName,
      dnsName: dnsName ?? "",
      currency: currency ?? "AED",
      sessionTimeout: sessionTimeout ?? "30 minutes",
      phone: phone ?? "",
      liveReport: liveReport !== false,
    };

    let isVerified = false;
    let serialNumber = "";

    try {
      const connTest = await testRouterConnection(tempConfig);
      if (connTest.success) {
        isVerified = true;
        serialNumber = (connTest.serialNumber || "").trim();
      } else {
        return NextResponse.json(
          { error: `Router connection failed: ${connTest.error || 'Please verify IP, port, and credentials.'}` },
          { status: 400 }
        );
      }
    } catch (testErr) {
      return NextResponse.json(
        { error: `Router connection failed: ${testErr instanceof Error ? testErr.message : 'Cannot reach router'}` },
        { status: 400 }
      );
    }

    // 3. HARDWARE DEDUPLICATION & MULTI-TENANT DETERMINISTIC ROUTER ID:
    const cleanSerial = serialNumber ? serialNumber.replace(/[^a-zA-Z0-9_-]/g, "") : "";
    const cleanPrefix = (dnsName && dnsName.includes(".")) ? dnsName.split(".")[0].replace(/[^a-zA-Z0-9_-]/g, "") : "";
    
    let targetId = cleanSerial
      ? (resolvedCompanyId ? `router-${resolvedCompanyId}-${cleanSerial}` : `router-${cleanSerial}`)
      : (cleanPrefix ? (resolvedCompanyId ? `router-${resolvedCompanyId}-${cleanPrefix}` : `router-${cleanPrefix}`) : `router-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    let isReactivating = false;

    if (cleanSerial) {
      const dupRes = await database.execute({
        sql: `
          SELECT r.id, r.sessionName, r.host, r.company_id, r.is_active
          FROM routers r
          WHERE (r.serialNumber = ? OR r.id = ?)
        `,
        args: [cleanSerial, targetId],
      });

      if (dupRes.rows.length > 0) {
        const existing = dupRes.rows[0];
        const isActive = existing.is_active === 1 || existing.is_active === null;
        const ownerCompanyId = existing.company_id ? Number(existing.company_id) : null;

        if (isActive) {
          if (resolvedCompanyId && ownerCompanyId === resolvedCompanyId) {
            return NextResponse.json(
              {
                error: `This router (Serial #${cleanSerial}) is already registered in your company as "${existing.sessionName}".`,
              },
              { status: 409 }
            );
          } else {
            // Privacy-safe generic message for other companies
            return NextResponse.json(
              {
                error: `This router hardware (Serial #${cleanSerial}) is already registered in the system under another account. If you believe this is an error, please contact your Super Administrator.`,
              },
              { status: 409 }
            );
          }
        } else {
          // Reactivate if belonging to this company or reassigning
          targetId = String(existing.id);
          isReactivating = true;
        }
      }
    }

    if (isReactivating) {
      await database.execute({
        sql: `
          UPDATE routers SET
            sessionName = ?, host = ?, port = ?, username = ?, password = ?, useTls = ?,
            hotspotName = ?, dnsName = ?, currency = ?, camp = ?, sessionTimeout = ?, phone = ?, liveReport = ?,
            verified_status = 1, is_active = 1, deleted_at = NULL, company_id = ?
          WHERE id = ?
        `,
        args: [
          sessionName.trim(),
          String(host).trim(),
          Number(port) || 8728,
          String(username).trim(),
          password ?? "",
          useTls ? 1 : 0,
          (hotspotName || sessionName).trim(),
          (dnsName || "").trim(),
          currency || "AED",
          sessionName.trim(),
          sessionTimeout || "30 minutes",
          (phone || "").trim(),
          liveReport !== false ? 1 : 0,
          resolvedCompanyId,
          targetId,
        ]
      });
    } else {
      await database.execute({
        sql: `
          INSERT INTO routers (
            id, sessionName, host, port, username, password, useTls, 
            hotspotName, dnsName, currency, camp, sessionTimeout, phone, liveReport, serialNumber, verified_status, company_id, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1)
        `,
        args: [
          targetId,
          sessionName.trim(),
          String(host).trim(),
          Number(port) || 8728,
          String(username).trim(),
          password ?? "",
          useTls ? 1 : 0,
          (hotspotName || sessionName).trim(),
          (dnsName || "").trim(),
          currency || "AED",
          sessionName.trim(),
          sessionTimeout || "30 minutes",
          (phone || "").trim(),
          liveReport !== false ? 1 : 0,
          serialNumber,
          resolvedCompanyId,
        ],
      });
    }

    // 5. Seed default pricing plans for this router linked by router_id and company_id
    try {
      let finalCompanyName = companyName ? String(companyName).trim() : null;
      if (!finalCompanyName && resolvedCompanyId) {
        const cRes = await database.execute({
          sql: "SELECT name FROM companies WHERE id = ?",
          args: [resolvedCompanyId],
        });
        if (cRes.rows.length > 0) {
          finalCompanyName = String(cRes.rows[0].name);
        }
      }

      await database.batch([
        {
          sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, company_id, router_id, price, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [sessionName.trim(), "15-Days", finalCompanyName, resolvedCompanyId, targetId, 16, 1],
        },
        {
          sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, company_id, router_id, price, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [sessionName.trim(), "30-Days", finalCompanyName, resolvedCompanyId, targetId, 32, 1],
        },
      ], "write");
    } catch (e) {
      console.warn("Could not insert default pricing records:", e);
    }

    const created = {
      id: targetId,
      sessionName: sessionName.trim(),
      host: String(host).trim(),
      ipAddress: String(host).trim(),
      port: Number(port) || 8728,
      username: String(username).trim(),
      password: password ?? "",
      useTls: Boolean(useTls),
      hotspotName: (hotspotName || sessionName).trim(),
      dnsName: (dnsName || "").trim(),
      currency: currency || "AED",
      camp: sessionName.trim(),
      companyId: resolvedCompanyId,
      serialNumber,
      status: "online",
      verified: true,
    };

    return NextResponse.json({ success: true, router: created }, { status: 201 });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to create router");
  }
}
