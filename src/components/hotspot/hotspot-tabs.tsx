"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Hotspot", href: "/hotspot/users" },
  { label: "Users", href: "/hotspot/users" },
  { label: "User Profile", href: "/hotspot/profiles" },
  { label: "Active", href: "/hotspot/active" },
  { label: "Hosts", href: "/hotspot/hosts" },
];

export function HotspotTabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border bg-white p-1 dark:bg-card">
      {tabs.map((tab) => {
        const active =
          pathname === tab.href ||
          (tab.label === "Hotspot" && pathname.startsWith("/hotspot/users"));
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-[#f5a623] text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
