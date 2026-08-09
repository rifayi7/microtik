"use client";

import { useState } from "react";
import Link from "next/link";
import {
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

      <div className="overflow-hidden rounded-lg border bg-white dark:bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Session Name</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Hotspot Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No routers added. Click &quot;Add Router&quot; to get started.
                </TableCell>
              </TableRow>
            ) : (
              routers.map((router, index) => (
                <TableRow key={router.id} className={index % 2 ? "bg-muted/20" : ""}>
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
                        render={<Link href={`/settings/routers/${router.id}`} />}
                        nativeButton={false}
                      >
                        <Settings className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={connectingId === router.id}
                        onClick={() => void handleConnect(router)}
                      >
                        <PlugZap
                          className={`size-4 ${connectingId === router.id ? "animate-pulse" : ""}`}
                        />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <Wifi className="size-3.5 text-muted-foreground" />
                      {router.hotspotName}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
