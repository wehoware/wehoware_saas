"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, Loader2, ShieldCheck, ArrowLeft, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const BRAND_FEATURES = [
  { icon: ShieldCheck, title: "Secure access", desc: "JWT-protected sessions with role-based permissions." },
  { icon: Sparkles, title: "Multi-tenant", desc: "Switch between client workspaces in one click." },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const router = useRouter();
  const { login, isAuthenticated, loading } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push("/admin");
    }
  }, [loading, isAuthenticated, router]);

  // Restore remembered email on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("wehoware_remember_email");
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      // non-fatal
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "email") {
      setEmail(value);
    } else if (name === "password") {
      setPassword(value);
    }
    // Clear any previous errors when user starts typing again
    if (error) setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const success = await login(email, password);

      if (!success) {
        setError("Invalid email or password. Please try again.");
      } else if (remember) {
        try {
          localStorage.setItem("wehoware_remember_email", email.trim());
        } catch {
          // non-fatal
        }
      } else {
        try {
          localStorage.removeItem("wehoware_remember_email");
        } catch {
          // non-fatal
        }
      }
    } catch (err) {
      console.error("Error logging in:", err);
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 pt-24 pb-8 sm:pt-28 sm:pb-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl"
      >
        <Card className="overflow-hidden border-border/60 shadow-xl grid md:grid-cols-2 p-0">
          {/* ---------------- Brand panel ---------------- */}
          <div className="relative hidden md:flex flex-col justify-between p-8 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white overflow-hidden">
            {/* Decorative glow */}
            <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-cyan-500/20 blur-3xl" />

            <div className="relative">
              <Link href="/" className="inline-flex items-center gap-2 group">
                <span className="text-xl font-bold gradient-text-premium">Wehoware</span>
              </Link>
              <p className="mt-3 text-sm text-slate-300/80 max-w-xs leading-relaxed">
                The admin workspace for managing clients, content, CRM, and social media — all in one place.
              </p>
            </div>

            <div className="relative space-y-4 mt-8">
              {BRAND_FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                    <Icon className="h-4 w-4 text-cyan-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-xs text-slate-300/70 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative pt-8">
              <p className="text-xs text-slate-400/70">
                &copy; {new Date().getFullYear()} Wehoware Technologies. All rights reserved.
              </p>
            </div>
          </div>

          {/* ---------------- Form panel ---------------- */}
          <CardContent className="p-6 sm:p-8 flex flex-col justify-center">
            <div className="md:hidden mb-6 text-center">
              <span className="text-xl font-bold gradient-text-premium">Wehoware</span>
            </div>

            <div className="mb-6">
              <h1 className="text-xl font-bold tracking-tight">Welcome back</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Sign in to access your dashboard
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 p-3 bg-destructive/10 text-destructive rounded-md border border-destructive/20 text-sm flex items-start gap-2.5"
                role="alert"
              >
                <svg
                  className="h-5 w-5 shrink-0 mt-0.5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium">{error}</span>
              </motion.div>
            )}

            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={handleChange}
                    className="pl-9"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={handleChange}
                    className="pl-9 pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                  Remember my email
                </Label>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-border/60">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to home
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
