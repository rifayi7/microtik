"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Wifi, ShieldCheck, Building2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const routerNav = useRouter();
  const { isConnected, activeRouter, routers, connectRouter, disconnectRouter } =
    useRouterContext();
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showSignoutModal, setShowSignoutModal] = useState(false);
  const [userRole, setUserRole] = useState<string>("superadmin");

  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("admin_user_role") || "superadmin";
      const comp = localStorage.getItem("admin_company_name") || "";
      setUserRole(role);
      setCompanyName(comp);
    }
  }, []);

  const baseNav = isConnected ? connectedNavigation : setupNavigation;
  const navigation = userRole === "company_admin"
    ? baseNav.filter((item) => item.href !== "/admin")
    : baseNav;

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
        <SidebarHeader className="border-b bg-white dark:bg-card px-3 py-4 flex flex-col items-center">
          <div className="w-full flex items-center justify-center p-2 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm">
            <Image
              src="/linkfi-logo.png"
              alt="LinkFi Logo"
              width={160}
              height={50}
              priority
              className="h-10 w-auto object-contain"
            />
          </div>

          <div className="mt-2 text-center w-full">
            {userRole === "superadmin" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <ShieldCheck className="size-3" />
                Super Admin
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 truncate max-w-full">
                <Building2 className="size-3 shrink-0" />
                <span className="truncate">{companyName ? `Company: ${companyName}` : "Company Admin"}</span>
              </span>
            )}
          </div>
          {isConnected && (
            <Select
              value={activeRouter?.id}
              onValueChange={(value) => value && void handleRouterChange(value)}
            >
              <SelectTrigger className="mt-4 w-full bg-white dark:bg-card">
                <SelectValue placeholder="Select router">
                  {activeRouter?.sessionName || "Select router"}
                </SelectValue>
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
                  onClick={() => setShowDisconnectModal(true)}
                  className="text-destructive hover:text-destructive"
                >
                  Disconnect
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {footerNavigation.map((item) => {
              const isSignout = item.title === "Sign out";
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={isSignout ? undefined : <Link href={item.href} />}
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      if (isSignout) {
                        e.preventDefault();
                        setShowSignoutModal(true);
                      }
                    }}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </div>

      {/* Disconnect Confirmation Modal */}
      <AlertDialog open={showDisconnectModal} onOpenChange={setShowDisconnectModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect router?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect from &quot;{activeRouter?.sessionName}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                disconnectRouter();
                setShowDisconnectModal(false);
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sign Out Confirmation Modal */}
      <AlertDialog open={showSignoutModal} onOpenChange={setShowSignoutModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out of the admin panel?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                localStorage.removeItem("auth_token");
                localStorage.removeItem("is_logged_in");
                localStorage.removeItem("admin_user_role");
                localStorage.removeItem("admin_user_name");
                localStorage.removeItem("admin_company_name");
                localStorage.removeItem("admin_allowed_camps");
                localStorage.removeItem("hotspot-pro-routers");
                localStorage.removeItem("hotspot-pro-active-router");
                setShowSignoutModal(false);
                window.location.href = "/login";
              }}
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
