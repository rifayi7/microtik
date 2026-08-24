import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getConfiguredRouters, isMikrotikConfigured } from "@/lib/mikrotik/config";
import { mikrotikErrorResponse } from "@/lib/mikrotik/api-utils";
import { fetchHotspotUsersForRouter, testRouterConnection } from "@/lib/mikrotik/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const verifiedOnly = url.searchParams.get("verified") === "true";
    const database = await getDB();
    
    const query = verifiedOnly 
      ? "SELECT * FROM routers WHERE verified_status = 1" 
      : "SELECT * FROM routers";
    const result = await database.execute(query);
    
    const dbRouters = result.rows.map((row) => ({
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

    // Merge with env-configured routers if any (env routers default to verified)
    let envRouters: any[] = [];
    if (isMikrotikConfigured()) {
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

    const mergedRouters = [...dbRouters];
    for (const envR of envRouters) {
      if (!mergedRouters.some((r) => r.id === envR.id)) {
        mergedRouters.push(envR);
      }
    }

    return NextResponse.json({ routers: mergedRouters, configured: true });
  } catch (error) {
    return mikrotikErrorResponse(error, "Failed to load routers");
  }
}

export async function POST(request: Request) {
  try {
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
          sql: "INSERT OR IGNORE INTO camps (name, hotspot_name) VALUES (?, ?)",
          args: [campName, sessionName],
        });
      } catch (e) {
        console.warn("Could not insert camp metadata:", e);
      }

      // 3. Automatically seed default validity profile pricing for this verified camp
      try {
        await database.batch([
          {
            sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, price, status) VALUES (?, ?, ?, ?)",
            args: [campName, "15-Days", 16, 1],
          },
          {
            sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, price, status) VALUES (?, ?, ?, ?)",
            args: [campName, "30-Days", 32, 1],
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
