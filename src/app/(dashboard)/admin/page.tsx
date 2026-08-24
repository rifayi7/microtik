import { AdminClient } from "@/components/admin/admin-client";

export const metadata = {
  title: "Admin Hub | MikroTik Hotspot Manager",
  description: "Manage Salespeople accounts, Camp custom pricing, and operator permissions.",
};

export default function AdminPage() {
  return <AdminClient />;
}
