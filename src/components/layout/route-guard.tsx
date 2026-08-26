"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useRouterContext } from "@/contexts/router-context";

const connectedPaths = [
  "/dashboard",
  "/hotspot",
  "/reports",
  "/logs",
  "/sessions",
  "/vouchers",
  "/profiles",
  "/plans",
  "/payments",
  "/users",
];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, isReady } = useRouterContext();
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const loggedIn = typeof window !== "undefined" && localStorage.getItem("is_logged_in") === "true";
    setIsAuthenticated(loggedIn);

    if (!loggedIn) {
      router.replace("/login");
      return;
    }

    if (!isReady) return;

    const needsConnection = connectedPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    );

    if (needsConnection && !isConnected) {
      router.replace("/settings/routers");
      return;
    }

    if (isConnected && pathname === "/settings/routers") {
      // Allow settings/routers when connected (switch router)
      return;
    }

    if (pathname === "/" || pathname === "/settings") {
      router.replace(isConnected ? "/dashboard" : "/settings/routers");
    }
  }, [isReady, isConnected, pathname, router]);

  if (!isReady || isAuthenticated === null || !isAuthenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return children;
}
