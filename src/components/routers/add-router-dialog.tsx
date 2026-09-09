"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Cpu,
  ShieldCheck,
  Building2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { useRouterContext } from "@/contexts/router-context";
import { fetchMikrotikApi } from "@/lib/api/client";

interface AddRouterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CompanyOption {
  id: number;
  name: string;
}

interface HardwareDiscovery {
  identity: string;
  boardName: string;
  version: string;
  uptime: string;
  serialNumber: string;
  model: string;
  cloudDns: string;
  publicIp: string;
}

export function AddRouterDialog({ open, onOpenChange }: AddRouterDialogProps) {
  const { addRouter } = useRouterContext();

  // Connection fields
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8728");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [useTls, setUseTls] = useState(false);

  // Configuration fields
  const [sessionName, setSessionName] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [hotspotName, setHotspotName] = useState("");
  const [dnsName, setDnsName] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [sessionTimeout, setSessionTimeout] = useState("30 minutes");
  const [phone, setPhone] = useState("");
  const [liveReport, setLiveReport] = useState(true);

  // Discovery and duplicate state
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discovery, setDiscovery] = useState<HardwareDiscovery | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load companies list on mount/open
  useEffect(() => {
    if (open) {
      void (async () => {
        try {
          const res = await fetchMikrotikApi<{ success: boolean; companies: CompanyOption[] }>(
            "/api/mikrotik/admin/companies"
          );
          if (res.success && res.companies) {
            setCompanies(res.companies);
            if (res.companies.length > 0 && !companyId) {
              setCompanyId(String(res.companies[0].id));
            }
          }
        } catch {
          // If unauthenticated or no companies, ignore
        }
      })();
    }
  }, [open, companyId]);

  const reset = () => {
    setHost("");
    setPort("8728");
    setUsername("");
    setPassword("");
    setUseTls(false);
    setSessionName("");
    setHotspotName("");
    setDnsName("");
    setCurrency("AED");
    setSessionTimeout("30 minutes");
    setPhone("");
    setLiveReport(true);
    setDiscovery(null);
    setDuplicateWarning(null);
    setDiscovering(false);
    setSaving(false);
  };

  const handleTestAndDiscover = async () => {
    if (!host.trim() || !username.trim()) {
      toast.error("Please enter Host/IP and Username to test connection");
      return;
    }

    setDiscovering(true);
    setDuplicateWarning(null);

    try {
      const res = await fetchMikrotikApi<{
        success: boolean;
        error?: string;
        discovery?: HardwareDiscovery;
        isDuplicate?: boolean;
        duplicateReason?: string;
      }>("/api/mikrotik/routers/test", {
        method: "POST",
        body: JSON.stringify({
          host: host.trim(),
          port: Number(port) || 8728,
          username: username.trim(),
          password,
          useTls,
          companyId: companyId ? Number(companyId) : undefined,
        }),
      });

      if (!res.success || !res.discovery) {
        toast.error(res.error || "Failed to reach MikroTik router");
        setDiscovery(null);
        return;
      }

      setDiscovery(res.discovery);

      // Auto-populate recommended names if fields are empty
      if (!sessionName.trim() && res.discovery.identity) {
        setSessionName(res.discovery.identity);
      }
      if (!hotspotName.trim()) {
        setHotspotName(res.discovery.identity || sessionName.trim());
      }
      if (!dnsName.trim() && res.discovery.cloudDns) {
        setDnsName(res.discovery.cloudDns);
      }

      if (res.isDuplicate && res.duplicateReason) {
        setDuplicateWarning(res.duplicateReason);
        toast.warning(res.duplicateReason, { duration: 6000 });
      } else {
        toast.success(`Connected! Identified ${res.discovery.boardName} (Serial: ${res.discovery.serialNumber || 'N/A'})`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      toast.error("Test failed: " + msg);
      setDiscovery(null);
    } finally {
      setDiscovering(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sessionName.trim() || !host.trim() || !username.trim()) {
      toast.error("Session name, host, and username are required");
      return;
    }

    if (companies.length > 0 && !companyId) {
      toast.error("Assigning to a Company is mandatory");
      return;
    }

    if (duplicateWarning) {
      toast.error("Cannot save duplicate router. " + duplicateWarning);
      return;
    }

    setSaving(true);
    try {
      const selectedCompany = companies.find((c) => String(c.id) === String(companyId));

      await addRouter({
        sessionName: sessionName.trim(),
        host: host.trim(),
        port: Number(port) || 8728,
        username: username.trim(),
        password,
        useTls,
        hotspotName: (hotspotName || sessionName).trim(),
        dnsName: (dnsName || "").trim(),
        currency,
        companyId: companyId ? Number(companyId) : undefined,
        company: selectedCompany?.name,
        sessionTimeout,
        liveReport,
        phone: phone.trim(),
      } as any);

      toast.success(`Router "${sessionName}" saved successfully`);
      reset();
      onOpenChange(false);
    } catch (err) {
      // Error handled in addRouter / toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) reset();
        onOpenChange(val);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New MikroTik Router</DialogTitle>
            <DialogDescription>
              Step 1: Test & Discover hardware identity. Step 2: Confirm company and save.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Connection Credentials Section */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Connection & Credentials
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 grid gap-1.5">
                  <Label htmlFor="host" className="text-xs">IP / Cloud DNS</Label>
                  <Input
                    id="host"
                    placeholder="e.g. 192.168.88.1 or *.sn.mynetname.net"
                    value={host}
                    onChange={(e) => {
                      setHost(e.target.value);
                      setDiscovery(null);
                      setDuplicateWarning(null);
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="port" className="text-xs">Port</Label>
                  <Input
                    id="port"
                    placeholder="8728"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="username" className="text-xs">Username</Label>
                  <Input
                    id="username"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setDiscovery(null);
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="password" className="text-xs">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setDiscovery(null);
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Switch id="useTls" checked={useTls} onCheckedChange={setUseTls} />
                  <Label htmlFor="useTls" className="text-xs font-normal">Use TLS (port 8729)</Label>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant={discovery ? "outline" : "default"}
                  onClick={handleTestAndDiscover}
                  disabled={discovering || !host.trim() || !username.trim()}
                  className="text-xs gap-1.5"
                >
                  {discovering ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-3.5" />
                      {discovery ? "Re-Test Connection" : "Test & Discover"}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Hardware Discovery Results Banner */}
            {discovery && (
              <div className={`rounded-lg border p-3 text-xs space-y-2 ${
                duplicateWarning ? "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200" : "border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
              }`}>
                <div className="flex items-center gap-2 font-medium">
                  {duplicateWarning ? (
                    <>
                      <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                      <span>Duplicate Hardware Detected</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                      <span>Hardware Verified Successfully</span>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] pt-1">
                  <div>Model: <span className="font-semibold">{discovery.model || discovery.boardName}</span></div>
                  <div>OS: <span className="font-semibold">{discovery.version || "Unknown"}</span></div>
                  <div className="col-span-2">
                    Serial No: <span className="font-semibold">{discovery.serialNumber || "(Software / CHR)"}</span>
                  </div>
                  {discovery.cloudDns && (
                    <div className="col-span-2 truncate">
                      Cloud DNS: <span className="font-semibold">{discovery.cloudDns}</span>
                    </div>
                  )}
                </div>

                {duplicateWarning && (
                  <div className="p-2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-100 font-medium">
                    ⚠️ {duplicateWarning}
                  </div>
                )}
              </div>
            )}

            {/* Router Configuration & Identity Details */}
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="sessionName">Router Display Name *</Label>
                  <Input
                    id="sessionName"
                    placeholder="Mess-Hall-1"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                  />
                </div>

                {companies.length > 0 && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="companySelect" className="flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-muted-foreground" />
                      Assign to Company *
                    </Label>
                    <Select value={companyId} onValueChange={(val) => val && setCompanyId(val)}>
                      <SelectTrigger id="companySelect">
                        <SelectValue placeholder="Select Company (Required)" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Session Timeout</Label>
                  <Select value={sessionTimeout} onValueChange={(v) => v && setSessionTimeout(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30 minutes">30 minutes</SelectItem>
                      <SelectItem value="1 hour">1 hour</SelectItem>
                      <SelectItem value="2 hours">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="liveReport" className="text-sm">Live Monitoring & Reporting</Label>
                  <p className="text-xs text-muted-foreground">Sync active hotspot sessions and vouchers in real-time</p>
                </div>
                <Switch id="liveReport" checked={liveReport} onCheckedChange={setLiveReport} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || discovering || Boolean(duplicateWarning)}
              className="gap-1.5"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save Router
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
