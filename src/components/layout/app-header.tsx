"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  const routerNav = useRouter();
  const [showSignoutModal, setShowSignoutModal] = useState(false);
  const [userRole, setUserRole] = useState<string>("superadmin");
  const [userName, setUserName] = useState<string>("Admin User");
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("admin_user_role") || "superadmin";
      const name = localStorage.getItem("admin_user_name") || "Admin User";
      const comp = localStorage.getItem("admin_company_name") || "";
      setUserRole(role);
      setUserName(name);
      setCompanyName(comp);
    }
  }, []);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        {title && (
          <h2 className="hidden text-sm font-medium text-muted-foreground sm:block">
            {title}
          </h2>
        )}

        {/* Role & Company Header Indicator */}
        <div className="hidden sm:flex items-center ml-3">
          {userRole === "superadmin" ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              🛡️ Super Administrator
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              🏢 Company Admin: <span className="font-bold">{companyName || "Assigned"}</span>
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Quick search..."
              className="h-8 w-48 pl-8 lg:w-64"
            />
          </div>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-4" />
            <Badge className="absolute -top-0.5 -right-0.5 size-4 justify-center rounded-full p-0 text-[10px]">
              3
            </Badge>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs uppercase font-bold">
                      {userName ? userName.slice(0, 2).toUpperCase() : "AD"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium capitalize">{userName}</p>
                  <p className="text-xs text-muted-foreground">
                    {userRole === "superadmin" ? "Super Admin Account" : `Company: ${companyName}`}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile settings</DropdownMenuItem>
              <DropdownMenuItem>System preferences</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setShowSignoutModal(true)}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

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
                localStorage.removeItem("is_logged_in");
                localStorage.removeItem("hotspot-pro-active-router");
                setShowSignoutModal(false);
                routerNav.push("/login");
              }}
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
