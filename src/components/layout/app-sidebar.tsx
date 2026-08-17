"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useRouterContext } from "@/contexts/router-context";
import { connectedNavigation, footerNavigation, setupNavigation } from "@/lib/navigation";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      setTime(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date())
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="font-mono text-xs tabular-nums">{time}</span>;
}

export function AppSidebar() {
  const pathname = usePathname();
  const { isConnected, activeRouter, routers, connectRouter, disconnectRouter } =
    useRouterContext();

  const navigation = isConnected ? connectedNavigation : setupNavigation;

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/hotspot/users") return pathname.startsWith("/hotspot");
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleRouterChange = async (routerId: string) => {
    if (routerId === activeRouter?.id) return;
    try {
      await connectRouter(routerId);
    } catch {
      // toast handled by caller if needed
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="flex h-full flex-col bg-[#f3f4f6] dark:bg-sidebar">
        <div className="brand-gradient px-4 py-5 text-center text-white">
          <p className="text-lg font-bold tracking-wide">{APP_NAME.toUpperCase()}</p>
        </div>

        <SidebarHeader className="border-b bg-transparent px-3 py-4">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border-4 border-white bg-white shadow-sm">
            <span className="text-3xl font-black text-[#4A60D6]">T</span>
          </div>
          {isConnected && (
            <Select
              value={activeRouter?.id}
              onValueChange={(value) => value && void handleRouterChange(value)}
            >
              <SelectTrigger className="mt-4 w-full bg-white dark:bg-card">
                <SelectValue placeholder="Select router" />
              </SelectTrigger>
              <SelectContent>
                {routers.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.sessionName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </SidebarHeader>

        <SidebarContent className="bg-transparent px-2 py-3">
          <SidebarMenu className="gap-1">
            {navigation.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  isActive={isActive(item.href)}
                  className={cn(
                    "h-10 rounded-full px-4 text-sm font-medium",
                    isActive(item.href) &&
                      "bg-[#4A60D6] text-white hover:bg-[#3b50c0] hover:text-white data-active:bg-[#4A60D6] data-active:text-white"
                  )}
                >
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="mt-auto border-t bg-transparent p-3">
          <div className="mb-2 flex items-center justify-center gap-2 text-muted-foreground">
            <LiveClock />
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <ThemeToggle />
            </SidebarMenuItem>
            {isConnected && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={disconnectRouter}
                  className="text-destructive hover:text-destructive"
                >
                  Disconnect
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {footerNavigation.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (item.title === "Sign out") {
                      localStorage.removeItem("is_logged_in");
                    }
                  }}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </div>
    </Sidebar>
  );
}
