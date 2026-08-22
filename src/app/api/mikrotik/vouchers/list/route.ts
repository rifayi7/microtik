import { NextResponse } from "next/server";
import { getDB, seedVouchersForRouter } from "@/lib/db";
import {
  parseRouterFromBody,
  resolveRouterFromRequestSync,
} from "@/lib/mikrotik/resolve-router";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config =
      parseRouterFromBody(body) ??
      (await resolveRouterFromRequestSync(
        body,
        (body as Record<string, unknown>).routerId as string | undefined
      ));

    if (!config) {
      return NextResponse.json(
        { error: "Router credentials required" },
        { status: 400 }
      );
    }

    const db = await getDB();

    // Auto-seed vouchers if none exist for this router
    const checkResult = await db.execute({
      sql: "SELECT COUNT(*) as count FROM vouchers WHERE router_id = ?",
      args: [config.id],
    });
    const count = Number(checkResult.rows[0]?.count ?? 0);
    if (count === 0) {
      await seedVouchersForRouter(config.id);
    }

    const { status, page = 1, limit = 50 } = body as {
      status?: string;
      page?: number;
      limit?: number;
    };

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = "WHERE router_id = ?";
    const args: (string | number)[] = [config.id];

    if (status && status !== "all") {
      whereClause += " AND status = ?";
      args.push(status);
    }

    const totalResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM vouchers ${whereClause}`,
      args,
    });
    const total = Number(totalResult.rows[0]?.total ?? 0);

    const result = await db.execute({
      sql: `
        SELECT
          voucher_code,
          validity_days,
          status,
          used_by,
          used_at,
          reserved_until,
          sold_by,
          price_charged,
          activation_status,
          activation_error
        FROM vouchers
        ${whereClause}
        ORDER BY
          CASE status
            WHEN 'available' THEN 1
            WHEN 'reserved' THEN 2
            WHEN 'redeemed' THEN 3
            ELSE 4
          END,
          validity_days ASC,
          voucher_code ASC
        LIMIT ? OFFSET ?
      `,
      args: [...args, limitNum, offset],
    });

    const vouchers = result.rows.map((row) => ({
      code: String(row.voucher_code),
      validityDays: Number(row.validity_days),
      status: String(row.status),
      usedBy: row.used_by ? String(row.used_by) : null,
      usedAt: row.used_at ? String(row.used_at) : null,
      reservedUntil: row.reserved_until ? String(row.reserved_until) : null,
      soldBy: row.sold_by ? String(row.sold_by) : null,
      priceCharged: row.price_charged ? Number(row.price_charged) : null,
      activationStatus: row.activation_status
        ? String(row.activation_status)
        : null,
      activationError: row.activation_error
        ? String(row.activation_error)
        : null,
    }));

    // Summary stats grouped by validity_days and status
    const summaryResult = await db.execute({
      sql: `
        SELECT validity_days, status, COUNT(*) as cnt
        FROM vouchers
        WHERE router_id = ?
        GROUP BY validity_days, status
        ORDER BY validity_days ASC
      `,
      args: [config.id],
    });

    const summary: Record<
      number,
      { available: number; reserved: number; redeemed: number; total: number }
    > = {};
    for (const row of summaryResult.rows) {
      const days = Number(row.validity_days);
      if (!summary[days]) {
        summary[days] = { available: 0, reserved: 0, redeemed: 0, total: 0 };
      }
      const s = String(row.status);
      const n = Number(row.cnt);
      summary[days].total += n;
      if (s === "available") summary[days].available += n;
      else if (s === "reserved") summary[days].reserved += n;
      else if (s === "redeemed") summary[days].redeemed += n;
    }

    return NextResponse.json({
      vouchers,
      total,
      page: pageNum,
      limit: limitNum,
      summary,
      routerId: config.id,
      routerName: config.sessionName,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch vouchers",
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
