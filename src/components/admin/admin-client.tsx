"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  DollarSign,
  Key,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchMikrotikApi } from "@/lib/api/client";

interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  password: string;
  role: string;
  campName: string;
  createdAt: string;
}

interface CampPricing {
  id: number;
  campName: string;
  validityName: string;
  companyName: string;
  price: number;
  status: number;
}

export function AdminClient() {
  const [activeTab, setActiveTab] = useState("users");
  const [loading, setLoading] = useState(true);

  // Users State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("salesperson");
  const [newUserCamp, setNewUserCamp] = useState("All Camps");
  const [savingUser, setSavingUser] = useState(false);

  // Pricing State
  const [campPricing, setCampPricing] = useState<CampPricing[]>([]);
  const [registeredCamps, setRegisteredCamps] = useState<string[]>([]);
  const [validityProfiles, setValidityProfiles] = useState<string[]>([]);
  const [activePricingCamp, setActivePricingCamp] = useState<string>("");
  const [pricingSearch, setPricingSearch] = useState("");
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [selectedCamp, setSelectedCamp] = useState("");
  const [selectedValidity, setSelectedValidity] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [savingPricing, setSavingPricing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, pricingRes] = await Promise.all([
        fetchMikrotikApi<{ users: AdminUser[] }>("/api/mikrotik/admin/users"),
        fetchMikrotikApi<{
          campPricing: CampPricing[];
          registeredCamps: string[];
          validityProfiles: string[];
        }>("/api/mikrotik/admin/pricing"),
      ]);

      if (usersRes.users) setUsers(usersRes.users);
      if (pricingRes.campPricing) setCampPricing(pricingRes.campPricing);
      if (pricingRes.registeredCamps) {
        setRegisteredCamps(pricingRes.registeredCamps);
        if (pricingRes.registeredCamps.length > 0 && !activePricingCamp) {
          setActivePricingCamp(pricingRes.registeredCamps[0]);
        }
      }
      if (pricingRes.validityProfiles) setValidityProfiles(pricingRes.validityProfiles);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, [activePricingCamp]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setNewUsername("");
    setNewDisplayName("");
    setNewPassword("");
    setNewUserRole("salesperson");
    setNewUserCamp("All Camps");
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setNewUsername(user.username);
    setNewDisplayName(user.displayName || user.username);
    setNewPassword("");
    setNewUserRole(user.role);
    setNewUserCamp(user.campName);
    setUserModalOpen(true);
  };

  // Handle Save or Update User
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser && (!newUsername.trim() || !newPassword.trim())) {
      toast.error("Please enter both username and password");
      return;
    }

    setSavingUser(true);
    try {
      if (editingUser) {
        // Update user
        await fetchMikrotikApi("/api/mikrotik/admin/users", {
          method: "PUT",
          body: JSON.stringify({
            id: editingUser.id,
            username: newUsername.trim(),
            displayName: newDisplayName.trim() || newUsername.trim(),
            password: newPassword.trim() ? newPassword.trim() : undefined,
            role: newUserRole,
            campName: newUserCamp,
          }),
        });
        toast.success(`Salesperson account updated to "${newDisplayName.trim() || newUsername.trim()}"!`);
      } else {
        // Create user
        await fetchMikrotikApi("/api/mikrotik/admin/users", {
          method: "POST",
          body: JSON.stringify({
            username: newUsername.trim(),
            displayName: newDisplayName.trim() || newUsername.trim(),
            password: newPassword.trim(),
            role: newUserRole,
            campName: newUserCamp,
          }),
        });
        toast.success(`Salesperson account "${newDisplayName || newUsername}" created successfully!`);
      }

      setUserModalOpen(false);
      setEditingUser(null);
      setNewUsername("");
      setNewDisplayName("");
      setNewPassword("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSavingUser(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to delete salesperson account "${user.username}"?`)) {
      return;
    }

    try {
      await fetchMikrotikApi(`/api/mikrotik/admin/users?id=${user.id}`, {
        method: "DELETE",
      });
      toast.success(`Account "${user.username}" deleted`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  const handleOpenEditPricing = (item: CampPricing) => {
    setSelectedCamp(item.campName);
    setSelectedValidity(item.validityName);
    setCustomPrice(item.price.toString());
    setPricingModalOpen(true);
  };

  // Handle Save Pricing
  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCamp || !selectedValidity || !customPrice) {
      toast.error("Please select a Camp, Plan, and Price");
      return;
    }

    setSavingPricing(true);
    try {
      await fetchMikrotikApi("/api/mikrotik/admin/pricing", {
        method: "POST",
        body: JSON.stringify({
          campName: selectedCamp,
          validityName: selectedValidity,
          price: Number(customPrice),
          status: 1,
        }),
      });

      toast.success(`Price updated for ${selectedCamp} (${selectedValidity}) -> AED ${customPrice}`);
      setPricingModalOpen(false);
      setSelectedCamp("");
      setSelectedValidity("");
      setCustomPrice("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save pricing");
    } finally {
      setSavingPricing(false);
    }
  };

  // Handle Delete Pricing
  const handleDeletePricing = async (p: CampPricing) => {
    if (!confirm(`Delete custom price for ${p.campName} (${p.validityName})?`)) {
      return;
    }

    try {
      await fetchMikrotikApi(`/api/mikrotik/admin/pricing?id=${p.id}`, {
        method: "DELETE",
      });
      toast.success("Custom price removed");
      setCampPricing((prev) => prev.filter((item) => item.id !== p.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete pricing");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.campName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredPricing = campPricing.filter(
    (p) =>
      p.campName.toLowerCase().includes(pricingSearch.toLowerCase()) ||
      p.validityName.toLowerCase().includes(pricingSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Management Hub"
        description="Configure Salespeople login credentials and Camp custom voucher pricing across all systems."
      >
        <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/80 p-1">
          <TabsTrigger value="users" className="gap-2">
            <Users className="size-4" />
            Salespeople Accounts ({users.length})
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2">
            <DollarSign className="size-4" />
            Camp Pricing Settings ({campPricing.length})
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: SALESPEOPLE MANAGEMENT ── */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search salesperson..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
            <Button
              className="w-full sm:w-auto bg-[#4A60D6] hover:bg-[#3b50c0] text-white"
              onClick={handleOpenAddUser}
            >
              <UserPlus className="mr-2 size-4" />
              Add New Salesperson
            </Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Login Username</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Assigned Camp</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Password / PIN</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No salespeople found. Click &quot;Add Salesperson&quot; to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user, idx) => (
                    <TableRow key={user.id}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                        {user.username}
                      </TableCell>
                      <TableCell className="font-medium text-blue-700 dark:text-blue-300">
                        {user.displayName || user.username}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                          <Building2 className="size-3" />
                          {user.campName}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                          {user.role}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        ••••••••
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => handleOpenEditUser(user)}
                          >
                            <Key className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => void handleDeleteUser(user)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── TAB 2: CAMP PRICING SETTINGS ── */}
        <TabsContent value="pricing" className="space-y-4">
          {/* Camp Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">
              Select Camp:
            </span>
            {registeredCamps.map((camp) => (
              <button
                key={camp}
                type="button"
                onClick={() => setActivePricingCamp(camp)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activePricingCamp === camp
                    ? "bg-[#4A60D6] text-white shadow-sm font-semibold"
                    : "bg-card border text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {camp}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search plan in this camp..."
                value={pricingSearch}
                onChange={(e) => setPricingSearch(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
            <Button
              className="w-full sm:w-auto bg-[#4A60D6] hover:bg-[#3b50c0] text-white"
              onClick={() => {
                setSelectedCamp(activePricingCamp || (registeredCamps[0] ?? ""));
                setPricingModalOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Configure {activePricingCamp ? `"${activePricingCamp}"` : "Camp"} Price
            </Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Camp Name</TableHead>
                  <TableHead>Validity Plan</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Price (AED)</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campPricing
                  .filter((item) => !activePricingCamp || item.campName.toLowerCase() === activePricingCamp.toLowerCase())
                  .filter((item) => item.validityName.toLowerCase().includes(pricingSearch.toLowerCase())).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No custom prices configured for {activePricingCamp ? `"${activePricingCamp}"` : "this camp"}. Click &quot;Configure Camp Price&quot; to set custom rates.
                    </TableCell>
                  </TableRow>
                ) : (
                  campPricing
                    .filter((item) => !activePricingCamp || item.campName.toLowerCase() === activePricingCamp.toLowerCase())
                    .filter((item) => item.validityName.toLowerCase().includes(pricingSearch.toLowerCase()))
                    .map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-semibold text-blue-900 dark:text-blue-200">
                          {item.campName}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                            <Tag className="size-3" />
                            {item.validityName}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.companyName}</TableCell>
                        <TableCell className="font-bold text-emerald-600 dark:text-emerald-400">
                          AED {item.price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                              onClick={() => handleOpenEditPricing(item)}
                            >
                              <DollarSign className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => void handleDeletePricing(item)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── MODAL: ADD / EDIT SALESPERSON ── */}
      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveUser}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="size-5 text-blue-600" />
                {editingUser ? `Edit Salesperson (${editingUser.username})` : "Add New Salesperson"}
              </DialogTitle>
              <DialogDescription>
                {editingUser 
                  ? "Update password, assigned camp, or account role for this salesperson."
                  : "Create a login account for a mobile sales agent. They can immediately log in from the mobile app."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Login Username</Label>
                <Input
                  id="username"
                  placeholder="e.g. Fasil@2020 or Akif"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="displayName">Display Name (Shown on Welcome Screen)</Label>
                <Input
                  id="displayName"
                  placeholder="e.g. Fasil or Akif"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">{editingUser ? "New Password / PIN (Leave empty to keep current)" : "Login Password / PIN"}</Label>
                <Input
                  id="password"
                  placeholder={editingUser ? "Enter new PIN or password" : "Enter numeric PIN or password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required={!editingUser}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role">Account Role</Label>
                <Select value={newUserRole} onValueChange={(v) => v && setNewUserRole(v)}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salesperson">Salesperson (Mobile App)</SelectItem>
                    <SelectItem value="admin">Administrator (Full Access)</SelectItem>
                    <SelectItem value="operator">Operator (Recharge Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="camp">Assigned Camp (Optional)</Label>
                <Select value={newUserCamp} onValueChange={(v) => v && setNewUserCamp(v)}>
                  <SelectTrigger id="camp">
                    <SelectValue placeholder="Select camp" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Camps">All Camps (Global)</SelectItem>
                    {registeredCamps.map((camp) => (
                      <SelectItem key={camp} value={camp}>
                        {camp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUserModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingUser} className="bg-[#4A60D6] text-white">
                {savingUser ? "Saving..." : editingUser ? "Update Account" : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: CONFIGURE CAMP PRICING ── */}
      <Dialog open={pricingModalOpen} onOpenChange={setPricingModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSavePricing}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="size-5 text-emerald-600" />
                Configure Camp Voucher Price
              </DialogTitle>
              <DialogDescription>
                Set a specific selling price for a validity plan in a selected camp.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="pricingCamp">Camp Name</Label>
                <Select value={selectedCamp} onValueChange={(v) => v && setSelectedCamp(v)}>
                  <SelectTrigger id="pricingCamp">
                    <SelectValue placeholder="Select camp" />
                  </SelectTrigger>
                  <SelectContent>
                    {registeredCamps.map((camp) => (
                      <SelectItem key={camp} value={camp}>
                        {camp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pricingPlan">Validity Plan</Label>
                <Select value={selectedValidity} onValueChange={(v) => v && setSelectedValidity(v)}>
                  <SelectTrigger id="pricingPlan">
                    <SelectValue placeholder="Select validity plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {validityProfiles.map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {plan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="price">Selling Price (AED)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.5"
                  placeholder="e.g. 32.00 or 16.00"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPricingModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingPricing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {savingPricing ? "Saving..." : "Save Price"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
