"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "react-hot-toast";

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const hasToken = Boolean(token);
  const [loading, setLoading] = useState(hasToken);
  const [validating, setValidating] = useState(hasToken);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(hasToken ? "" : "Invalid or missing invitation link.");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!hasToken) return;

    const validate = async () => {
      try {
        const res = await fetch(`/api/v1/invites?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (res.ok) {
          setInvite(data);
        } else {
          setError(data.error || "Invalid or expired invitation.");
        }
      } catch (e) {
        console.error("Invite validation error:", e);
        setError("Failed to validate invitation.");
      } finally {
        setValidating(false);
        setLoading(false);
      }
    };

    validate();
  }, [hasToken, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password && password.length >= 8) {
      setSubmitting(true);
      try {
        const res = await fetch("/api/v1/invites/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password, first_name: firstName, last_name: lastName }),
        });
        const data = await res.json();
        if (res.ok) {
          setAccepted(true);
          toast.success(data.message || "Invitation accepted!");
        } else {
          toast.error(data.error || "Failed to accept invitation.");
        }
      } catch (e) {
        console.error("Invite accept error:", e);
        toast.error("Network error. Please try again.");
      } finally {
        setSubmitting(false);
      }
    } else {
      toast.error("Password must be at least 8 characters.");
    }
  };

  if (loading || validating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome aboard!</CardTitle>
            <CardDescription>
              Your invitation has been accepted. You can now{" "}
              <a href="/login" className="text-primary underline">
                log in
              </a>{" "}
              with your email and password.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Invitation</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join <strong>{invite?.client?.companyName}</strong> as a{" "}
            <strong>{invite?.role}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={invite?.email || ""} disabled />
            </div>
            <div className="relative">
              <Label htmlFor="password">
                Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
              <button
                type="button"
                className="absolute right-3 top-[34px]"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? "Accepting..." : "Accept Invitation"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <AcceptInviteForm />
    </Suspense>
  );
}
