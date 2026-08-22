"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Filter,
  Minus,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useRouterContext } from "@/contexts/router-context";
import { fetchForRouter } from "@/lib/api/client";
import type { HotspotUser } from "@/lib/types";
import { HotspotTabs } from "@/components/hotspot/hotspot-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/table-skeleton";

export function HotspotUsersView() {
  const { activeRouter } = useRouterContext();
  const [users, setUsers] = useState<HotspotUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [profiles, setProfiles] = useState<{ name: string }[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState("default");
  const [comment, setComment] = useState("");

  // Generate states
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genQty, setGenQty] = useState("1");
  const [genServer, setGenServer] = useState("all");
  const [genUserMode, setGenUserMode] = useState("username_equals_password");
  const [genNameLength, setGenNameLength] = useState("8");
  const [genPrefix, setGenPrefix] = useState("");
  const [genCharacters, setGenCharacters] = useState("abcd2345");
  const [genProfile, setGenProfile] = useState("default");
  const [genComment, setGenComment] = useState("");
  const [generating, setGenerating] = useState(false);

  const loadProfiles = useCallback(async () => {
    if (!activeRouter) return;
    try {
      const payload = await fetchForRouter<{ profiles: { name: string }[] }>(
        "/api/mikrotik/profiles",
        activeRouter
      );
      setProfiles(payload.profiles);
    } catch {
      setProfiles([{ name: "default" }]);
    }
  }, [activeRouter]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const load = useCallback(async () => {
    if (!activeRouter) return;
    setLoading(true);
    try {
      const payload = await fetchForRouter<{ users: HotspotUser[] }>(
        "/api/mikrotik/users",
        activeRouter
      );
      setUsers(payload.users);
    } finally {
      setLoading(false);
    }
  }, [activeRouter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRouter) {
      toast.error("No active router connected");
      return;
    }
    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (username.trim().length !== 8) {
      toast.error("Code must be exactly 8 characters long");
      return;
    }
    setSubmitting(true);
    try {
      await fetchForRouter("/api/mikrotik/users/add", activeRouter, {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password: password || undefined,
          profile,
          comment: comment || undefined,
        }),
      });
      toast.success(`User "${username}" created successfully`);
      setUsername("");
      setPassword("");
      setProfile("default");
      setComment("");
      setAddOpen(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRouter) {
      toast.error("No active router connected");
      return;
    }
    const qtyNum = Number(genQty);
    const lenNum = Number(genNameLength);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (isNaN(lenNum) || lenNum <= 0) {
      toast.error("Name length must be greater than 0");
      return;
    }
    if (genPrefix.length >= lenNum) {
      toast.error("Prefix length must be less than Name Length");
      return;
    }
    if (!genCharacters) {
      toast.error("Character pool cannot be empty");
      return;
    }

    setGenerating(true);
    try {
      const response = await fetchForRouter<{ count: number }>(
        "/api/mikrotik/users/generate",
        activeRouter,
        {
          method: "POST",
          body: JSON.stringify({
            qty: qtyNum,
            server: genServer,
            userMode: genUserMode,
            nameLength: lenNum,
            prefix: genPrefix,
            characters: genCharacters,
            profile: genProfile,
            comment: genComment || undefined,
          }),
        }
      );
      toast.success(`Successfully generated ${response.count} unique codes`);
      setGenerateOpen(false);
      setGenQty("1");
      setGenPrefix("");
      setGenComment("");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate codes");
    } finally {
      setGenerating(false);
    }
  };

  const filtered = useMemo(() => {
    return users.filter(
      (user) =>
        user.username.toLowerCase().includes(search.toLowerCase()) ||
        user.profile.toLowerCase().includes(search.toLowerCase()) ||
        (user.comment ?? "").toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="toetik-panel space-y-4">
      <HotspotTabs />

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border bg-white px-3 py-1 text-sm font-semibold dark:bg-card">
          {filtered.length}
        </span>
        <Button variant="outline" size="icon-sm" className="bg-white dark:bg-card" onClick={() => void load()}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="bg-white dark:bg-card pl-8"
            placeholder="Search..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button variant="outline" size="icon-sm" className="bg-white dark:bg-card">
          <Filter className="size-4" />
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" className="bg-white dark:bg-card" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Add
          </Button>
          <Button variant="outline" className="bg-white dark:bg-card" onClick={() => setGenerateOpen(true)}>Generate</Button>
          <Button variant="outline" className="bg-white dark:bg-card">Profile</Button>
          <Button variant="outline" className="bg-white dark:bg-card">Comment</Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="w-10" />
                <TableHead>Server</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>MAC Address</TableHead>
                <TableHead>Uptime</TableHead>
                <TableHead>Bytes In</TableHead>
                <TableHead>Bytes Out</TableHead>
                <TableHead>Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((user, index) => (
                <TableRow key={user.id} className={index % 2 ? "bg-muted/20" : ""}>
                  <TableCell>
                    <Button variant="ghost" size="icon-xs">
                      <Minus className="size-4 text-red-500" />
                    </Button>
                  </TableCell>
                  <TableCell>{user.server ?? "all"}</TableCell>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.profile}</TableCell>
                  <TableCell className="font-mono text-xs">{user.macAddress || "—"}</TableCell>
                  <TableCell>{user.uptime}</TableCell>
                  <TableCell>{user.bytesIn ?? user.dataUsed}</TableCell>
                  <TableCell>{user.bytesOut ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {user.comment || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {Array.from({ length: Math.min(totalPages, 8) }).map((_, i) => {
          const pageNum = i + 1;
          return (
            <Button
              key={pageNum}
              variant={page === pageNum ? "default" : "outline"}
              size="xs"
              onClick={() => setPage(pageNum)}
            >
              {pageNum}
            </Button>
          );
        })}
        {totalPages > 8 && <span className="text-muted-foreground">… {totalPages}</span>}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddUser}>
            <DialogHeader>
              <DialogTitle>Add Hotspot User</DialogTitle>
              <DialogDescription>
                Create a new login voucher/code directly on the active MikroTik router.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Voucher Code / Username</Label>
                <Input
                  id="username"
                  placeholder="e.g. 529813"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Password (optional)</Label>
                <Input
                  id="password"
                  placeholder="Leave empty for code-only login"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="profile">Profile</Label>
                <Select value={profile} onValueChange={(v) => v && setProfile(v)}>
                  <SelectTrigger id="profile">
                    <SelectValue placeholder="Select user profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="comment">Comment (optional)</Label>
                <Input
                  id="comment"
                  placeholder="e.g. 30 days - 32 AED"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding..." : "Add User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Generate Hotspot Users Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleGenerate}>
            <DialogHeader>
              <DialogTitle>Generate Hotspot Users</DialogTitle>
              <DialogDescription>
                Batch generate unique voucher codes directly on the active MikroTik router.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="genQty">Qty</Label>
                  <Input
                    id="genQty"
                    type="number"
                    placeholder="1"
                    value={genQty}
                    onChange={(e) => setGenQty(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="genServer">Server</Label>
                  <Input
                    id="genServer"
                    placeholder="all"
                    value={genServer}
                    onChange={(e) => setGenServer(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="genUserMode">User Mode</Label>
                <Select value={genUserMode} onValueChange={(v) => v && setGenUserMode(v)}>
                  <SelectTrigger id="genUserMode">
                    <SelectValue placeholder="Select user mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="username_equals_password">Username = Password</SelectItem>
                    <SelectItem value="username_only">Username only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="genNameLength">Name Length</Label>
                  <Input
                    id="genNameLength"
                    type="number"
                    placeholder="8"
                    value={genNameLength}
                    onChange={(e) => setGenNameLength(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="genPrefix">Prefix</Label>
                  <Input
                    id="genPrefix"
                    placeholder="Optional prefix"
                    value={genPrefix}
                    onChange={(e) => setGenPrefix(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="genCharacters">Characters</Label>
                <Input
                  id="genCharacters"
                  placeholder="abcd2345"
                  value={genCharacters}
                  onChange={(e) => setGenCharacters(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="genProfile">Profile</Label>
                <Select value={genProfile} onValueChange={(v) => v && setGenProfile(v)}>
                  <SelectTrigger id="genProfile">
                    <SelectValue placeholder="Select user profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="genComment">Comment</Label>
                <Input
                  id="genComment"
                  placeholder="e.g. 30 days - 32 AED"
                  value={genComment}
                  onChange={(e) => setGenComment(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGenerateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={generating} className="bg-yellow-500 hover:bg-yellow-600 text-white border-0">
                Generate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
