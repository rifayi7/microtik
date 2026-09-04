"use client";

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
        localStorage.setItem("is_logged_in", "true");
        localStorage.setItem("admin_user_role", response.user.role);
        localStorage.setItem("admin_user_name", response.user.username);
        localStorage.setItem("admin_company_name", response.user.companyName || "");
        localStorage.setItem(
          "admin_allowed_camps",
          JSON.stringify(response.user.allowedCamps || [])
        );

        const activeRouterId = localStorage.getItem("hotspot-pro-active-router");
        if (activeRouterId) {
          router.push("/dashboard");
        } else {
          router.push("/settings/routers");
        }
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
      <div className="hidden lg:flex flex-col justify-between bg-primary p-12 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary-foreground/10">
            <Wifi className="size-5" />
          </div>
          <span className="text-xl font-semibold">{APP_NAME}</span>
        </div>
        <p className="text-sm text-primary-foreground/60">
          Multi-Tenant Cloud Ecosystem · Routers · Vouchers · Live Sessions · Sales
        </p>
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
