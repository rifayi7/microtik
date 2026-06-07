import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { RouteGuard } from "@/components/layout/route-guard";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-[#e8e8e8] dark:bg-background">
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <RouteGuard>{children}</RouteGuard>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
