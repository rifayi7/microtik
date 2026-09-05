"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Loader2,
  PlugZap,
  Plus,
  Settings,
  Tag,
  Trash2,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { AddRouterDialog } from "@/components/routers/add-router-dialog";
import { useRouterContext } from "@/contexts/router-context";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StoredRouter } from "@/lib/router-store";

export function SetupRouterList() {
  const { routers, connectRouter, removeRouter } = useRouterContext();
  const [addOpen, setAddOpen] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoredRouter | null>(null);

  const handleConnect = async (router: StoredRouter) => {
    setConnectingId(router.id);
    try {
      await connectRouter(router.id);
      toast.success(`Connected to ${router.sessionName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="toetik-panel space-y-4">
      <Tabs value="routers">
        <TabsList className="h-auto flex-wrap gap-1 bg-white dark:bg-card p-1">
          <TabsTrigger value="settings" render={<Link href="/settings/routers" />} nativeButton={false}>
            Settings
          </TabsTrigger>
          <TabsTrigger value="admin" disabled>
            Admin
          </TabsTrigger>
          <TabsTrigger value="routers" className="bg-white dark:bg-zinc-800 shadow-sm">
            Router List
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Button
        variant="outline"
        className="bg-white dark:bg-card"
        onClick={() => setAddOpen(true)}
      >
        <Plus className="size-4" />
        Add Router
      </Button>

      {routers.length === 0 ? (
        <div className="overflow-hidden rounded-lg border bg-white dark:bg-card">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No routers added. Click &quot;Add Router&quot; to get started.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: Verified & Active Camps */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20"></span>
                Verified & Active Camps
                <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.2 text-xs font-semibold text-emerald-600">
                  {routers.filter((r) => r.verified !== false).length}
                </span>
              </h3>
            </div>

            {routers.filter((r) => r.verified !== false).length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                No active verified camps. Connect to a router below to activate it.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border bg-white dark:bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Camp / Session Name</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routers
                      .filter((r) => r.verified !== false)
                      .map((router, index) => (
                        <TableRow key={router.id} className={index % 2 ? "bg-muted/20" : ""}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2 font-medium">
                              <Tag className="size-3.5 text-muted-foreground" />
                              {router.sessionName}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setDeleteTarget(router)}
                              >
                                <Trash2 className="size-4 text-red-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                render={<Link href={`/routers/${router.id}`} />}
                                nativeButton={false}
                              >
                                <Settings className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                disabled={connectingId === router.id}
                                onClick={() => void handleConnect(router)}
                                title={connectingId === router.id ? "Connecting..." : "Connect Router"}
                              >
                                {connectingId === router.id ? (
                                  <Loader2 className="size-4 animate-spin text-[#4A60D6]" />
                                ) : (
                                  <PlugZap className="size-4 text-emerald-600 hover:text-emerald-700" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* SECTION 2: Pending / Unverified Routers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20"></span>
                Pending / Unverified Routers (Drafts)
                <span className="rounded-md bg-amber-500/10 px-1.5 py-0.2 text-xs font-semibold text-amber-600">
                  {routers.filter((r) => r.verified === false).length}
                </span>
              </h3>
            </div>

            {routers.filter((r) => r.verified === false).length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                No pending draft routers.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border bg-white dark:bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-amber-500/10 hover:bg-amber-500/10">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Session Name</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routers
                      .filter((r) => r.verified === false)
                      .map((router, index) => (
                        <TableRow key={router.id} className="bg-amber-500/[0.02]">
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2 font-medium">
                              <Tag className="size-3.5 text-muted-foreground" />
                              {router.sessionName}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setDeleteTarget(router)}
                              >
                                <Trash2 className="size-4 text-red-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                render={<Link href={`/routers/${router.id}`} />}
                                nativeButton={false}
                              >
                                <Settings className="size-4" />
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                className="border-amber-500/30 text-amber-600 hover:bg-amber-50 ml-1"
                                disabled={connectingId === router.id}
                                onClick={() => void handleConnect(router)}
                              >
                                {connectingId === router.id ? (
                                  <>
                                    <Loader2 className="mr-1 size-3.5 animate-spin text-amber-600" />
                                    Verifying...
                                  </>
                                ) : (
                                  <>
                                    <PlugZap className="mr-1 size-3.5" />
                                    Verify
                                  </>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
                              Pending Connect
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      <AddRouterDialog open={addOpen} onOpenChange={setAddOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete router?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &quot;{deleteTarget?.sessionName}&quot; from your saved routers?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  removeRouter(deleteTarget.id);
                  toast.success("Router removed");
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
