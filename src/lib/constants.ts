export const APP_NAME = "My WiFi";
export const APP_DESCRIPTION =
  "MikroTik hotspot management for network operators";

export const CHARACTER_OPTIONS = [
  { value: "1234", label: "1234" },
  { value: "abcd", label: "abcd" },
  { value: "ABCD", label: "ABCD" },
  { value: "aBcD", label: "aBcD" },
  { value: "5ab2c34d", label: "5ab2c34d" },
  { value: "5AB2C34D", label: "5AB2C34D" },
  { value: "5aB2c34D", label: "5aB2c34D" },
] as const;

export const CHARACTER_SETS: Record<string, string> = {
  "1234": "1234567890",
  abcd: "abcdefghijklmnopqrstuvwxyz",
  ABCD: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  aBcD: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "5ab2c34d": "23456789abcdefghijkmnpqrstuvwxyz",
  "5AB2C34D": "23456789ABCDEFGHJKLMNPQRSTUVWXYZ",
  "5aB2c34D": "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ",
};

export const TEMPLATE_VARIABLES = [
  { name: "username", description: "Hotspot username" },
  { name: "password", description: "Hotspot password" },
  { name: "validity", description: "Account validity period" },
  { name: "limitUptime", description: "Maximum session uptime" },
  { name: "limitBytesTotal", description: "Total data transfer limit" },
  { name: "dnsName", description: "Hotspot DNS name" },
  { name: "price", description: "Plan price with currency" },
  { name: "profile", description: "User profile name" },
  { name: "qrCode", description: "QR code for login URL" },
] as const;

export const DEFAULT_TEMPLATE_ROW = `<tr>
  <td style="font-size: 10px;">
    User: %username%<br/>
    Pass: %password%<br/>
    Valid: %validity%<br/>
    Uptime: %limitUptime%<br/>
    Data: %limitBytesTotal%<br/>
    DNS: %dnsName%
  </td>
</tr>
<script>
if("%username%" == "%password%") {
  // Single-field voucher layout
}
</script>`;

export const DEFAULT_TEMPLATE_HEADER = `<table width="100%" cellpadding="4" cellspacing="0">
  <thead>
    <tr>
      <th style="font-size: 12px; text-align: left;">HotSpot Voucher</th>
    </tr>
  </thead>
  <tbody>`;

export const DEFAULT_TEMPLATE_FOOTER = `  </tbody>
</table>`;

export const ROUTER_HELP = {
  sessionName:
    "Use a single word without special characters. This identifies the router session.",
  ipAddress: "MikroTik router IP address accessible from this server.",
  dnsName:
    "Find in Winbox: IP → Hotspot → Server Profile → DNS Name field.",
  sessionTimeout:
    "Maximum duration a user can stay connected in one session.",
  idleTimeout:
    "Time of inactivity before the user is automatically logged out.",
  liveReport: "Enable real-time session reporting from this router.",
} as const;
