"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Wifi,
  ShieldCheck,
  Sliders,
  Smartphone,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchMikrotikApi } from "@/lib/api/client";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f4f7fe] via-[#edf2fc] to-[#f8faff] relative flex items-center justify-center p-4 sm:p-6 md:p-10 lg:p-14 overflow-hidden">
      {/* ── Background Ambient Light Accents ── */}
      <div className="absolute -top-36 -left-36 w-96 h-96 bg-blue-400/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-28 -right-28 w-96 h-96 bg-indigo-300/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-36 -left-36 w-96 h-96 bg-purple-300/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -right-28 w-96 h-96 bg-sky-300/20 rounded-full blur-3xl pointer-events-none" />

      {/* ── Main Responsive Container ── */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center z-10 py-6">
        {/* ── LEFT HERO PANEL: LinkFi Brand & Features ── */}
        <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6 lg:pr-6">
          {/* Brand Emblem (Free floating with no enclosing box/border) */}
          <div className="relative transition-transform duration-300 hover:scale-105">
            <Image
              src="/linkfi-emblem.png"
              alt="LinkFi"
              width={130}
              height={120}
              priority
              className="object-contain drop-shadow-md"
            />
          </div>

          {/* Slogan */}
          <div className="flex items-center gap-1.5 text-sm sm:text-base font-semibold tracking-wide">
            <span className="text-cyan-500 font-bold">WiFi.</span>
            <span className="text-slate-700 font-bold">Simple.</span>
            <span className="text-indigo-600 font-bold">Smart.</span>
            <span className="text-blue-600 font-bold">Secure.</span>
          </div>

          {/* Title & Description */}
          <div className="space-y-2">
            <p className="text-xs sm:text-sm font-bold tracking-widest text-slate-400 uppercase">
              WELCOME TO
            </p>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
              LinkFi{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Admin
              </span>
            </h1>
            <p className="text-slate-500 text-sm sm:text-base max-w-md pt-1">
              Manage your Wi-Fi network easily and securely.
            </p>
          </div>

          {/* 4 Feature Badges Structured in Unified Card */}
          <div className="w-full max-w-lg pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-white/80 backdrop-blur-xs border border-slate-200/80 shadow-xs">
              {/* Feature 1 */}
              <div className="flex flex-col items-center text-center space-y-2 group">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center ring-1 ring-blue-100 shadow-xs transition-transform group-hover:scale-110">
                  <Wifi className="size-5" />
                </div>
                <span className="text-xs font-semibold text-slate-700 leading-tight">
                  Fast<br />Connection
                </span>
              </div>

              {/* Feature 2 */}
              <div className="flex flex-col items-center text-center space-y-2 group">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-100 shadow-xs transition-transform group-hover:scale-110">
                  <ShieldCheck className="size-5" />
                </div>
                <span className="text-xs font-semibold text-slate-700 leading-tight">
                  Secure<br />Access
                </span>
              </div>

              {/* Feature 3 */}
              <div className="flex flex-col items-center text-center space-y-2 group">
                <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center ring-1 ring-purple-100 shadow-xs transition-transform group-hover:scale-110">
                  <Sliders className="size-5" />
                </div>
                <span className="text-xs font-semibold text-slate-700 leading-tight">
                  Easy<br />Management
                </span>
              </div>

              {/* Feature 4 */}
              <div className="flex flex-col items-center text-center space-y-2 group">
                <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center ring-1 ring-sky-100 shadow-xs transition-transform group-hover:scale-110">
                  <Smartphone className="size-5" />
                </div>
                <span className="text-xs font-semibold text-slate-700 leading-tight">
                  Every Device<br />Supported
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Sign In Floating Card ── */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end w-full">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/70 border border-slate-100 p-8 sm:p-10 transition-all">
            {/* Card Header */}
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Sign In
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Access your LinkFi admin panel
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-sm text-rose-600 font-medium">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Input */}
              <div className="space-y-1.5">
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-slate-400 pointer-events-none" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Username"
                    required
                    autoComplete="username"
                    className="w-full h-12 pl-11 pr-4 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-slate-400 pointer-events-none" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    required
                    autoComplete="current-password"
                    className="w-full h-12 pl-11 pr-11 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Row */}
              <div className="flex items-center pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    id="remember"
                    className="rounded-md border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <span className="text-xs sm:text-sm font-medium text-slate-600">
                    Remember Me
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-[#2589fe] via-[#5c60fe] to-[#8c3ffe] hover:opacity-95 text-white font-semibold text-sm sm:text-base shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="size-5" />
                    <span>Login</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
