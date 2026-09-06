"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchMikrotikApi } from "@/lib/api/client";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const username = (formData.get("username") as string)?.trim();
    const password = formData.get("password") as string;

    try {
      const response = await fetchMikrotikApi<{
        success: boolean;
        token?: string;
        user?: {
          id: number;
          username: string;
          displayName: string;
          role: string;
          companyName: string | null;
          allowedCamps: string[];
        };
        error?: string;
      }>("/api/mikrotik/auth/admin-login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (response.success && response.user) {
        toast.success(`Welcome back, ${response.user.displayName}!`);
        if (response.token) {
          localStorage.setItem("auth_token", response.token);
        }
        localStorage.setItem("is_logged_in", "true");
        localStorage.setItem("admin_user_role", response.user.role);
        localStorage.setItem("admin_user_name", response.user.username);
        localStorage.setItem("admin_company_name", response.user.companyName || "");
        localStorage.setItem(
          "admin_allowed_camps",
          JSON.stringify(response.user.allowedCamps || [])
        );
        // Clear cached routers and active router from previous session/company
        localStorage.removeItem("hotspot-pro-routers");
        localStorage.removeItem("hotspot-pro-active-router");

        window.location.href = "/settings/routers";
      } else {
        setError(response.error || "Invalid username or password");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to authentication service");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── LEFT HERO PANEL: LinkFi Brand Visual ── */}
      <div className="hidden lg:flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-12 text-white relative overflow-hidden">
        {/* Subtle background glow effect */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Center: LinkFi Logo and MicroTik Hotspot Manager */}
        <div className="flex flex-col items-center justify-center text-center z-10 space-y-6">
          <div className="relative group p-4 rounded-3xl bg-white shadow-2xl shadow-cyan-500/10 border border-white/20 transition-transform duration-300 hover:scale-105">
            <Image
              src="/linkfi-logo.png"
              alt="LinkFi"
              width={340}
              height={340}
              priority
              className="rounded-2xl object-contain"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">MicroTik Hotspot Manager</h2>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 lg:hidden mb-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Wifi className="size-4" />
              </div>
              <span className="font-semibold">{APP_NAME}</span>
            </div>
            <CardTitle className="text-2xl">Admin & Company Sign in</CardTitle>
            <CardDescription>
              Sign in with Super Administrator or Company Account credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="e.g. admin or company_admin"
                  required
                  autoComplete="username"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="remember" />
                <Label htmlFor="remember" className="text-sm font-normal">
                  Remember me for 30 days
                </Label>
              </div>
              <Button type="submit" className="w-full bg-[#4A60D6] hover:bg-[#3b50c0]" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
