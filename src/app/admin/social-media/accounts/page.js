"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Share2, Plus, RefreshCw, Trash2, AlertCircle, CheckCircle, Pause, Wifi } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_CONFIG = {
  Active: { color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  Disconnected: { color: "bg-gray-100 text-gray-600 border-gray-200", icon: Wifi },
  Error: { color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
  Paused: { color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Pause },
};

export default function SocialAccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [syncing, setSyncing] = useState(null);

  // Handle OAuth success/error from URL params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");
    const platform = params.get("platform");
    if (success === "connected") toast.success(`${platform || "Account"} connected successfully!`);
    if (error) toast.error(`Connection failed: ${decodeURIComponent(error)}`);
    if (success || error) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [accountsRes, platformsRes] = await Promise.all([
        fetch("/api/v1/social/accounts"),
        fetch("/api/v1/social/platforms"),
      ]);
      if (accountsRes.ok) setAccounts((await accountsRes.json()).accounts || []);
      if (platformsRes.ok) setPlatforms((await platformsRes.json()).platforms || []);
    } catch {
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  async function connectPlatform(platform) {
    setConnecting(platform.id);
    try {
      const res = await fetch(`/api/v1/social/platforms/${platform.id}/oauth-url`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate OAuth URL");
      window.location.href = data.authUrl;
    } catch (err) {
      toast.error(err.message || "Failed to connect platform");
      setConnecting(null);
    }
  }

  async function syncAccount(accountId) {
    setSyncing(accountId);
    try {
      const res = await fetch(`/api/v1/social/accounts/${accountId}/sync`, { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      toast.success("Account synced successfully");
      await loadData();
    } catch {
      toast.error("Failed to sync account");
    } finally {
      setSyncing(null);
    }
  }

  async function disconnectAccount() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/v1/social/accounts/${deleteTarget}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
      toast.success("Account disconnected");
      setDeleteTarget(null);
      await loadData();
    } catch {
      toast.error("Failed to disconnect account");
    }
  }

  const connectedPlatformCodes = new Set(accounts.filter((a) => a.status === "Active").map((a) => a.platform?.platformCode));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Social Media Accounts</h1>
            <p className="text-muted-foreground mt-1">Connect and manage your social media accounts</p>
          </div>
          <Button variant="outline" onClick={loadData} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Available Platforms to Connect */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Available Platforms</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {platforms.map((platform) => {
              const isConnected = connectedPlatformCodes.has(platform.platformCode);
              return (
                <Card key={platform.id} className={`cursor-pointer hover:shadow-md transition-shadow ${isConnected ? "border-green-200 bg-green-50/30" : ""}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col items-center gap-2 text-center">
                      {platform.logoUrl ? (
                        <img src={platform.logoUrl} alt={platform.name} className="w-8 h-8 rounded object-contain" />
                      ) : (
                        <Share2 className="w-8 h-8 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">{platform.name}</span>
                      {isConnected ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">Connected</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs"
                          disabled={connecting === platform.id}
                          onClick={() => connectPlatform(platform)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {connecting === platform.id ? "Connecting..." : "Connect"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Connected Accounts List */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Connected Accounts</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Share2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium mb-1">No accounts connected</h3>
                <p className="text-sm text-muted-foreground">Connect a platform above to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => {
                const statusCfg = STATUS_CONFIG[account.status] || STATUS_CONFIG.Disconnected;
                const StatusIcon = statusCfg.icon;
                return (
                  <Card key={account.id}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        {account.platform?.logoUrl ? (
                          <img src={account.platform.logoUrl} alt={account.platform.name} className="w-8 h-8 rounded object-contain" />
                        ) : (
                          <Share2 className="w-8 h-8 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{account.account_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {account.platform?.name}
                            {account.account_handle ? ` · @${account.account_handle}` : ""}
                          </p>
                          {account.last_synced_at && (
                            <p className="text-xs text-muted-foreground">
                              Last sync: {new Date(account.last_synced_at).toLocaleDateString()}
                            </p>
                          )}
                          {account.sync_error && (
                            <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                              <AlertCircle className="h-3 w-3" />
                              {account.sync_error}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={statusCfg.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {account.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={syncing === account.id}
                          onClick={() => syncAccount(account.id)}
                        >
                          <RefreshCw className={`h-4 w-4 ${syncing === account.id ? "animate-spin" : ""}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(account.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect the account and remove its access token. Scheduled posts for this account may fail. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={disconnectAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
