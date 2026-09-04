"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  Briefcase,
  Layers,
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
  companyName: string;
  allowedCamps: string[];
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

interface CompanyAdmin {
  id: number;
  username: string;
  companyName: string;
  role: string;
  createdAt: string;
}

interface CompanyItem {
  id: number;
  name: string;
}

interface CampWithCompany {
  name: string;
  companyName: string | null;
}

export function AdminClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("users");
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(true);

  // Role Protection Check: Only Superadmin can access Admin Hub
  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("admin_user_role");
      if (role === "company_admin") {
        setIsSuperAdmin(false);
        toast.error("Access Denied: Admin Hub is restricted to Super Administrator.");
        router.replace("/dashboard");
      }
    }
  }, [router]);

  // Users State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("salesperson");
  const [newUserCompany, setNewUserCompany] = useState("");
  const [newUserAllowedCamps, setNewUserAllowedCamps] = useState<string[]>([]);
  const [savingUser, setSavingUser] = useState(false);

  // Pricing State
  const [campPricing, setCampPricing] = useState<CampPricing[]>([]);
  const [registeredCamps, setRegisteredCamps] = useState<string[]>([]);
  const [campsWithCompany, setCampsWithCompany] = useState<CampWithCompany[]>([]);
  const [companiesList, setCompaniesList] = useState<string[]>([]);
  const [validityProfiles, setValidityProfiles] = useState<string[]>([]);
  const [activePricingCamp, setActivePricingCamp] = useState<string>("");
  const [pricingSearch, setPricingSearch] = useState("");
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [selectedCamp, setSelectedCamp] = useState("");
  const [selectedValidity, setSelectedValidity] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [savingPricing, setSavingPricing] = useState(false);

  // Filter by Company for Super Admin
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("ALL");

  // Company Admins State
  const [companyAdmins, setCompanyAdmins] = useState<CompanyAdmin[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [companyAdminModalOpen, setCompanyAdminModalOpen] = useState(false);
  const [editingCompanyAdmin, setEditingCompanyAdmin] = useState<CompanyAdmin | null>(null);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminCompany, setAdminCompany] = useState("");
  const [savingCompanyAdmin, setSavingCompanyAdmin] = useState(false);

  // Create Company Modal
  const [newCompanyModalOpen, setNewCompanyModalOpen] = useState(false);
  const [newCompanyNameInput, setNewCompanyNameInput] = useState("");
  const [savingNewCompany, setSavingNewCompany] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, pricingRes, companiesRes] = await Promise.all([
        fetchMikrotikApi<{ users: AdminUser[] }>("/api/mikrotik/admin/users"),
        fetchMikrotikApi<{
          campPricing: CampPricing[];
          registeredCamps: string[];
          campsWithCompany?: CampWithCompany[];
          companies?: string[];
          validityProfiles: string[];
        }>("/api/mikrotik/admin/pricing"),
        fetchMikrotikApi<{
          companies: CompanyItem[];
          companyAdmins: CompanyAdmin[];
        }>("/api/mikrotik/admin/companies").catch(() => ({ companies: [], companyAdmins: [] })),
      ]);

      if (usersRes.users) setUsers(usersRes.users);
      if (pricingRes.campPricing) setCampPricing(pricingRes.campPricing);
      if (pricingRes.registeredCamps) {
        setRegisteredCamps(pricingRes.registeredCamps);
        if (pricingRes.registeredCamps.length > 0 && !activePricingCamp) {
          setActivePricingCamp(pricingRes.registeredCamps[0]);
        }
      }
      if (pricingRes.campsWithCompany) setCampsWithCompany(pricingRes.campsWithCompany);
      
      const allCompanies = new Set<string>();
      if (pricingRes.companies) {
        pricingRes.companies.forEach((c) => allCompanies.add(c));
      }
      if (companiesRes.companies) {
        companiesRes.companies.forEach((c) => allCompanies.add(c.name));
      }
      if (allCompanies.size === 0) {
        allCompanies.add("Apricom DXB");
        allCompanies.add("Apricom KSA");
      }
      setCompaniesList(Array.from(allCompanies));

      if (companiesRes.companyAdmins) {
        setCompanyAdmins(companiesRes.companyAdmins);
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

  // Handle salesperson camp options filtered by company
  const availableCampsForSelectedCompany = newUserCompany
    ? campsWithCompany
        .filter((c) => !c.companyName || c.companyName.toLowerCase() === newUserCompany.toLowerCase())
        .map((c) => c.name)
    : registeredCamps;

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setNewUsername("");
    setNewDisplayName("");
    setNewPassword("");
    setNewUserRole("salesperson");
    setNewUserCompany("");
    setNewUserAllowedCamps([]);
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setNewUsername(user.username);
    setNewDisplayName(user.displayName || user.username);
    setNewPassword("");
    setNewUserRole(user.role);
    setNewUserCompany(user.companyName || "");
    setNewUserAllowedCamps(user.allowedCamps || (user.campName && user.campName !== "All Camps" ? [user.campName] : []));
    setUserModalOpen(true);
  };

  const toggleAllowedCamp = (campName: string) => {
    setNewUserAllowedCamps((prev) =>
      prev.includes(campName) ? prev.filter((c) => c !== campName) : [...prev, campName]
    );
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
      const primaryCamp = newUserAllowedCamps.length > 0 ? newUserAllowedCamps[0] : "All Camps";

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
            companyName: newUserCompany,
            campName: primaryCamp,
            allowedCamps: newUserAllowedCamps,
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
            companyName: newUserCompany,
            campName: primaryCamp,
            allowedCamps: newUserAllowedCamps,
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

  // ── Company Admin Actions ──
  const handleOpenAddCompanyAdmin = () => {
    setEditingCompanyAdmin(null);
    setAdminUsername("");
    setAdminPassword("");
    setAdminCompany("");
    setCompanyAdminModalOpen(true);
  };

  const handleOpenEditCompanyAdmin = (admin: CompanyAdmin) => {
    setEditingCompanyAdmin(admin);
    setAdminUsername(admin.username);
    setAdminPassword("");
    setAdminCompany(admin.companyName);
    setCompanyAdminModalOpen(true);
  };

  const handleSaveCompanyAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername.trim() || (!editingCompanyAdmin && !adminPassword.trim()) || !adminCompany) {
      toast.error("Please fill in username, password, and company");
      return;
    }

    setSavingCompanyAdmin(true);
    try {
      await fetchMikrotikApi("/api/mikrotik/admin/companies", {
        method: "POST",
        body: JSON.stringify({
          action: "create_admin",
          id: editingCompanyAdmin?.id,
          username: adminUsername.trim(),
          password: adminPassword.trim(),
          companyName: adminCompany,
        }),
      });

      toast.success(
        editingCompanyAdmin
          ? `Company admin "${adminUsername}" updated!`
          : `Company admin "${adminUsername}" created successfully!`
      );
      setCompanyAdminModalOpen(false);
      setEditingCompanyAdmin(null);
      setAdminUsername("");
      setAdminPassword("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save company admin");
    } finally {
      setSavingCompanyAdmin(false);
    }
  };

  const handleDeleteCompanyAdmin = async (admin: CompanyAdmin) => {
    if (!confirm(`Are you sure you want to delete company admin "${admin.username}" (${admin.companyName})?`)) {
      return;
    }

    try {
      await fetchMikrotikApi("/api/mikrotik/admin/companies", {
        method: "POST",
        body: JSON.stringify({
          action: "delete_admin",
          id: admin.id,
        }),
      });
      toast.success(`Company admin "${admin.username}" deleted`);
      setCompanyAdmins((prev) => prev.filter((a) => a.id !== admin.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete company admin");
    }
  };

  const handleCreateNewCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyNameInput.trim()) {
      toast.error("Please enter a company name");
      return;
    }

    setSavingNewCompany(true);
    try {
      await fetchMikrotikApi("/api/mikrotik/admin/companies", {
        method: "POST",
        body: JSON.stringify({
          action: "create_company",
          companyName: newCompanyNameInput.trim(),
        }),
      });
      toast.success(`Company "${newCompanyNameInput.trim()}" created!`);
      setNewCompanyModalOpen(false);
      setNewCompanyNameInput("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setSavingNewCompany(false);
    }
  };

  // Pricing Actions
  const handleOpenEditPricing = (item: CampPricing) => {
    setSelectedCamp(item.campName);
    setSelectedValidity(item.validityName);
    setCustomPrice(item.price.toString());
    setPricingModalOpen(true);
  };

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

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.campName.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.companyName && u.companyName.toLowerCase().includes(userSearch.toLowerCase())) ||
      u.role.toLowerCase().includes(userSearch.toLowerCase());

    const matchesCompany =
      selectedCompanyFilter === "ALL" ||
      (u.companyName && u.companyName.toLowerCase() === selectedCompanyFilter.toLowerCase());

    return matchesSearch && matchesCompany;
  });

  const filteredPricing = campPricing.filter((p) => {
    const matchesSearch =
      p.campName.toLowerCase().includes(pricingSearch.toLowerCase()) ||
      p.validityName.toLowerCase().includes(pricingSearch.toLowerCase());

    const matchesCompany =
      selectedCompanyFilter === "ALL" ||
      (p.companyName && p.companyName.toLowerCase() === selectedCompanyFilter.toLowerCase());

    return matchesSearch && matchesCompany;
  });

  const filteredCompanyAdmins = companyAdmins.filter(
    (a) =>
      a.username.toLowerCase().includes(companySearch.toLowerCase()) ||
      a.companyName.toLowerCase().includes(companySearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Dynamic suggestions datalist for company input */}
      <datalist id="companies-suggestions">
        {companiesList.map((comp) => (
          <option key={comp} value={comp} />
        ))}
      </datalist>

      <PageHeader
        title="Admin Management Hub"
        description="Configure Multi-Tenant Company Accounts, Salespeople granular camp permissions, and Camp custom pricing."
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
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="size-4" />
            Company Accounts ({companyAdmins.length})
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2">
            <DollarSign className="size-4" />
            Camp Pricing Settings ({campPricing.length})
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: SALESPEOPLE MANAGEMENT ── */}
        <TabsContent value="users" className="space-y-4">
          {/* Company Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
              <Briefcase className="size-3.5" />
              Company:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCompanyFilter("ALL")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedCompanyFilter === "ALL"
                  ? "bg-[#4A60D6] text-white shadow-sm font-semibold"
                  : "bg-card border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              All Companies ({users.length})
            </button>
            {companiesList.map((comp) => {
              const count = users.filter((u) => u.companyName && u.companyName.toLowerCase() === comp.toLowerCase()).length;
              return (
                <button
                  key={comp}
                  type="button"
                  onClick={() => setSelectedCompanyFilter(comp)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedCompanyFilter.toLowerCase() === comp.toLowerCase()
                      ? "bg-[#4A60D6] text-white shadow-sm font-semibold"
                      : "bg-card border text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {comp} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search salesperson, camp, company..."
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
                  <TableHead>Company</TableHead>
                  <TableHead>Allowed Camps / Permissions</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      No salespeople found. Click &quot;Add New Salesperson&quot; to create one.
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
                        {user.companyName ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                            <Briefcase className="size-3" />
                            {user.companyName}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Global</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.allowedCamps && user.allowedCamps.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.allowedCamps.map((camp) => (
                              <span
                                key={camp}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300"
                              >
                                <Building2 className="size-3" />
                                {camp}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                            <Building2 className="size-3" />
                            {user.campName || "All Camps"}
                          </span>
                        )}
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

        {/* ── TAB 2: COMPANY TENANT ACCOUNTS ── */}
        <TabsContent value="companies" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search company admin..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
            <Button
              className="bg-[#4A60D6] hover:bg-[#3b50c0] text-white"
              onClick={handleOpenAddCompanyAdmin}
            >
              <Plus className="mr-2 size-4" />
              Add Company & Admin Account
            </Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Admin Username</TableHead>
                  <TableHead>Assigned Company</TableHead>
                  <TableHead>Account Role</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Created Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanyAdmins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No company admin accounts found. Click &quot;Create Company Admin&quot; to provide login credentials to a client company.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanyAdmins.map((admin, idx) => (
                    <TableRow key={admin.id}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                        {admin.username}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                          <Briefcase className="size-3.5" />
                          {admin.companyName}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                          <ShieldCheck className="size-3" />
                          Company Admin
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        ••••••••
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {admin.createdAt ? admin.createdAt.slice(0, 10) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => handleOpenEditCompanyAdmin(admin)}
                          >
                            <Key className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => void handleDeleteCompanyAdmin(admin)}
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

        {/* ── TAB 3: CAMP PRICING SETTINGS ── */}
        <TabsContent value="pricing" className="space-y-4">
          {/* Company Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
              <Briefcase className="size-3.5" />
              Company:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCompanyFilter("ALL")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedCompanyFilter === "ALL"
                  ? "bg-[#4A60D6] text-white shadow-sm font-semibold"
                  : "bg-card border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              All Companies
            </button>
            {companiesList.map((comp) => (
              <button
                key={comp}
                type="button"
                onClick={() => setSelectedCompanyFilter(comp)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedCompanyFilter.toLowerCase() === comp.toLowerCase()
                    ? "bg-[#4A60D6] text-white shadow-sm font-semibold"
                    : "bg-card border text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {comp}
              </button>
            ))}
          </div>

          {/* Camp Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">
              Select Camp:
            </span>
            {(selectedCompanyFilter === "ALL"
              ? registeredCamps
              : campsWithCompany
                  .filter((c) => !c.companyName || c.companyName.toLowerCase() === selectedCompanyFilter.toLowerCase())
                  .map((c) => c.name)
            ).map((camp) => (
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveUser}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="size-5 text-blue-600" />
                {editingUser ? `Edit Salesperson (${editingUser.username})` : "Add New Salesperson"}
              </DialogTitle>
              <DialogDescription>
                {editingUser 
                  ? "Update company assignment, allowed camps permissions, or password for this salesperson."
                  : "Assign this salesperson to a Company and select which Camps they are authorized to recharge."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="username">Login Username *</Label>
                  <Input
                    id="username"
                    placeholder="e.g. Fasil@2020 or Akif"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    placeholder="e.g. Fasil or Akif"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">{editingUser ? "New Password / PIN (Leave empty to keep current)" : "Login Password / PIN *"}</Label>
                <Input
                  id="password"
                  placeholder={editingUser ? "Enter new PIN or password" : "Enter numeric PIN or password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required={!editingUser}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="companyInput">Company Name</Label>
                  <Input
                    id="companyInput"
                    list="companies-suggestions"
                    placeholder="Type new or select existing..."
                    value={newUserCompany}
                    onChange={(e) => setNewUserCompany(e.target.value)}
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
              </div>

              {/* Granular Camp Access Checkboxes */}
              <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Authorized Camps ({newUserAllowedCamps.length} selected)
                  </Label>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setNewUserAllowedCamps([...availableCampsForSelectedCompany])}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Select All
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setNewUserAllowedCamps([])}
                      className="text-muted-foreground hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  The mobile app will restrict this sales agent to only view and recharge for these specific camps.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 max-h-40 overflow-y-auto">
                  {availableCampsForSelectedCompany.length === 0 ? (
                    <div className="col-span-2 text-xs text-muted-foreground py-2">
                      No camps registered under {newUserCompany || "this company"}.
                    </div>
                  ) : (
                    availableCampsForSelectedCompany.map((camp) => {
                      const isChecked = newUserAllowedCamps.includes(camp);
                      return (
                        <label
                          key={camp}
                          className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? "bg-blue-50 border-blue-300 text-blue-900 font-semibold dark:bg-blue-950/50 dark:border-blue-700 dark:text-blue-200"
                              : "bg-card border-border text-slate-700 dark:text-slate-300 hover:bg-muted"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleAllowedCamp(camp)}
                            className="size-4 rounded border-gray-300 text-[#4A60D6] focus:ring-[#4A60D6]"
                          />
                          <Building2 className="size-3.5 text-muted-foreground" />
                          <span className="truncate">{camp}</span>
                        </label>
                      );
                    })
                  )}
                </div>
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

      {/* ── MODAL: CREATE / EDIT COMPANY ADMIN ── */}
      <Dialog open={companyAdminModalOpen} onOpenChange={setCompanyAdminModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveCompanyAdmin}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="size-5 text-amber-600" />
                {editingCompanyAdmin ? `Edit Company Admin (${editingCompanyAdmin.username})` : "Create Company Admin Account"}
              </DialogTitle>
              <DialogDescription>
                Company Admins can log in to view only their assigned company&apos;s camps, routers, and staff.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="adminCompanyInput">Company Name *</Label>
                <Input
                  id="adminCompanyInput"
                  list="companies-suggestions"
                  placeholder="e.g. Starlink WiFi, Apricom DXB, etc."
                  value={adminCompany}
                  onChange={(e) => setAdminCompany(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adminUsername">Admin Login Username *</Label>
                <Input
                  id="adminUsername"
                  placeholder="e.g. apricom_admin"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adminPassword">{editingCompanyAdmin ? "New Password (Leave empty to keep current)" : "Login Password *"}</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  placeholder={editingCompanyAdmin ? "Enter new password" : "Enter secure admin password"}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required={!editingCompanyAdmin}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCompanyAdminModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingCompanyAdmin} className="bg-amber-600 hover:bg-amber-700 text-white">
                {savingCompanyAdmin ? "Saving..." : editingCompanyAdmin ? "Update Admin" : "Create Company Admin"}
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
