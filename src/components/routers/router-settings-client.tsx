"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HelpCircle,
  ImageIcon,
  Info,
  Loader2,
  PlugZap,
  Router as RouterIcon,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { ConnectDialog } from "@/components/routers/connect-dialog";
import { fetchMikrotikApi } from "@/lib/api/client";
import { MikrotikSetupAlert } from "@/components/shared/mikrotik-setup-alert";
import { useRouterContext } from "@/contexts/router-context";
import { ROUTER_HELP } from "@/lib/constants";
import type { Router } from "@/lib/types";

interface RouterSettingsClientProps {
  routerId: string;
}

function FieldLabel({ label, help }: { label: string; help?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label>{label}</Label>
      {help && (
        <Tooltip>
          <TooltipTrigger
            render={
              <button type="button" className="text-muted-foreground hover:text-foreground">
                <HelpCircle className="size-3.5" />
              </button>
            }
          />
          <TooltipContent className="max-w-xs">{help}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export function RouterSettingsClient({ routerId }: RouterSettingsClientProps) {
  const routerNav = useRouter();
  const { routers, updateRouter, removeRouter } = useRouterContext();
  const [data, setData] = useState<Router | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const localRouter = routers.find((r) => r.id === routerId);
  const isEnvRouter = !localRouter || localRouter.id === "1";

  const loadRouter = useCallback(async () => {
    setLoading(true);
    setError(null);

    // 1. Check if the router exists in local storage context first
    if (localRouter) {
      setData({
        id: localRouter.id,
        sessionName: localRouter.sessionName,
        hotspotName: localRouter.hotspotName ?? localRouter.sessionName,
        ipAddress: localRouter.host,
        port: localRouter.port,
        username: localRouter.username,
        password: localRouter.password ?? "",
        dnsName: localRouter.dnsName ?? "",
        currency: localRouter.currency ?? "AED",
        sessionTimeout: localRouter.sessionTimeout ?? "30 minutes",
        liveReport: localRouter.liveReport ?? true,
        phone: localRouter.phone ?? "",
        camp: localRouter.camp,
        status: localRouter.status ?? "unknown",
        activeUsers: 0,
      });
      setConfigured(true);
      setLoading(false);

      // Attempt background fetch to verify status/fetch live metrics
      try {
        const payload = await fetchMikrotikApi<{ router: Router }>(
          `/api/mikrotik/routers/${routerId}`
        );
        setData(payload.router);
      } catch {
        // Safe to ignore if background status fetch fails (e.g. manually added local router)
      }
      return;
    }

    // 2. Fallback to API for environment-configured routers
    try {
      const payload = await fetchMikrotikApi<{ router: Router }>(
        `/api/mikrotik/routers/${routerId}`
      );
      setConfigured(payload.configured !== false);
      setData(payload.router);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load router";
      setError(message);
      setConfigured(!message.includes("not configured"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [routerId, localRouter]);

  useEffect(() => {
    void loadRouter();
  }, [loadRouter]);

  const update = <K extends keyof Router>(key: K, value: Router[K]) => {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);

    try {
      // 1. Update in local storage context
      updateRouter(routerId, {
        sessionName: data.sessionName,
        hotspotName: data.hotspotName,
        dnsName: data.dnsName,
        currency: data.currency,
        sessionTimeout: data.sessionTimeout,
        phone: data.phone,
        liveReport: data.liveReport,
        host: data.ipAddress,
        port: data.port !== undefined ? Number(data.port) : undefined,
        username: data.username,
        password: data.password,
        camp: data.camp,
      });

      // 2. Also try updating via API if it is an env-configured router (like id "1")
      if (isEnvRouter) {
        await fetchMikrotikApi(`/api/mikrotik/routers/${routerId}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
      }
      toast.success("Router settings saved successfully");
      routerNav.push("/settings/routers");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <MikrotikSetupAlert error={error} configured={configured} />
        <Button render={<Link href="/routers" />} nativeButton={false}>Back to routers</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.sessionName}
        description="Configure MikroTik connection, hotspot settings, and branding."
      >
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={data.status} />
          <Button variant="outline" render={<Link href="/settings/routers" />} nativeButton={false}>
            <X className="size-4" />
            Close
          </Button>
          <Button variant="outline" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
            Remove
          </Button>
          <Button variant="outline" onClick={() => setConnectOpen(true)}>
            <PlugZap className="size-4" />
            Connect
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save
          </Button>
        </div>
      </PageHeader>

      <MikrotikSetupAlert error={error} configured={configured} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <RouterIcon className="size-4" />
                Router Connection
              </CardTitle>
              <CardDescription>
                Credentials are loaded from .env.local. Update the env file to change host/login.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <FieldLabel label="Session Name" help={ROUTER_HELP.sessionName} />
                <Input
                  value={data.sessionName}
                  onChange={(e) => update("sessionName", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <FieldLabel label="Host / IP" help={ROUTER_HELP.ipAddress} />
                <Input
                  value={data.ipAddress}
                  onChange={(e) => update("ipAddress", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  placeholder="8728"
                  value={data.port !== undefined ? String(data.port) : ""}
                  onChange={(e) => update("port", e.target.value ? Number(e.target.value) : undefined)}
                  className="font-mono"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Username</Label>
                <Input
                  value={data.username}
                  onChange={(e) => update("username", e.target.value)}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Password</Label>
                <div className="flex gap-2">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={data.password}
                    onChange={(e) => update("password", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hotspot Info</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Hotspot Name</Label>
                <Input
                  value={data.hotspotName}
                  onChange={(e) => update("hotspotName", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <FieldLabel label="DNS Name" help={ROUTER_HELP.dnsName} />
                <Input
                  value={data.dnsName}
                  onChange={(e) => update("dnsName", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Input
                  value={data.currency}
                  onChange={(e) => update("currency", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <FieldLabel label="Session Timeout" help={ROUTER_HELP.sessionTimeout} />
                <Select
                  value={data.sessionTimeout}
                  onValueChange={(v) => v && update("sessionTimeout", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30 minutes">30 minutes</SelectItem>
                    <SelectItem value="1 hour">1 hour</SelectItem>
                    <SelectItem value="2 hours">2 hours</SelectItem>
                    <SelectItem value="4 hours">4 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input
                  value={data.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                <div className="space-y-0.5">
                  <Label>Live Report</Label>
                  <p className="text-xs text-muted-foreground">
                    {ROUTER_HELP.liveReport}
                  </p>
                </div>
                <Switch
                  checked={data.liveReport}
                  onCheckedChange={(v) => update("liveReport", v)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="size-4" />
                Upload Logo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed bg-muted/30">
                <ImageIcon className="size-8 text-muted-foreground" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  Browse File
                </Button>
                <Button className="flex-1">
                  <Upload className="size-4" />
                  Upload
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="size-4" />
                Help
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {Object.entries(ROUTER_HELP).map(([key, value]) => (
                <div key={key} className="rounded-lg border p-3">
                  <p className="font-medium capitalize mb-1">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </p>
                  <p className="text-muted-foreground text-xs">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConnectDialog
        router={data}
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnect={(r) => {
          update("status", "online");
          toast.success(`Connected to ${r.sessionName}`);
          setConnectOpen(false);
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove router?</AlertDialogTitle>
            <AlertDialogDescription>
              {isEnvRouter ? (
                <>
                  Edit <code className="font-mono">.env.local</code> to remove this router&apos;s
                  credentials from the app.
                </>
              ) : (
                <>Are you sure you want to remove &quot;{data?.sessionName}&quot; from your saved routers?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (isEnvRouter) {
                  toast.info("Update .env.local to remove this router");
                } else {
                  removeRouter(routerId);
                  toast.success("Router removed successfully");
                }
                routerNav.push("/settings/routers");
              }}
            >
              {isEnvRouter ? "Got it" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
