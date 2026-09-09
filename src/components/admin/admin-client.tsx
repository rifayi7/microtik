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
  Globe,
  Clock,
  BarChart3,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Bell,
  Send,
  AlertTriangle,
  Info,
  AlertOctagon,
  Wrench,
  Pause,
  Play,
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

interface SuperAdmin {
  id: number;
  username: string;
  displayName: string;
  password?: string;
  role: string;
  createdAt: string;
}

interface AdminUser {
  id: string | number;
  username: string;
  displayName: string;
  password: string;
  role: string;
  campName: string;
  companyName: string;
  companyId?: string | number | null;
  allowedCamps: string[];
  createdAt: string;
}

interface CampPricing {
  id: string | number;
  campName: string;
  validityName: string;
  companyName: string;
  price: number;
  status: number;
}

interface CompanyAdmin {
  id: string | number;
  username: string;
  companyName: string;
  companyId?: string | number | null;
  role: string;
  timezone?: string;
  createdAt: string;
  companyStatus?: number;
}

interface CompanyItem {
  id: number;
  name: string;
  timezone?: string;
  status?: number;
  suspendedReason?: string | null;
}

interface CampWithCompany {
  campId?: string | null;
  name: string;
  companyName: string | null;
  companyId?: number | null;
}

interface ReportUser {
  id: number;
  username: string;
  displayName: string;
  password?: string;
  companyId: number | null;
  companyName?: string;
  allowedCampIds: string[];
  status: number;
  createdAt: string;
}

interface BroadcastNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  targetType: string;
  companyId: number | null;
  companyName: string | null;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  readCount: number;
}

const TIMEZONE_OPTIONS = [
  { value: "Asia/Dubai", flag: "🇦🇪", label: "United Arab Emirates", gmt: "UTC+4", code: "AE" },
  { value: "Asia/Riyadh", flag: "🇸🇦", label: "Saudi Arabia (KSA)", gmt: "UTC+3", code: "SA" },
  { value: "Asia/Qatar", flag: "🇶🇦", label: "Qatar", gmt: "UTC+3", code: "QA" },
  { value: "Asia/Kuwait", flag: "🇰🇼", label: "Kuwait", gmt: "UTC+3", code: "KW" },
  { value: "Asia/Bahrain", flag: "🇧🇭", label: "Bahrain", gmt: "UTC+3", code: "BH" },
  { value: "Asia/Muscat", flag: "🇴🇲", label: "Oman", gmt: "UTC+4", code: "OM" },
  { value: "Africa/Cairo", flag: "🇪🇬", label: "Egypt", gmt: "UTC+2 / UTC+3", code: "EG" },
  { value: "Asia/Amman", flag: "🇯🇴", label: "Jordan", gmt: "UTC+3", code: "JO" },
  { value: "Asia/Kolkata", flag: "🇮🇳", label: "India", gmt: "UTC+5:30", code: "IN" },
  { value: "UTC", flag: "🌐", label: "Universal UTC", gmt: "+0:00", code: "UTC" },
];

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
  // Users State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("salesperson");
  const [newUserCompanyId, setNewUserCompanyId] = useState<string>("");
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
  const [adminCompanyTimezone, setAdminCompanyTimezone] = useState("Asia/Dubai");
  const [savingCompanyAdmin, setSavingCompanyAdmin] = useState(false);

  // Create Company Modal
  const [newCompanyModalOpen, setNewCompanyModalOpen] = useState(false);
  const [newCompanyNameInput, setNewCompanyNameInput] = useState("");
  const [newCompanyTimezoneInput, setNewCompanyTimezoneInput] = useState("Asia/Dubai");
  const [savingNewCompany, setSavingNewCompany] = useState(false);

  // Report Viewers State (Super Admin Only)
  const [reportUsers, setReportUsers] = useState<ReportUser[]>([]);
  const [reportUserSearch, setReportUserSearch] = useState("");
  const [reportUserModalOpen, setReportUserModalOpen] = useState(false);
  const [editingReportUser, setEditingReportUser] = useState<ReportUser | null>(null);
  const [reportUsername, setReportUsername] = useState("");
  const [reportDisplayName, setReportDisplayName] = useState("");
  const [reportPassword, setReportPassword] = useState("");
  const [reportUserCompanyId, setReportUserCompanyId] = useState<string>("");
  const [reportUserAllowedCamps, setReportUserAllowedCamps] = useState<string[]>([]);
  const [reportUserStatus, setReportUserStatus] = useState<number>(1);
  const [savingReportUser, setSavingReportUser] = useState(false);
  const [allCompaniesList, setAllCompaniesList] = useState<CompanyItem[]>([]);

  // Broadcast Notifications State (Super Admin Only)
  const [notifications, setNotifications] = useState<BroadcastNotification[]>([]);
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifType, setNotifType] = useState("info");
  const [notifTargetType, setNotifTargetType] = useState("ALL");
  const [notifCompanyId, setNotifCompanyId] = useState("");
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifSearch, setNotifSearch] = useState("");

  // Super Admins State (Root Access)
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [superAdminSearch, setSuperAdminSearch] = useState("");
  const [superAdminModalOpen, setSuperAdminModalOpen] = useState(false);
  const [editingSuperAdmin, setEditingSuperAdmin] = useState<SuperAdmin | null>(null);
  const [superUsername, setSuperUsername] = useState("");
  const [superDisplayName, setSuperDisplayName] = useState("");
  const [superPassword, setSuperPassword] = useState("");
  const [savingSuperAdmin, setSavingSuperAdmin] = useState(false);

  // Suspend / Pause Company Modal State
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [selectedCompanyToPause, setSelectedCompanyToPause] = useState<CompanyAdmin | null>(null);
  const [customSuspensionMessage, setCustomSuspensionMessage] = useState("");
  const [broadcastSuspensionNotif, setBroadcastSuspensionNotif] = useState(true);
  const [savingPauseStatus, setSavingPauseStatus] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, pricingRes, companiesRes, reportUsersRes, notifsRes, superAdminsRes] = await Promise.all([
        fetchMikrotikApi<{ users: AdminUser[] }>("/api/mikrotik/admin/users"),
        fetchMikrotikApi<{
          campPricing: CampPricing[];
          registeredCamps: string[];
          campsWithCompany?: CampWithCompany[];
          companies?: string[];
          companyObjects?: CompanyItem[];
          validityProfiles: string[];
        }>("/api/mikrotik/admin/pricing"),
        fetchMikrotikApi<{
          companies: CompanyItem[];
          companyAdmins: CompanyAdmin[];
        }>("/api/mikrotik/admin/companies").catch(() => ({ companies: [], companyAdmins: [] })),
        fetchMikrotikApi<{ reportUsers: ReportUser[] }>("/api/mikrotik/admin/report-users").catch(() => ({ reportUsers: [] })),
        fetchMikrotikApi<{ notifications: BroadcastNotification[] }>("/api/mikrotik/admin/notifications").catch(() => ({ notifications: [] })),
        fetchMikrotikApi<{ superAdmins: SuperAdmin[] }>("/api/mikrotik/admin/super-admins").catch(() => ({ superAdmins: [] })),
      ]);

      if (superAdminsRes.superAdmins) setSuperAdmins(superAdminsRes.superAdmins);

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
      const compItemsMap = new Map<number, CompanyItem>();

      if (pricingRes.companyObjects) {
        pricingRes.companyObjects.forEach((c) => {
          allCompanies.add(c.name);
          compItemsMap.set(c.id, c);
        });
      }
      if (pricingRes.companies) {
        pricingRes.companies.forEach((c) => allCompanies.add(c));
      }
      if (companiesRes.companies) {
        companiesRes.companies.forEach((c) => {
          allCompanies.add(c.name);
          compItemsMap.set(c.id, c);
        });
      }
      if (compItemsMap.size > 0) {
        setAllCompaniesList(Array.from(compItemsMap.values()));
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
      if (reportUsersRes.reportUsers) {
        setReportUsers(reportUsersRes.reportUsers);
      }
      if (notifsRes.notifications) {
        setNotifications(notifsRes.notifications);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, [activePricingCamp]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle salesperson router options filtered strictly by company ID
  const availableRoutersForSelectedCompany = campsWithCompany.filter((c) => {
    if (!newUserCompanyId) return false;
    const selectedComp = allCompaniesList.find((co) => String(co.id) === newUserCompanyId);
    if (!selectedComp) return false;
    if (c.companyId && Number(c.companyId) === Number(selectedComp.id)) return true;
    return Boolean(c.companyName && c.companyName.toLowerCase() === selectedComp.name.toLowerCase());
  });

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setNewUsername("");
    setNewDisplayName("");
    setNewPassword("");
    setNewUserRole("salesperson");
    setNewUserCompanyId("");
    setNewUserAllowedCamps([]);
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setNewUsername(user.username);
    setNewDisplayName(user.displayName || user.username);
    setNewPassword("");
    setNewUserRole(user.role);
    
    // Resolve companyId for select dropdown
    let matchedCompanyId = user.companyId ? String(user.companyId) : "";
    if (!matchedCompanyId && user.companyName) {
      const comp = allCompaniesList.find((c) => c.name.toLowerCase() === user.companyName.toLowerCase());
      if (comp) matchedCompanyId = String(comp.id);
    }
    setNewUserCompanyId(matchedCompanyId);

    // Store hardware router IDs in allowed camps
    const routerIds = (user.allowedCamps || []).map((campOrRouterId) => {
      const matched = campsWithCompany.find(
        (c) => c.campId?.toLowerCase() === campOrRouterId.toLowerCase() || c.name.toLowerCase() === campOrRouterId.toLowerCase()
      );
      return matched?.campId || campOrRouterId;
    });
    setNewUserAllowedCamps(routerIds);
    setUserModalOpen(true);
  };

  const toggleAllowedRouter = (routerId: string) => {
    setNewUserAllowedCamps((prev) => {
      const lower = routerId.toLowerCase();
      const exists = prev.some((c) => c.toLowerCase() === lower);
      if (exists) {
        return prev.filter((c) => c.toLowerCase() !== lower);
      } else {
        return [...prev, routerId];
      }
    });
  };

  // Handle Save or Update User
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      toast.error("Please enter login username");
      return;
    }
    if (!newDisplayName.trim()) {
      toast.error("Please enter a display name");
      return;
    }
    if (!newUserCompanyId || newUserCompanyId.trim() === "") {
      toast.error("Please select an assigned company for this salesperson");
      return;
    }
    if (!editingUser && !newPassword.trim()) {
      toast.error("Please enter a password");
      return;
    }

    setSavingUser(true);
    try {
      const selectedCompany = allCompaniesList.find((c) => String(c.id) === newUserCompanyId);
      const compId = selectedCompany ? selectedCompany.id : Number(newUserCompanyId);
      const compName = selectedCompany ? selectedCompany.name : undefined;

      const payload = {
        id: editingUser?.id,
        username: newUsername.trim(),
        displayName: newDisplayName.trim(),
        password: newPassword.trim() ? newPassword.trim() : undefined,
        role: newUserRole,
        companyId: compId,
        companyName: compName,
        allowedCamps: newUserAllowedCamps, // Router hardware IDs stored directly in allowedCamps
      };

      if (editingUser) {
        await fetchMikrotikApi("/api/mikrotik/admin/users", {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success(`Salesperson account updated to "${newDisplayName.trim()}"!`);
      } else {
        await fetchMikrotikApi("/api/mikrotik/admin/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success(`Salesperson "${newDisplayName.trim()}" created successfully!`);
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
    setAdminCompanyTimezone("Asia/Dubai");
    setCompanyAdminModalOpen(true);
  };

  const handleOpenEditCompanyAdmin = (admin: CompanyAdmin) => {
    setEditingCompanyAdmin(admin);
    setAdminUsername(admin.username);
    setAdminPassword("");
    setAdminCompany(admin.companyName);
    setAdminCompanyTimezone(admin.timezone || "Asia/Dubai");
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
          timezone: adminCompanyTimezone,
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

  const handleToggleCompanyStatus = async (admin: CompanyAdmin) => {
    if (!admin.companyId) {
      toast.error("Company ID not found for this account");
      return;
    }

    const currentStatus = admin.companyStatus !== undefined ? admin.companyStatus : 1;

    // If currently active -> Open Pause Modal with custom suspension message input
    if (currentStatus === 1) {
      setSelectedCompanyToPause(admin);
      setCustomSuspensionMessage(
        `Account for ${admin.companyName} is temporarily suspended due to outstanding subscription dues. All POS & recharge services are paused until resolved.`
      );
      setBroadcastSuspensionNotif(true);
      setPauseModalOpen(true);
      return;
    }

    // If currently paused -> Activate immediately
    if (
      !confirm(
        `Are you sure you want to ACTIVATE company "${admin.companyName}"?\n\nThis will immediately restore access for all field operators and re-enable voucher sales.`
      )
    ) {
      return;
    }

    try {
      const res = await fetchMikrotikApi<{ success: boolean; message: string; status: number }>(
        "/api/mikrotik/admin/companies",
        {
          method: "POST",
          body: JSON.stringify({
            action: "toggle_company_status",
            id: admin.companyId,
            status: 1,
            suspendedReason: null,
          }),
        }
      );

      // Broadcast optional activation notification
      try {
        await fetchMikrotikApi("/api/mikrotik/admin/notifications", {
          method: "POST",
          body: JSON.stringify({
            title: `Services Restored - ${admin.companyName}`,
            message: `Services for ${admin.companyName} have been reactivated. You can now resume voucher recharges and normal operations.`,
            type: "info",
            targetType: "COMPANY",
            companyId: admin.companyId,
            companyName: admin.companyName,
          }),
        });
      } catch {}

      toast.success(res.message || "Company activated successfully!");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to activate company");
    }
  };

  const handleConfirmPauseCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyToPause || !selectedCompanyToPause.companyId) return;

    if (!customSuspensionMessage.trim()) {
      toast.error("Please provide a suspension reason message");
      return;
    }

    setSavingPauseStatus(true);
    try {
      const res = await fetchMikrotikApi<{ success: boolean; message: string; status: number }>(
        "/api/mikrotik/admin/companies",
        {
          method: "POST",
          body: JSON.stringify({
            action: "toggle_company_status",
            id: selectedCompanyToPause.companyId,
            status: 0,
            suspendedReason: customSuspensionMessage.trim(),
          }),
        }
      );

      // Also broadcast urgent notification to operators if selected
      if (broadcastSuspensionNotif) {
        try {
          await fetchMikrotikApi("/api/mikrotik/admin/notifications", {
            method: "POST",
            body: JSON.stringify({
              title: `⚠️ Service Suspension Notice - ${selectedCompanyToPause.companyName}`,
              message: customSuspensionMessage.trim(),
              type: "urgent",
              targetType: "COMPANY",
              companyId: selectedCompanyToPause.companyId,
              companyName: selectedCompanyToPause.companyName,
            }),
          });
        } catch {}
      }

      toast.success(res.message || `Company "${selectedCompanyToPause.companyName}" paused.`);
      setPauseModalOpen(false);
      setSelectedCompanyToPause(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to pause company");
    } finally {
      setSavingPauseStatus(false);
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
          timezone: newCompanyTimezoneInput,
        }),
      });
      toast.success(`Company "${newCompanyNameInput.trim()}" created!`);
      setNewCompanyModalOpen(false);
      setNewCompanyNameInput("");
      setNewCompanyTimezoneInput("Asia/Dubai");
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

  // Report User Handlers (Super Admin only)
  const handleOpenAddReportUser = () => {
    setEditingReportUser(null);
    setReportUsername("");
    setReportDisplayName("");
    setReportPassword("");
    setReportUserCompanyId("");
    setReportUserAllowedCamps([]);
    setReportUserStatus(1);
    setReportUserModalOpen(true);
  };

  const handleOpenEditReportUser = (u: ReportUser) => {
    setEditingReportUser(u);
    setReportUsername(u.username);
    setReportDisplayName(u.displayName || u.username);
    setReportPassword("");
    setReportUserCompanyId(u.companyId ? String(u.companyId) : "");
    const routerIds = (u.allowedCampIds || []).map((campOrRouterId) => {
      const matched = campsWithCompany.find(
        (c) => c.campId?.toLowerCase() === campOrRouterId.toLowerCase() || c.name.toLowerCase() === campOrRouterId.toLowerCase()
      );
      return matched?.campId || campOrRouterId;
    });
    setReportUserAllowedCamps(routerIds);
    setReportUserStatus(u.status !== undefined ? u.status : 1);
    setReportUserModalOpen(true);
  };

  const handleSaveReportUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportUsername.trim()) {
      toast.error("Please enter a username");
      return;
    }
    if (!reportDisplayName.trim()) {
      toast.error("Please enter a display name");
      return;
    }
    if (!reportUserCompanyId || reportUserCompanyId.trim() === "") {
      toast.error("Please select an assigned company for this report viewer");
      return;
    }
    if (!editingReportUser && !reportPassword.trim()) {
      toast.error("Please enter a password for the new report viewer");
      return;
    }

    setSavingReportUser(true);
    try {
      const selectedCompany = allCompaniesList.find((c) => String(c.id) === reportUserCompanyId);
      const compId = selectedCompany ? selectedCompany.id : Number(reportUserCompanyId);

      await fetchMikrotikApi("/api/mikrotik/admin/report-users", {
        method: "POST",
        body: JSON.stringify({
          action: editingReportUser ? "update" : "create",
          id: editingReportUser?.id,
          username: reportUsername.trim(),
          displayName: reportDisplayName.trim() || reportUsername.trim(),
          password: reportPassword.trim() || undefined,
          companyId: compId,
          allowedCampIds: reportUserAllowedCamps,
          status: reportUserStatus,
        }),
      });

      toast.success(
        editingReportUser
          ? `Report viewer "${reportUsername}" updated!`
          : `Report viewer "${reportUsername}" created successfully!`
      );
      setReportUserModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save report viewer");
    } finally {
      setSavingReportUser(false);
    }
  };

  const handleDeleteReportUser = async (u: ReportUser) => {
    if (!confirm(`Are you sure you want to delete report viewer "${u.username}"?`)) {
      return;
    }

    try {
      await fetchMikrotikApi("/api/mikrotik/admin/report-users", {
        method: "POST",
        body: JSON.stringify({
          action: "delete",
          id: u.id,
        }),
      });
      toast.success(`Report viewer "${u.username}" deleted`);
      setReportUsers((prev) => prev.filter((item) => item.id !== u.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete report viewer");
    }
  };

  const toggleReportAllowedCamp = (campName: string) => {
    setReportUserAllowedCamps((prev) =>
      prev.includes(campName) ? prev.filter((c) => c !== campName) : [...prev, campName]
    );
  };

  // Routers available strictly for the selected company in Report Viewer modal (filtered by companyId)
  const availableRoutersForSelectedReportCompany = campsWithCompany.filter((c) => {
    if (!reportUserCompanyId) return false;
    const comp = allCompaniesList.find((co) => String(co.id) === reportUserCompanyId);
    if (!comp) return false;
    if (c.companyId && Number(c.companyId) === Number(comp.id)) return true;
    return Boolean(c.companyName && c.companyName.toLowerCase() === comp.name.toLowerCase());
  });

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

  const filteredReportUsers = reportUsers.filter((ru) => {
    const matchesSearch =
      ru.username.toLowerCase().includes(reportUserSearch.toLowerCase()) ||
      ru.displayName.toLowerCase().includes(reportUserSearch.toLowerCase()) ||
      (ru.companyName && ru.companyName.toLowerCase().includes(reportUserSearch.toLowerCase()));

    const matchesCompany =
      selectedCompanyFilter === "ALL" ||
      (ru.companyName && ru.companyName.toLowerCase() === selectedCompanyFilter.toLowerCase()) ||
      (!ru.companyId && selectedCompanyFilter === "ALL");

    return matchesSearch && matchesCompany;
  });

  // ── Broadcast Notification Handlers ──
  const handleOpenAddNotification = () => {
    setNotifTitle("");
    setNotifMessage("");
    setNotifType("info");
    setNotifTargetType("ALL");
    setNotifCompanyId(allCompaniesList.length > 0 ? String(allCompaniesList[0].id) : "");
    setNotifModalOpen(true);
  };

  const handleSaveNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim()) {
      toast.error("Please enter a notification title");
      return;
    }
    if (!notifMessage.trim()) {
      toast.error("Please enter the notification message");
      return;
    }
    if (notifTargetType === "COMPANY" && !notifCompanyId) {
      toast.error("Please select a target company");
      return;
    }

    setSavingNotif(true);
    try {
      const selectedCompany = allCompaniesList.find((c) => String(c.id) === notifCompanyId);
      const res = await fetchMikrotikApi<{ success: boolean; message: string; notification: BroadcastNotification }>(
        "/api/mikrotik/admin/notifications",
        {
          method: "POST",
          body: JSON.stringify({
            title: notifTitle.trim(),
            message: notifMessage.trim(),
            type: notifType,
            targetType: notifTargetType,
            companyId: notifTargetType === "COMPANY" ? Number(notifCompanyId) : null,
            companyName: notifTargetType === "COMPANY" ? selectedCompany?.name : null,
          }),
        }
      );

      toast.success(res.message || "Notification broadcasted successfully!");
      setNotifModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to broadcast notification");
    } finally {
      setSavingNotif(false);
    }
  };

  const handleDeleteNotification = async (notif: BroadcastNotification) => {
    if (!confirm(`Are you sure you want to delete broadcast "${notif.title}"?`)) {
      return;
    }

    try {
      await fetchMikrotikApi(`/api/mikrotik/admin/notifications?id=${notif.id}`, {
        method: "DELETE",
      });
      toast.success(`Notification "${notif.title}" deleted`);
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete notification");
    }
  };

  // ── Super Admin Handlers ──
  const handleOpenAddSuperAdmin = () => {
    setEditingSuperAdmin(null);
    setSuperUsername("");
    setSuperDisplayName("");
    setSuperPassword("");
    setSuperAdminModalOpen(true);
  };

  const handleOpenEditSuperAdmin = (admin: SuperAdmin) => {
    setEditingSuperAdmin(admin);
    setSuperUsername(admin.username);
    setSuperDisplayName(admin.displayName);
    setSuperPassword("");
    setSuperAdminModalOpen(true);
  };

  const handleSaveSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!superUsername.trim() || (!editingSuperAdmin && !superPassword.trim())) {
      toast.error("Username and password are required");
      return;
    }

    setSavingSuperAdmin(true);
    try {
      if (editingSuperAdmin) {
        await fetchMikrotikApi("/api/mikrotik/admin/super-admins", {
          method: "PUT",
          body: JSON.stringify({
            id: editingSuperAdmin.id,
            username: superUsername.trim(),
            displayName: superDisplayName.trim() || superUsername.trim(),
            password: superPassword.trim() || undefined,
          }),
        });
        toast.success(`Super Admin "${superUsername}" updated successfully!`);
      } else {
        await fetchMikrotikApi("/api/mikrotik/admin/super-admins", {
          method: "POST",
          body: JSON.stringify({
            username: superUsername.trim(),
            displayName: superDisplayName.trim() || superUsername.trim(),
            password: superPassword.trim(),
          }),
        });
        toast.success(`Super Admin "${superUsername}" created successfully!`);
      }

      setSuperAdminModalOpen(false);
      setEditingSuperAdmin(null);
      setSuperUsername("");
      setSuperDisplayName("");
      setSuperPassword("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save super administrator");
    } finally {
      setSavingSuperAdmin(false);
    }
  };

  const handleDeleteSuperAdmin = async (admin: SuperAdmin) => {
    if (superAdmins.length <= 1) {
      toast.error("Cannot delete the only remaining Super Administrator account.");
      return;
    }

    if (!confirm(`Are you sure you want to remove Super Administrator "${admin.displayName || admin.username}"?`)) {
      return;
    }

    try {
      await fetchMikrotikApi(`/api/mikrotik/admin/super-admins?id=${admin.id}`, {
        method: "DELETE",
      });
      toast.success(`Super Admin "${admin.username}" deleted`);
      setSuperAdmins((prev) => prev.filter((a) => a.id !== admin.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete super admin");
    }
  };

  const filteredSuperAdmins = superAdmins.filter(
    (a) =>
      a.username.toLowerCase().includes(superAdminSearch.toLowerCase()) ||
      a.displayName.toLowerCase().includes(superAdminSearch.toLowerCase())
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
        <TabsList className="bg-muted/80 p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="users" className="gap-2">
            <Users className="size-4" />
            Salespeople ({users.length})
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="size-4" />
            Company Accounts ({companyAdmins.length})
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2">
            <DollarSign className="size-4" />
            Pricing ({campPricing.length})
          </TabsTrigger>
          <TabsTrigger value="reports_users" className="gap-2">
            <BarChart3 className="size-4" />
            Report Viewers ({reportUsers.length})
          </TabsTrigger>
          <TabsTrigger value="super_admins" className="gap-2">
            <ShieldCheck className="size-4 text-amber-500" />
            Super Admins ({superAdmins.length})
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="size-4" />
            Notifications ({notifications.length})
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
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
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
                        {user.companyId || user.companyName ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                              <Briefcase className="size-3" />
                              {user.companyName || `Company #${user.companyId}`}
                            </span>
                            {user.companyId && (
                              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                ID: {user.companyId}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Global</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.allowedCamps && user.allowedCamps.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {Array.from(new Set(user.allowedCamps)).map((campOrId, idx) => {
                              const matchedRouter = campsWithCompany.find(
                                (r) => r.campId?.toLowerCase() === campOrId.toLowerCase() || r.name.toLowerCase() === campOrId.toLowerCase()
                              );
                              const label = matchedRouter ? `${matchedRouter.name}` : campOrId;
                              return (
                                <span
                                  key={`${campOrId}-${idx}`}
                                  title={campOrId}
                                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300"
                                >
                                  <Building2 className="size-3" />
                                  {label}
                                </span>
                              );
                            })}
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
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {user.createdAt ? user.createdAt.slice(0, 10) : "—"}
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
                  <TableHead>Company Name</TableHead>
                  <TableHead>Admin Username</TableHead>
                  <TableHead>Timezone</TableHead>
                  <TableHead>Status / Dues</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Created Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanyAdmins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      No company admin accounts found. Click &quot;Create Company Admin&quot; to provide login credentials to a client company.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanyAdmins.map((admin, idx) => {
                    const isActive = admin.companyStatus === undefined || admin.companyStatus === 1;

                    return (
                      <TableRow key={admin.id} className={!isActive ? "bg-red-500/5 dark:bg-red-950/20" : undefined}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                              <Briefcase className="size-3.5" />
                              {admin.companyName}
                            </span>
                            {admin.companyId ? (
                              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                ID: {admin.companyId}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                          {admin.username}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const opt = TIMEZONE_OPTIONS.find((t) => t.value === admin.timezone) || TIMEZONE_OPTIONS[0];
                            return (
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                                <span>{opt.flag}</span>
                                <span>{opt.label} ({opt.gmt})</span>
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="size-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                              <Pause className="size-3" />
                              Paused (Dues)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          ••••••••
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {admin.createdAt ? admin.createdAt.slice(0, 10) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Toggle Pause / Resume Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              className={`h-7 px-2 text-xs font-semibold gap-1 ${
                                isActive
                                  ? "border-amber-500/50 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
                                  : "border-emerald-500/50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                              }`}
                              title={isActive ? "Pause company operations (overdue dues)" : "Activate company operations"}
                              onClick={() => void handleToggleCompanyStatus(admin)}
                            >
                              {isActive ? (
                                <>
                                  <Pause className="size-3 text-amber-600" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="size-3 text-emerald-600" />
                                  Activate
                                </>
                              )}
                            </Button>
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
                    );
                  })
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
            {Array.from(
              new Set(
                selectedCompanyFilter === "ALL"
                  ? registeredCamps
                  : campsWithCompany
                      .filter((c) => !c.companyName || c.companyName.toLowerCase() === selectedCompanyFilter.toLowerCase())
                      .map((c) => c.name)
              )
            ).map((camp, idx) => (
              <button
                key={`${camp}-${idx}`}
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

        {/* ── TAB 4: REPORT VIEWERS MANAGEMENT (SUPER ADMIN ONLY) ── */}
        <TabsContent value="reports_users" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search report viewers..."
                value={reportUserSearch}
                onChange={(e) => setReportUserSearch(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
            <Button
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              onClick={handleOpenAddReportUser}
            >
              <UserPlus className="mr-2 size-4" />
              Add Report Viewer
            </Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Viewer Name</TableHead>
                  <TableHead>Username / ID</TableHead>
                  <TableHead>Assigned Company</TableHead>
                  <TableHead>Accessible Camps</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReportUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No report viewers found. Click &quot;Add Report Viewer&quot; to create login access for the Sales Report App.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReportUsers.map((u, idx) => (
                    <TableRow key={u.id}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <BarChart3 className="size-4 text-indigo-600 dark:text-indigo-400" />
                          <span>{u.displayName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono font-bold">
                            {u.username}
                          </code>
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1 py-0.5 rounded font-mono">
                            ID: {u.id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.companyName ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <Building2 className="size-3" />
                            {u.companyName}
                            {u.companyId && (
                              <span className="text-[10px] opacity-75 font-mono ml-0.5">
                                #{u.companyId}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            <Globe className="size-3" />
                            Global (All Companies)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!u.allowedCampIds || u.allowedCampIds.length === 0 ? (
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                            No Camps (0 Assigned)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {u.allowedCampIds.map((campOrRouterId) => {
                              const matched = campsWithCompany.find(
                                (r) => r.campId?.toLowerCase() === campOrRouterId.toLowerCase() || r.name.toLowerCase() === campOrRouterId.toLowerCase()
                              );
                              const label = matched ? matched.name : campOrRouterId;
                              return (
                                <span
                                  key={campOrRouterId}
                                  title={campOrRouterId}
                                  className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground border"
                                >
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.status === 1 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="size-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                            <XCircle className="size-3" />
                            Disabled
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                            onClick={() => handleOpenEditReportUser(u)}
                          >
                            <Key className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => void handleDeleteReportUser(u)}
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

        {/* ── TAB 5: BROADCAST NOTIFICATIONS ── */}
        <TabsContent value="notifications" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search notifications..."
                value={notifSearch}
                onChange={(e) => setNotifSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              onClick={handleOpenAddNotification}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-sm gap-2"
            >
              <Send className="size-4" />
              Broadcast Notification
            </Button>
          </div>

          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[140px]">Type / Priority</TableHead>
                  <TableHead className="min-w-[180px]">Title & Message</TableHead>
                  <TableHead className="w-[180px]">Target Audience</TableHead>
                  <TableHead className="w-[140px]">Created At</TableHead>
                  <TableHead className="w-[100px] text-center">Reads</TableHead>
                  <TableHead className="w-[70px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No broadcast notifications sent yet. Click &quot;Broadcast Notification&quot; to send an announcement to field operators.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredNotifications.map((notif) => {
                    const badgeClass =
                      notif.type === "urgent"
                        ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400"
                        : notif.type === "warning"
                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                        : notif.type === "maintenance"
                        ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400"
                        : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400";

                    return (
                      <TableRow key={notif.id} className="hover:bg-muted/30">
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badgeClass}`}
                          >
                            {notif.type === "urgent" && <AlertOctagon className="size-3" />}
                            {notif.type === "warning" && <AlertTriangle className="size-3" />}
                            {notif.type === "maintenance" && <Wrench className="size-3" />}
                            {notif.type === "info" && <Info className="size-3" />}
                            {notif.type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-sm text-foreground">{notif.title}</div>
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-2 mt-0.5">
                            {notif.message}
                          </div>
                        </TableCell>
                        <TableCell>
                          {notif.targetType === "ALL" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-1 rounded-md">
                              <Globe className="size-3" />
                              All Companies (Global)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 px-2.5 py-1 rounded-md">
                              <Building2 className="size-3" />
                              {notif.companyName || `Company #${notif.companyId}`}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(notif.createdAt).toLocaleDateString()}
                          <div className="text-[10px] text-muted-foreground/70">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded-full text-foreground">
                            {notif.readCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => void handleDeleteNotification(notif)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        {/* ── TAB 5: SUPER ADMINISTRATORS (ROOT ACCESS) ── */}
        <TabsContent value="super_admins" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search super admins..."
                value={superAdminSearch}
                onChange={(e) => setSuperAdminSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={handleOpenAddSuperAdmin} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white gap-2">
              <ShieldCheck className="size-4" />
              Add Super Admin
            </Button>
          </div>

          <div className="rounded-md border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role / Access</TableHead>
                  <TableHead>Created Date</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuperAdmins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No Super Administrators found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuperAdmins.map((admin) => (
                    <TableRow key={admin.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{admin.id}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground flex items-center gap-2">
                        <div className="size-8 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center font-bold text-xs">
                          {admin.displayName ? admin.displayName.charAt(0).toUpperCase() : "A"}
                        </div>
                        {admin.displayName}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {admin.username}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400">
                          <ShieldCheck className="size-3" />
                          Global Super Admin
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : "Master"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleOpenEditSuperAdmin(admin)}
                            title="Edit / Reset Password"
                          >
                            <Key className="size-4 text-blue-600" />
                          </Button>
                          {superAdmins.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => void handleDeleteSuperAdmin(admin)}
                              title="Delete Super Admin"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
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

      {/* ── MODAL: ADD / EDIT SUPER ADMIN ── */}
      <Dialog open={superAdminModalOpen} onOpenChange={setSuperAdminModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveSuperAdmin}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <ShieldCheck className="size-5" />
                {editingSuperAdmin ? `Edit Super Admin (${editingSuperAdmin.username})` : "Add Super Administrator"}
              </DialogTitle>
              <DialogDescription>
                Super Administrators have full unrestricted access to all company accounts, routers, sales, and system settings.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="superUsername">Username *</Label>
                <Input
                  id="superUsername"
                  placeholder="e.g. rifayi_admin"
                  value={superUsername}
                  onChange={(e) => setSuperUsername(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="superDisplayName">Display Name *</Label>
                <Input
                  id="superDisplayName"
                  placeholder="e.g. Rifayi (System Owner)"
                  value={superDisplayName}
                  onChange={(e) => setSuperDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="superPassword">
                  {editingSuperAdmin ? "New Password (Leave empty to keep current)" : "Login Password *"}
                </Label>
                <Input
                  id="superPassword"
                  type="password"
                  placeholder={editingSuperAdmin ? "Enter new password" : "Enter strong password"}
                  value={superPassword}
                  onChange={(e) => setSuperPassword(e.target.value)}
                  required={!editingSuperAdmin}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSuperAdminModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingSuperAdmin} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
                <ShieldCheck className="size-4" />
                {savingSuperAdmin ? "Saving..." : editingSuperAdmin ? "Update Super Admin" : "Create Super Admin"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: ADD / EDIT SALESPEOPLE ── */}
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
                  <Label htmlFor="displayName">Display Name *</Label>
                  <Input
                    id="displayName"
                    placeholder="e.g. Fasil or Akif"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    required
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

              <div className="space-y-1.5">
                <Label htmlFor="companySelect">Assigned Company <span className="text-red-500">*</span></Label>
                <Select
                  value={newUserCompanyId || ""}
                  onValueChange={(v: string | null) => {
                    const selectedCompId = !v || v === "NONE" ? "" : v;
                    setNewUserCompanyId(selectedCompId);
                    setNewUserAllowedCamps([]); // Clear previously selected camps when company changes
                  }}
                >
                  <SelectTrigger id="companySelect">
                    <SelectValue placeholder="Select assigned company" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCompaniesList.map((comp) => (
                      <SelectItem key={comp.id} value={String(comp.id)}>
                        {comp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Granular Camp Access Checkboxes */}
              <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Authorized Routers / Camps ({newUserAllowedCamps.length} selected)
                  </Label>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setNewUserAllowedCamps(availableRoutersForSelectedCompany.map((r) => r.campId || r.name))}
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
                  The mobile app will restrict this sales agent to only view and recharge for these specific router hardware IDs.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 max-h-40 overflow-y-auto">
                  {!newUserCompanyId ? (
                    <div className="col-span-2 text-xs text-muted-foreground py-3 text-center border border-dashed rounded-md">
                      👈 Please select a company above to view and assign its routers.
                    </div>
                  ) : availableRoutersForSelectedCompany.length === 0 ? (
                    <div className="col-span-2 text-xs text-muted-foreground py-3 text-center border border-dashed rounded-md">
                      No routers are registered under this company.
                    </div>
                  ) : (
                    availableRoutersForSelectedCompany.map((router) => {
                      const routerId = router.campId || router.name;
                      const isChecked = newUserAllowedCamps.some(
                        (c) => c.toLowerCase() === routerId.toLowerCase() || c.toLowerCase() === router.name.toLowerCase()
                      );
                      return (
                        <div
                          key={routerId}
                          onClick={() => toggleAllowedRouter(routerId)}
                          className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer select-none transition-all ${
                            isChecked
                              ? "bg-blue-50 border-blue-300 text-blue-900 font-semibold dark:bg-blue-950/50 dark:border-blue-700 dark:text-blue-200"
                              : "bg-card border-border text-slate-700 dark:text-slate-300 hover:bg-muted"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Handled by parent div onClick
                            className="size-4 rounded border-gray-300 text-[#4A60D6] pointer-events-none"
                          />
                          <Building2 className="size-3.5 text-muted-foreground flex-shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-medium">{router.name}</span>
                            <span className="text-[10px] text-muted-foreground truncate font-mono">{routerId}</span>
                          </div>
                        </div>
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

              <div className="space-y-1.5">
                <Label htmlFor="adminCompanyTimezone">Company Timezone</Label>
                <Select value={adminCompanyTimezone} onValueChange={(v) => v && setAdminCompanyTimezone(v)}>
                  <SelectTrigger id="adminCompanyTimezone" className="w-full">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        <span className="text-base mr-1">{tz.flag}</span>
                        <span className="font-medium">{tz.label}</span>
                        <span className="text-muted-foreground text-xs ml-auto">({tz.gmt})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Sales records and vouchers will be grouped according to this timezone.
                </p>
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

      {/* ── MODAL: ADD / EDIT REPORT VIEWER ── */}
      <Dialog open={reportUserModalOpen} onOpenChange={setReportUserModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveReportUser}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="size-5 text-indigo-600" />
                {editingReportUser ? `Edit Report Viewer (${editingReportUser.username})` : "Add Sales Report Viewer"}
              </DialogTitle>
              <DialogDescription>
                {editingReportUser
                  ? "Update login credentials, company restriction, and allowed camps for this Sales Report App viewer."
                  : "Create login credentials to allow a manager or auditor to access the Sales Report App."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="repUsername">Username *</Label>
                  <Input
                    id="repUsername"
                    placeholder="e.g. ahmed_reports"
                    value={reportUsername}
                    onChange={(e) => setReportUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="repDisplayName">Display Name / Title *</Label>
                  <Input
                    id="repDisplayName"
                    placeholder="e.g. Ahmed (Finance Manager)"
                    value={reportDisplayName}
                    onChange={(e) => setReportDisplayName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="repPassword">
                  {editingReportUser ? "New Password (Leave empty to keep current)" : "Login Password *"}
                </Label>
                <Input
                  id="repPassword"
                  type="password"
                  placeholder={editingReportUser ? "Enter new password" : "Enter secure login password"}
                  value={reportPassword}
                  onChange={(e) => setReportPassword(e.target.value)}
                  required={!editingReportUser}
                />
              </div>

              {/* Company Selection by ID */}
              <div className="space-y-1.5">
                <Label htmlFor="repCompanySelect">Assigned Company *</Label>
                <Select
                  value={reportUserCompanyId || "NONE"}
                  onValueChange={(v: string | null) => {
                    const sel = !v || v === "NONE" ? "" : v;
                    setReportUserCompanyId(sel);
                    setReportUserAllowedCamps([]); // Reset allowed camps on company switch
                  }}
                >
                  <SelectTrigger id="repCompanySelect">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">-- Select Company --</SelectItem>
                    {allCompaniesList.map((comp) => (
                      <SelectItem key={comp.id} value={String(comp.id)}>
                        <span className="font-medium">{comp.name}</span>
                        <span className="text-muted-foreground text-xs ml-2 font-mono">ID: #{comp.id}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  The Sales Report App will filter analytics strictly according to this company ID.
                </p>
              </div>

              {/* Granular Camp Checkboxes */}
              <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Allowed Routers / Camps ({reportUserAllowedCamps.length} of {availableRoutersForSelectedReportCompany.length} selected)
                  </Label>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      disabled={!reportUserCompanyId || availableRoutersForSelectedReportCompany.length === 0}
                      onClick={() => setReportUserAllowedCamps(availableRoutersForSelectedReportCompany.map((r) => r.campId || r.name))}
                      className="text-indigo-600 hover:underline font-medium disabled:opacity-50"
                    >
                      Select All
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      disabled={!reportUserCompanyId || reportUserAllowedCamps.length === 0}
                      onClick={() => setReportUserAllowedCamps([])}
                      className="text-muted-foreground hover:underline disabled:opacity-50"
                    >
                      Clear (0 Selected)
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select the specific router camps this viewer is allowed to view in the Sales Report App. If none are selected, they will have access to <strong>0 camps</strong>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 max-h-40 overflow-y-auto">
                  {!reportUserCompanyId ? (
                    <div className="col-span-2 text-xs text-muted-foreground py-3 text-center border border-dashed rounded-md">
                      👈 Please select a company above to view and assign its router camps.
                    </div>
                  ) : availableRoutersForSelectedReportCompany.length === 0 ? (
                    <div className="col-span-2 text-xs text-muted-foreground py-3 text-center border border-dashed rounded-md">
                      No routers registered under this company yet.
                    </div>
                  ) : (
                    availableRoutersForSelectedReportCompany.map((routerItem) => {
                      const routerId = routerItem.campId || routerItem.name;
                      const isChecked = reportUserAllowedCamps.some(
                        (c) => c.toLowerCase() === routerId.toLowerCase() || c.toLowerCase() === routerItem.name.toLowerCase()
                      );
                      return (
                        <div
                          key={routerId}
                          onClick={() => {
                            setReportUserAllowedCamps((prev) => {
                              const lower = routerId.toLowerCase();
                              const exists = prev.some((c) => c.toLowerCase() === lower);
                              if (exists) {
                                return prev.filter((c) => c.toLowerCase() !== lower);
                              } else {
                                return [...prev, routerId];
                              }
                            });
                          }}
                          className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer select-none transition-all ${
                            isChecked
                              ? "bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold dark:bg-indigo-950/50 dark:border-indigo-700 dark:text-indigo-200"
                              : "bg-card border-border text-slate-700 dark:text-slate-300 hover:bg-muted"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="size-4 rounded border-gray-300 text-indigo-600 pointer-events-none"
                          />
                          <Building2 className="size-3.5 text-muted-foreground" />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate">{routerItem.name}</span>
                            {routerItem.campId && (
                              <span className="text-[10px] text-muted-foreground font-mono truncate">
                                {routerItem.campId}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Status Toggle */}
              <div className="space-y-1.5">
                <Label htmlFor="repStatus">Account Status</Label>
                <Select
                  value={String(reportUserStatus)}
                  onValueChange={(v) => v && setReportUserStatus(Number(v))}
                >
                  <SelectTrigger id="repStatus">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">
                      <span className="text-emerald-600 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5" />
                        Active (Can Login)
                      </span>
                    </SelectItem>
                    <SelectItem value="0">
                      <span className="text-slate-500 font-medium flex items-center gap-1.5">
                        <XCircle className="size-3.5" />
                        Disabled (Login Blocked)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReportUserModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingReportUser} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {savingReportUser ? "Saving..." : editingReportUser ? "Update Viewer" : "Create Report Viewer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: BROADCAST NOTIFICATION ── */}
      <Dialog open={notifModalOpen} onOpenChange={setNotifModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveNotification}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="size-5 text-blue-600" />
                Broadcast Notification
              </DialogTitle>
              <DialogDescription>
                Send real-time operational notifications, maintenance warnings, or announcements to field operators.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Target Audience (All Companies vs Specific Company) */}
              <div className="space-y-1.5">
                <Label htmlFor="targetTypeSelect">Target Audience *</Label>
                <Select
                  value={notifTargetType}
                  onValueChange={(v) => v && setNotifTargetType(v)}
                >
                  <SelectTrigger id="targetTypeSelect">
                    <SelectValue placeholder="Select target audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <Globe className="size-3.5" />
                        All Companies (All Field Operators)
                      </span>
                    </SelectItem>
                    <SelectItem value="COMPANY">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                        <Building2 className="size-3.5" />
                        Selected Company Only
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Company Picker (if target is COMPANY) */}
              {notifTargetType === "COMPANY" && (
                <div className="space-y-1.5 rounded-lg border p-3 bg-muted/30 animate-in fade-in-50">
                  <Label htmlFor="notifCompanySelect">Select Target Company *</Label>
                  <Select
                    value={notifCompanyId}
                    onValueChange={(v) => v && setNotifCompanyId(v)}
                  >
                    <SelectTrigger id="notifCompanySelect">
                      <SelectValue placeholder="Select target company" />
                    </SelectTrigger>
                    <SelectContent>
                      {allCompaniesList.map((comp) => (
                        <SelectItem key={comp.id} value={String(comp.id)}>
                          <span className="font-medium">{comp.name}</span>
                          <span className="text-muted-foreground text-xs ml-2 font-mono">ID: #{comp.id}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Only operators belonging to this company will receive this notification.
                  </p>
                </div>
              )}

              {/* Priority / Type */}
              <div className="space-y-1.5">
                <Label htmlFor="notifTypeSelect">Notification Type / Urgency</Label>
                <Select value={notifType} onValueChange={(v) => v && setNotifType(v)}>
                  <SelectTrigger id="notifTypeSelect">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">
                      <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                        <Info className="size-3.5" />
                        Info (General Announcement)
                      </span>
                    </SelectItem>
                    <SelectItem value="warning">
                      <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                        <AlertTriangle className="size-3.5" />
                        Warning (Important Notice)
                      </span>
                    </SelectItem>
                    <SelectItem value="urgent">
                      <span className="flex items-center gap-1.5 text-red-600 font-medium">
                        <AlertOctagon className="size-3.5" />
                        Urgent (Critical Alert)
                      </span>
                    </SelectItem>
                    <SelectItem value="maintenance">
                      <span className="flex items-center gap-1.5 text-purple-600 font-medium">
                        <Wrench className="size-3.5" />
                        Maintenance (Scheduled Outage)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="notifTitle">Title / Headline *</Label>
                <Input
                  id="notifTitle"
                  placeholder="e.g. Scheduled Network Maintenance or Price Update Notice"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  required
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="notifMessage">Message Content *</Label>
                <textarea
                  id="notifMessage"
                  rows={4}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Write the notification details for the mobile operators..."
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNotifModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingNotif} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                <Send className="size-3.5" />
                {savingNotif ? "Broadcasting..." : "Broadcast Message"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: PAUSE / SUSPEND COMPANY ── */}
      <Dialog open={pauseModalOpen} onOpenChange={setPauseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleConfirmPauseCompany}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertOctagon className="size-5" />
                Pause Company Operations
              </DialogTitle>
              <DialogDescription>
                Suspends services for <strong className="text-foreground">{selectedCompanyToPause?.companyName}</strong>. 
                Sales operators will be blocked from logging in or recharging vouchers.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="customSuspensionMessage">Custom Suspension / Dues Message *</Label>
                <textarea
                  id="customSuspensionMessage"
                  rows={4}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="e.g. Account suspended due to pending invoice #1049. Please contact management."
                  value={customSuspensionMessage}
                  onChange={(e) => setCustomSuspensionMessage(e.target.value)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  This custom message will appear when operators attempt to log in or sell vouchers.
                </p>
              </div>

              <div className="flex items-center space-x-2 rounded-lg border p-3 bg-muted/40">
                <input
                  type="checkbox"
                  id="broadcastCheckbox"
                  checked={broadcastSuspensionNotif}
                  onChange={(e) => setBroadcastSuspensionNotif(e.target.checked)}
                  className="size-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="broadcastCheckbox" className="text-xs font-medium cursor-pointer leading-none">
                  Also broadcast as an <strong>Urgent Alert</strong> to field operators of this company
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPauseModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingPauseStatus} className="bg-red-600 hover:bg-red-700 text-white gap-2">
                <Pause className="size-3.5" />
                {savingPauseStatus ? "Pausing..." : "Confirm & Pause Company"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
