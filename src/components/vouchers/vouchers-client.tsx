"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Ticket,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Filter,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { useRouterContext } from "@/contexts/router-context";
import { fetchForRouter } from "@/lib/api/client";
import { toMikrotikConfig } from "@/lib/router-store";

// ─── types ───────────────────────────────────────────────────────────────────

interface VoucherRow {
  code: string;
  validityDays: number;
  status: "available" | "reserved" | "redeemed" | string;
  usedBy: string | null;
  usedAt: string | null;
  soldBy: string | null;
  priceCharged: number | null;
  activationStatus: string | null;
  activationError: string | null;
}

interface PlanSummary {
  available: number;
  reserved: number;
  redeemed: number;
  total: number;
}

interface VoucherListResponse {
  vouchers: VoucherRow[];
  total: number;
  page: number;
  limit: number;
  summary: Record<string, PlanSummary>;
  routerId: string;
  routerName: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  available:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  reserved:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  redeemed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_COLORS[status] ?? "bg-zinc-100 text-zinc-600"
      }`}
    >
      {status}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handle}
      className="ml-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
      title="Copy code"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ─── plan card (collapsible) ──────────────────────────────────────────────────

function PlanCard({
  days,
  summary,
  vouchers,
  statusFilter,
}: {
  days: number;
  summary: PlanSummary;
  vouchers: VoucherRow[];
  statusFilter: string;
}) {
  const [open, setOpen] = useState(true);
  const planVouchers = vouchers.filter((v) => v.validityDays === days);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
            {days}-Day Plan
          </span>
          <span className="text-xs text-zinc-500">
            <span className="text-emerald-600 font-medium">
              {summary.available}
            </span>{" "}
            available
            {summary.reserved > 0 && (
              <>
                {" · "}
                <span className="text-amber-600 font-medium">
                  {summary.reserved}
                </span>{" "}
                reserved
              </>
            )}
            {" · "}
            <span className="text-zinc-400">{summary.redeemed}</span> redeemed
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        )}
      </button>

      {/* table */}
      {open && (
        <div className="overflow-x-auto">
          {planVouchers.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-400">
              No vouchers match the current filter.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                  <th className="px-4 py-2 text-left font-medium text-zinc-500 w-44">
                    Code
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500 w-28">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">
                    Used By
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">
                    Sold By
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">
                    Price
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">
                    Used At
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500 w-24">
                    Activation
                  </th>
                </tr>
              </thead>
              <tbody>
                {planVouchers.map((v) => (
                  <tr
                    key={v.code}
                    className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="px-4 py-2 font-mono font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                      {v.code}
                      <CopyButton text={v.code} />
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {v.usedBy ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {v.soldBy ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {v.priceCharged != null ? `${v.priceCharged} AED` : "—"}
                    </td>
                    <td className="px-4 py-2 text-zinc-500 text-xs whitespace-nowrap">
                      {v.usedAt
                        ? new Date(v.usedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {v.activationStatus === "failed" ? (
                        <span
                          title={v.activationError ?? ""}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 cursor-help"
                        >
                          failed
                        </span>
                      ) : v.activationStatus === "success" ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          ok
                        </span>
                      ) : v.activationStatus === "pending" ? (
                        <span className="text-xs text-amber-500">pending</span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function VouchersClient() {
  const { activeRouter, isReady } = useRouterContext();

  const [data, setData] = useState<VoucherListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const LIMIT = 200;

  const loadVouchers = useCallback(
    async (router = activeRouter, st = statusFilter, pg = page) => {
      if (!router) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchForRouter<VoucherListResponse>(
          "/api/mikrotik/vouchers/list",
          router,
          {
            body: JSON.stringify({
              status: st === "all" ? undefined : st,
              page: pg,
              limit: LIMIT,
            }),
          }
        );
        setData(result);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load vouchers";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [activeRouter, statusFilter, page]
  );

  // Initial load + reload when router/filter/page changes
  useEffect(() => {
    if (isReady && activeRouter) {
      void loadVouchers(activeRouter, statusFilter, page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, activeRouter?.id, statusFilter, page]);

  // ── export CSV ──
  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Code", "Days", "Status", "UsedBy", "SoldBy", "Price", "UsedAt"],
      ...data.vouchers.map((v) => [
        v.code,
        v.validityDays,
        v.status,
        v.usedBy ?? "",
        v.soldBy ?? "",
        v.priceCharged ?? "",
        v.usedAt ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vouchers-${activeRouter?.sessionName ?? "router"}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── guard: no router selected ──
  if (isReady && !activeRouter) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Voucher Codes"
          description="View and manage voucher inventory for the active router."
        />
        <EmptyState
          icon={Ticket}
          title="No router selected"
          description="Connect to a router from the Routers page to view its vouchers."
        />
      </div>
    );
  }

  // ── derive plan days from summary ──
  const planDays = data
    ? Object.keys(data.summary)
        .map(Number)
        .sort((a, b) => a - b)
    : [];

  const totalAvailable = planDays.reduce(
    (s, d) => s + (data?.summary[d]?.available ?? 0),
    0
  );
  const totalRedeemed = planDays.reduce(
    (s, d) => s + (data?.summary[d]?.redeemed ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voucher Codes"
        description={
          activeRouter
            ? `Inventory for router "${activeRouter.sessionName}"`
            : "Voucher inventory"
        }
      >
        {/* status filter */}
        <div className="flex items-center gap-1.5 text-sm">
          <Filter className="h-4 w-4 text-zinc-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All statuses</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="redeemed">Redeemed</option>
          </select>
        </div>

        {/* export */}
        <button
          onClick={exportCsv}
          disabled={!data || loading}
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export
        </button>

        {/* refresh */}
        <button
          onClick={() => loadVouchers()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </PageHeader>

      {/* summary bar */}
      {data && (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-center min-w-[120px]">
            <p className="text-2xl font-bold text-emerald-600">
              {totalAvailable}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">Available</p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-center min-w-[120px]">
            <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300">
              {totalRedeemed}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">Redeemed</p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-center min-w-[120px]">
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {data.total}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {statusFilter === "all" ? "Total shown" : `Filtered (${statusFilter})`}
            </p>
          </div>
        </div>
      )}

      {/* error state */}
      {error && !loading && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* loading skeleton */}
      {loading && !data && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* plan cards */}
      {data && planDays.length === 0 && (
        <EmptyState
          icon={Ticket}
          title="No vouchers found"
          description="No vouchers match the current filter for this router."
        />
      )}

      {data && planDays.length > 0 && (
        <div className="space-y-4">
          {planDays.map((days) => (
            <PlanCard
              key={days}
              days={days}
              summary={data.summary[days]}
              vouchers={data.vouchers}
              statusFilter={statusFilter}
            />
          ))}
        </div>
      )}

      {/* pagination */}
      {data && data.total > LIMIT && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-500">
            Page {page} of {Math.ceil(data.total / LIMIT)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(data.total / LIMIT) || loading}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
