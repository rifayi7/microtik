export const APP_NAME = "HotSpot Pro";
export const APP_DESCRIPTION =
  "Professional MikroTik hotspot management for network operators";

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
