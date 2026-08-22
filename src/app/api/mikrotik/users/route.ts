import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const routerId = body.routerId ?? body.router?.id;

    if (!routerId) {
      return NextResponse.json({ error: "routerId is required in the request body" }, { status: 400 });
    }

    const database = await getDB();
    const result = await database.execute({
      sql: "SELECT * FROM vouchers WHERE router_id = ? ORDER BY used_at DESC, voucher_code ASC",
      args: [routerId],
    });

    // Map database vouchers to the HotspotUser/Coupon interface the mobile app expects
    const users = result.rows.map((row) => {
      const isUsed = row.status === "redeemed";
      const isReserved = row.status === "reserved";
      const isCustomDisabled = row.status === "disabled";
      
      let comment = "";
      if (isUsed && row.used_by) {
        comment = `Mobile:${row.used_by}`;
      } else if (row.sold_by) {
        comment = `SoldBy:${row.sold_by}`;
      }

      return {
        id: String(row.voucher_code),
        username: String(row.voucher_code),
        profile: `${row.validity_days}-Days`,
        routerId: String(row.router_id),
        routerName: "",
        status: isUsed || isCustomDisabled ? "disabled" : "active",
        comment: comment,
        createdAt: String(row.used_at || ""),
      };
    });

    return NextResponse.json({ users, configured: true });
  } catch (error) {
    console.error("Hotspot users database API error:", error);
    return NextResponse.json({ error: "Failed to load coupons from database" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
