"use client";

import { useState } from "react";
import { Loader2, PlugZap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchMikrotikApi } from "@/lib/api/client";
import type { Router } from "@/lib/types";

interface ConnectDialogProps {
  router: Router | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (router: Router) => void;
}

interface ConnectResponse {
  success: boolean;
  error?: string;
  identity?: string;
  version?: string;
  boardName?: string;
  uptime?: string;
}

export function ConnectDialog({
  router,
  open,
  onOpenChange,
  onConnect,
}: ConnectDialogProps) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<ConnectResponse | null>(null);

  const handleConnect = async () => {
    if (!router) return;
    setConnecting(true);
    setError(null);
    setDetails(null);

    try {
      const result = await fetchMikrotikApi<ConnectResponse>("/api/mikrotik/connect", {
        method: "POST",
        body: JSON.stringify({
          routerId: router.id,
          host: router.ipAddress,
          username: router.username,
          password: router.password,
          port: router.port ?? 8728,
        }),
      });

      if (!result.success) {
        setError(result.error ?? "Connection failed");
        return;
      }

      setDetails(result);
      onConnect(router);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test Router Connection</DialogTitle>
          <DialogDescription>
            Connect via RouterOS API (same as Winbox) to{" "}
            <strong>{router?.sessionName}</strong> at{" "}
            <strong>{router?.ipAddress || "—"}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Session</span>
            <span className="font-medium">{router?.sessionName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Host</span>
            <span className="font-mono">{router?.ipAddress || "Not configured"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Username</span>
            <span>{router?.username || "—"}</span>
          </div>
          {details?.success && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Identity</span>
                <span>{details.identity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">RouterOS</span>
                <span>{details.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Board</span>
                <span>{details.boardName}</span>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={connecting || !router?.ipAddress}>
            {connecting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <PlugZap className="size-4" />
                Connect
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
