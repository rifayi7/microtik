"use client";

import { useState } from "react";
import { toast } from "sonner";
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

interface AddRouterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddRouterDialog({ open, onOpenChange }: AddRouterDialogProps) {
  const { addRouter } = useRouterContext();
  const [sessionName, setSessionName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8728");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hotspotName, setHotspotName] = useState("");
  const [dnsName, setDnsName] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [sessionTimeout, setSessionTimeout] = useState("30 minutes");
  const [phone, setPhone] = useState("");
  const [useTls, setUseTls] = useState(false);
  const [liveReport, setLiveReport] = useState(true);

  const reset = () => {
    setSessionName("");
    setHost("");
    setPort("8728");
    setUsername("");
    setPassword("");
    setHotspotName("");
    setDnsName("");
    setCurrency("AED");
    setSessionTimeout("30 minutes");
    setPhone("");
    setUseTls(false);
    setLiveReport(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!sessionName.trim() || !host.trim() || !username.trim()) {
      toast.error("Session name, host, and username are required");
      return;
    }

    const currentCompany = typeof window !== "undefined" ? localStorage.getItem("admin_company_name") : "";

    addRouter({
      sessionName: sessionName.trim(),
      host: host.trim(),
      port: Number(port) || 8728,
      username: username.trim(),
      password,
      useTls,
      hotspotName: hotspotName.trim() || sessionName.trim(),
      dnsName: dnsName.trim(),
      currency,
      camp: sessionName.trim(),
      company: currentCompany || undefined,
      sessionTimeout,
      liveReport,
      phone: phone.trim(),
    });

    toast.success(`Router "${sessionName}" added`);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Router</DialogTitle>
            <DialogDescription>
              Enter MikroTik DNS/IP, API port, and credentials (same as Winbox connection).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="sessionName">Session Name</Label>
              <Input
                id="sessionName"
                placeholder="Apricom-2"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="host">DNS / IP MikroTik</Label>
                <Input
                  id="host"
                  placeholder="192.168.88.1"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  placeholder="8728"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dnsName">DNS Name</Label>
              <Input
                id="dnsName"
                placeholder="smartwifi.net"
                value={dnsName}
                onChange={(e) => setDnsName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
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
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="useTls">Use TLS (port 8729)</Label>
              <Switch id="useTls" checked={useTls} onCheckedChange={setUseTls} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="liveReport">Live Report</Label>
              <Switch id="liveReport" checked={liveReport} onCheckedChange={setLiveReport} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Router</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
