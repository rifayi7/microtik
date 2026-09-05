import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getConfiguredRouters, isMikrotikConfigured } from "@/lib/mikrotik/config";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import { fetchHotspotUsersForRouter, testRouterConnection } from "@/lib/mikrotik/queries";
import { extractAuthToken } from "@/lib/auth-crypto";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    let authUser = extractAuthToken(request);
    const verifiedOnly = url.searchParams.get("verified") === "true";
    let companyFilter = url.searchParams.get("company");
    const salespersonParam = url.searchParams.get("salesperson");
    const salesPersonIdParam = url.searchParams.get("salesPersonId");

    const database = await getDB();

    // Dynamically query latest allowed_camps and company from DB if we have authUser or query params
    const lookupUserId = authUser?.userId || (salesPersonIdParam ? Number(salesPersonIdParam) : null);
    const lookupUsername = authUser?.sub || (salespersonParam ? String(salespersonParam).trim() : null);

    if (lookupUserId || lookupUsername) {
      const spRes = await database.execute({
        sql: "SELECT id, username, display_name, role, camp_name, company_name, allowed_camps FROM sales_persons WHERE id = ? OR username = ? OR display_name = ?",
        args: [
          lookupUserId ? Number(lookupUserId) : -1,
          lookupUsername ? String(lookupUsername) : "-1",
          lookupUsername ? String(lookupUsername) : "-1",
        ],
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
        } else if (row.camp_name && row.camp_name !== "All Camps") {
          liveAllowedCamps = [String(row.camp_name)];
        }

        authUser = {
          sub: String(row.username),
          userId: Number(row.id),
          displayName: String(row.display_name || row.username),
          role: String(row.role || "salesperson"),
          companyName: row.company_name ? String(row.company_name) : null,
          allowedCamps: liveAllowedCamps,
        };
      }
    }

    // STRICT SECURITY: If no authenticated user, no valid company, and no allowed camps could be resolved,
    // do NOT leak all multi-tenant routers to unauthenticated clients.
    if (!authUser && !companyFilter) {
      return NextResponse.json(
        { error: "Authentication required to access routers list", routers: [], configured: false },
        { status: 401 }
      );
    }

    // Strictly enforce company if JWT token or resolved user represents a company user
    if (authUser && authUser.role !== "superadmin" && authUser.companyName) {
      companyFilter = authUser.companyName;
    }
    
    // Fetch camps for company if filtered
    let companyCampNames: string[] = [];
    if (companyFilter && companyFilter.trim()) {
      const campRes = await database.execute({
        sql: "SELECT name FROM camps WHERE LOWER(company_name) = LOWER(?)",
        args: [companyFilter.trim()],
      });
      companyCampNames = campRes.rows.map((r) => String(r.name).toLowerCase());
    }

    const query = verifiedOnly 
      ? "SELECT * FROM routers WHERE verified_status = 1" 
      : "SELECT * FROM routers";
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
      camp: row.camp ? String(row.camp) : undefined,
      serialNumber: row.serialNumber ? String(row.serialNumber) : undefined,
      status: Number(row.verified_status) === 1 ? "offline" : "unknown",
      verified: Number(row.verified_status) === 1,
    }));

    if (companyFilter && companyFilter.trim()) {
      dbRouters = dbRouters.filter((r) => {
        const campLower = (r.camp || r.sessionName || "").toLowerCase();
        return companyCampNames.includes(campLower);
      });
    }

    // Strictly filter routers by allowedCamps if user has specific camp permissions (supports permanent router id, sessionName, or camp)
    if (authUser && authUser.allowedCamps && authUser.allowedCamps.length > 0) {
      const allowedLower = authUser.allowedCamps.map((c) => c.toLowerCase());
      dbRouters = dbRouters.filter((r) => {
        const idMatch = r.id && allowedLower.includes(r.id.toLowerCase());
        const sessionMatch = r.sessionName && allowedLower.includes(r.sessionName.toLowerCase());
        const campMatch = r.camp && allowedLower.includes(r.camp.toLowerCase());
        return idMatch || sessionMatch || campMatch;
      });
    }

    // Merge with env-configured routers if any (only for superadmin when no company/camp restrictions exist)
    let envRouters: any[] = [];
    const hasCompanyRestriction = Boolean(companyFilter && companyFilter.trim());
    const hasCampRestriction = Boolean(authUser && authUser.allowedCamps && authUser.allowedCamps.length > 0);

    if (isMikrotikConfigured() && !hasCompanyRestriction && !hasCampRestriction) {
      const configs = getConfiguredRouters();
      envRouters = configs.map((config) => ({
        id: config.id,
        sessionName: config.sessionName,
        host: config.host,
        ipAddress: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        useTls: config.useTls,
        hotspotName: config.hotspotName ?? config.sessionName,
        dnsName: config.dnsName ?? "",
        currency: config.currency ?? "AED",
        sessionTimeout: config.sessionTimeout ?? "30 minutes",
        liveReport: config.liveReport ?? true,
        phone: config.phone ?? "",
        camp: config.camp,
        serialNumber: undefined,
        status: "unknown",
        verified: true,
      }));
    }

    let mergedRouters = [...dbRouters];
    for (const envR of envRouters) {
      if (!mergedRouters.some((r) => r.id === envR.id)) {
        mergedRouters.push(envR);
      }
    }

    // Final safety filter for allowedCamps
    if (hasCampRestriction && authUser?.allowedCamps) {
      const allowedLower = authUser.allowedCamps.map((c) => c.toLowerCase());
      mergedRouters = mergedRouters.filter((r) => {
        const campLower = (r.camp || r.sessionName || "").toLowerCase();
        return allowedLower.includes(campLower);
      });
    }

    return NextResponse.json({ routers: mergedRouters, configured: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load routers");
  }
}

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
      camp,
      company,
      companyName,
      sessionTimeout,
      phone,
      liveReport,
    } = body;

    let assignedCompany = (companyName || company || "").trim() || null;
    if (authUser && authUser.role !== "superadmin" && authUser.companyName) {
      assignedCompany = authUser.companyName;
    }

    if (!sessionName || !host || !port || !username) {
      return NextResponse.json(
        { error: "Missing required fields (sessionName, host, port, username)" },
        { status: 400 }
      );
    }

    const database = await getDB();

    // 1. Check if hotspot name (sessionName) already exists
    const checkRouterDup = await database.execute({
      sql: "SELECT id FROM routers WHERE sessionName = ?",
      args: [sessionName],
    });
    const checkCampDup = await database.execute({
      sql: "SELECT id FROM camps WHERE hotspot_name = ?",
      args: [sessionName],
    });

    if (checkRouterDup.rows.length > 0 || checkCampDup.rows.length > 0) {
      return NextResponse.json(
        { error: "A router or camp with this hotspot name already exists. Please choose a unique name." },
        { status: 400 }
      );
    }

    // 2. Check if camp display name already exists
    const campName = camp ?? sessionName;
    if (campName) {
      const checkCampName = await database.execute({
        sql: "SELECT id FROM camps WHERE name = ?",
        args: [campName],
      });
      const checkRouterCamp = await database.execute({
        sql: "SELECT id FROM routers WHERE camp = ?",
        args: [campName],
      });

      if (checkCampName.rows.length > 0 || checkRouterCamp.rows.length > 0) {
        return NextResponse.json(
          { error: "A camp with this name already exists. Please choose a unique name." },
          { status: 400 }
        );
      }
    }

    const id = `router-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Try to test connection immediately to check if it's live or pending/draft
    const configToTest = {
      id,
      sessionName,
      host,
      port: Number(port),
      username,
      password: password ?? "",
      useTls: Boolean(useTls),
      hotspotName: hotspotName ?? sessionName,
      dnsName: dnsName ?? "",
      currency: currency ?? "AED",
      camp: camp ?? "",
      sessionTimeout: sessionTimeout ?? "30 minutes",
      phone: phone ?? "",
      liveReport: liveReport !== false,
    };

    let isVerified = false;
    let serialNumber = "";

    try {
      const connTest = await testRouterConnection(configToTest);
      if (connTest.success) {
        isVerified = true;
        serialNumber = connTest.serialNumber ?? "";
      }
    } catch {
      // Unreachable or offline — save as unverified/pending draft
      isVerified = false;
    }
    
    await database.execute({
      sql: `
        INSERT INTO routers (
          id, sessionName, host, port, username, password, useTls, 
          hotspotName, dnsName, currency, camp, sessionTimeout, phone, liveReport, serialNumber, verified_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        sessionName,
        host,
        Number(port),
        username,
        password ?? "",
        useTls ? 1 : 0,
        hotspotName ?? sessionName,
        dnsName ?? "",
        currency ?? "AED",
        camp ?? "",
        sessionTimeout ?? "30 minutes",
        phone ?? "",
        liveReport !== false ? 1 : 0,
        serialNumber,
        isVerified ? 1 : 0,
      ],
    });

    // 2. Automatically link/insert the new camp configuration ONLY if connection is verified
    if (isVerified) {
      try {
        await database.execute({
          sql: "INSERT OR IGNORE INTO camps (name, hotspot_name, company_name) VALUES (?, ?, ?)",
          args: [campName, sessionName, assignedCompany],
        });
      } catch (e) {
        console.warn("Could not insert camp metadata:", e);
      }

      // 3. Automatically seed default validity profile pricing for this verified camp
      try {
        await database.batch([
          {
            sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)",
            args: [campName, "15-Days", assignedCompany || "Apricom", 16, 1],
          },
          {
            sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)",
            args: [campName, "30-Days", assignedCompany || "Apricom", 32, 1],
          },
        ], "write");
      } catch (e) {
        console.warn("Could not insert camp pricing data:", e);
      }
    }

    const created = {
      id,
      sessionName,
      host,
      ipAddress: host,
      port: Number(port),
      username,
      password: password ?? "",
      useTls: Boolean(useTls),
      hotspotName: hotspotName ?? sessionName,
      dnsName: dnsName ?? "",
      currency: currency ?? "AED",
      camp: campName,
      sessionTimeout: sessionTimeout ?? "30 minutes",
      phone: phone ?? "",
      liveReport: liveReport !== false,
      status: "unknown",
    };

    // 4. Automatically fetch and import existing vouchers from the physical router in the background
    try {
      const users = await fetchHotspotUsersForRouter(created);
      if (users && users.length > 0) {
        const statements = users.map((user) => {
          const profile = user.profile;
          const match = profile.match(/(\d+)\D*days?/i);
          let validityDaysNum = 0;
          if (match) {
            validityDaysNum = Number(match[1]);
          } else {
            const numeric = Number(profile.replace(/[^0-9]/g, ""));
            validityDaysNum = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
          }

          if (validityDaysNum <= 0) return null;

          const isRedeemed = user.comment && user.comment.includes("Mobile:");
          const status = isRedeemed ? "redeemed" : user.status === "disabled" ? "disabled" : "available";

          let mobile = "";
          let salesperson = "";
          if (isRedeemed) {
            const commentStr = user.comment || "";
            const mobileMatch = commentStr.match(/Mobile:\s*([+a-zA-Z0-9\s-]+)/i);
            if (mobileMatch) {
              mobile = mobileMatch[1].trim();
            }
            const sellerMatch = commentStr.match(/Sold by:\s*([a-zA-Z0-9_-]+)/i);
            if (sellerMatch) {
              salesperson = sellerMatch[1].trim();
            }
          }

          return {
            sql: `
              INSERT OR REPLACE INTO vouchers (
                voucher_code, validity_days, status, router_id, used_by, used_at, sold_by, price_charged
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              user.username,
              validityDaysNum,
              status,
              id,
              status === "redeemed" ? mobile : null,
              status === "redeemed" ? new Date().toISOString() : null,
              status === "redeemed" ? salesperson : null,
              status === "redeemed" ? (validityDaysNum === 30 ? 32 : 16) : null,
            ],
          };
        }).filter((stmt) => stmt !== null);

        if (statements.length > 0) {
          await database.batch(statements as any, "write");
          console.log(`Successfully imported ${statements.length} vouchers from the physical router.`);
        }
      }
    } catch (e) {
      console.warn("Could not import existing vouchers from the physical router:", e);
    }

    return NextResponse.json({ router: created, success: true }, { status: 201 });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to create router");
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
