"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useRouterContext } from "@/contexts/router-context";

const connectedPaths = ["/dashboard", "/hotspot", "/reports"];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, isReady } = useRouterContext();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isReady) return;

    const needsConnection = connectedPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    );
    const isRoot = pathname === "/";

    if ((needsConnection || isRoot) && !isConnected) {
      router.replace("/settings/routers");
      return;
    }

    if (isConnected && pathname === "/settings/routers") {
      // Allow settings/routers when connected (switch router)
      return;
    }

    if (isConnected && (pathname === "/" || pathname === "/settings")) {
      router.replace("/dashboard");
    }
  }, [isReady, isConnected, pathname, router]);

  if (!isReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return children;
}
