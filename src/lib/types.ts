export type ConnectionStatus = "online" | "offline" | "unknown" | "connecting";

export interface Router {
  id: string;
  sessionName: string;
  hotspotName: string;
  ipAddress: string;
  port?: number;
  username: string;
  password: string;
  dnsName: string;
  currency: string;
  sessionTimeout: string;
  liveReport: boolean;
  phone: string;
  logoUrl?: string;
  status: ConnectionStatus;
  lastConnected?: string;
  activeUsers: number;
  camp?: string;
  verified?: boolean;
}

export interface HotspotUser {
  id: string;
  username: string;
  profile: string;
  routerId: string;
  routerName: string;
  status: "active" | "disabled" | "expired";
  uptime: string;
  dataUsed: string;
  dataLimit: string;
  expiresAt: string;
  createdAt: string;
  server?: string;
  macAddress?: string;
  bytesIn?: string;
  bytesOut?: string;
  comment?: string;
  voucherStatus?: "available" | "redeemed" | "disabled" | "expired";
  soldBy?: string;
  usedBy?: string;
  usedAt?: string;
  priceCharged?: number;
}

export interface HotspotHost {
  id: string;
  macAddress: string;
  address: string;
  server: string;
  uptime: string;
}

export interface HotspotLogEntry {
  id: string;
  time: string;
  user: string;
  message: string;
}

export interface RouterResource {
  cpuLoad: string;
  cpuCount: string;
  cpuFrequency: string;
  memoryUsed: string;
  memoryTotal: string;
  memoryPercent: number;
  hddUsed: string;
  hddTotal: string;
  hddPercent: number;
  uptime: string;
  version: string;
  boardName: string;
  identity: string;
}

export interface ConnectedDashboardData {
  resource: RouterResource;
  activeSessions: number;
  totalUsers: number;
  incomeToday: number;
  incomeMonth: number;
  currency: string;
  appLogs: string[];
  hotspotLogs: HotspotLogEntry[];
  sessions: ActiveSession[];
}

export interface ActiveSession {
  id: string;
  username: string;
  routerId: string;
  routerName: string;
  ipAddress: string;
  macAddress: string;
  uptime: string;
  download: string;
  upload: string;
  profile: string;
}

export interface UserProfile {
  id: string;
  name: string;
  sharedUsers: number;
  rateLimit: string;
  sessionTimeout: string;
  idleTimeout: string;
  validity: string;
  price: number;
  currency: string;
  routerCount: number;
}

export interface Voucher {
  id: string;
  code: string;
  profile: string;
  routerName: string;
  status: "unused" | "used" | "expired";
  createdAt: string;
  usedAt?: string;
  batchId: string;
}

export interface BandwidthPlan {
  id: string;
  name: string;
  downloadSpeed: string;
  uploadSpeed: string;
  burstLimit?: string;
  priority: number;
  routerCount: number;
}

export interface Payment {
  id: string;
  user: string;
  amount: number;
  currency: string;
  method: "cash" | "card" | "transfer" | "voucher";
  status: "completed" | "pending" | "failed" | "refunded";
  routerName: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  user: string;
  target: string;
  routerName?: string;
  ipAddress: string;
  timestamp: string;
  severity: "info" | "warning" | "error" | "success";
}

export interface DashboardStats {
  totalRouters: number;
  onlineRouters: number;
  activeSessions: number;
  totalUsers: number;
  revenueToday: number;
  revenueMonth: number;
  vouchersGenerated: number;
  dataTransferred: string;
}

export type TemplatePart = "header" | "row" | "footer";

export interface TemplateSet {
  id: string;
  name: string;
  header: string;
  row: string;
  footer: string;
}
