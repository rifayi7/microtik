import {
  Activity,
  BarChart3,
  CreditCard,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Router,
  Settings,
  Ticket,
  Users,
  Wifi,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const mainNavigation: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard },
      { title: "Active Sessions", href: "/sessions", icon: Wifi, badge: "live" },
    ],
  },
  {
    label: "Network",
    items: [
      { title: "Routers & Camps", href: "/routers", icon: Router },
      { title: "Bandwidth Plans", href: "/plans", icon: Gauge },
    ],
  },
  {
    label: "Users",
    items: [
      { title: "Hotspot Users", href: "/users", icon: Users },
      { title: "User Profiles", href: "/profiles", icon: FileText },
      { title: "Vouchers", href: "/vouchers", icon: Ticket },
    ],
  },
  {
    label: "Business",
    items: [
      { title: "Payments", href: "/payments", icon: CreditCard },
      { title: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Activity Logs", href: "/logs", icon: Activity },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const settingsNavigation: NavItem[] = [
  { title: "General", href: "/settings", icon: Settings },
  { title: "Template Editor", href: "/settings/templates", icon: FileText },
];

export const footerNavigation: NavItem[] = [
  { title: "Sign out", href: "/login", icon: LogOut },
];
