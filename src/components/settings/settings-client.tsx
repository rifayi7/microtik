"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Settings } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const settingsTabs = [
  { href: "/settings", label: "General", icon: Settings },
  { href: "/settings/templates", label: "Template Editor", icon: FileText },
];

export function SettingsClient() {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="System preferences, defaults, and administrative configuration."
      />

      <Tabs value={pathname === "/settings" ? "general" : "other"}>
        <TabsList>
          {settingsTabs.map((tab) => (
            <TabsTrigger
              key={tab.href}
              value={tab.href === "/settings" ? "general" : "other"}
              render={<Link href={tab.href} />}
              nativeButton={false}
              className={cn(pathname === tab.href && "data-active:bg-background")}
            >
              <tab.icon className="size-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">General Settings</CardTitle>
              <CardDescription>
                Default values applied to new routers and hotspots
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Default Currency</Label>
                <Input defaultValue="AED" />
              </div>
              <div className="grid gap-2">
                <Label>Default Session Timeout</Label>
                <Input defaultValue="30 minutes" />
              </div>
              <div className="grid gap-2">
                <Label>Default DNS Name</Label>
                <Input defaultValue="smartwifi.net" />
              </div>
              <div className="grid gap-2">
                <Label>Admin Email</Label>
                <Input defaultValue="admin@hotspot.pro" type="email" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Router offline alerts</Label>
                  <p className="text-xs text-muted-foreground">
                    Email when a router disconnects
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Daily revenue report</Label>
                  <p className="text-xs text-muted-foreground">
                    Summary sent every morning
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => toast.success("Settings saved")}>
              Save Changes
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
