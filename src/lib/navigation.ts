import {
  FileText,
  Info,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export const setupNavigation: NavItem[] = [
  { title: "Settings", href: "/settings/routers", icon: Settings },
  { title: "Admin Hub", href: "/admin", icon: ShieldCheck },
  { title: "Template Editor", href: "/settings/templates", icon: FileText },
  { title: "About", href: "/settings/about", icon: Info },
];

export const connectedNavigation: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Hotspot", href: "/hotspot/users", icon: Wifi },
  { title: "Log", href: "/hotspot/logs", icon: ScrollText },
  { title: "Report", href: "/reports", icon: ScrollText },
  { title: "Admin Hub", href: "/admin", icon: ShieldCheck },
  { title: "Settings", href: "/settings/routers", icon: Settings },
];

export const footerNavigation: NavItem[] = [
  { title: "Sign out", href: "/login", icon: LogOut },
];
