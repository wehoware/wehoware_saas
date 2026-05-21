"use client";

/**
 * /admin/accounting/integrations/plaid
 *
 * Lets the current tenant:
 *  - Kick off Plaid Link and exchange the returned public_token
 *  - View connected Plaid items + the bank accounts they span
 *  - Force a sync or disconnect an item
 *  - Inspect recent bank statement entries (staging rows)
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { usePlaidLink } from "react-plaid-link";
import { RefreshCw, Link2, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function statusColor(status) {
  switch (status) {
    case "Active":
      return "bg-emerald-100 text-emerald-800";
    case "RequiresReauth":
      return "bg-amber-100 text-amber-800";
    case "Error":
      return "bg-rose-100 text-rose-800";
    case "Disconnected":
      return "bg-zinc-200 text-zinc-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

export default function PlaidIntegrationsPage() {
  const { activeClient } = useAuth();
  const [items, setItems] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingItemId, setSyncingItemId] = useState(null);
  const [linkToken, setLinkToken] = useState(null);
  const [creatingToken, setCreatingToken] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, entriesRes] = await Promise.all([
        fetch("/api/v1/plaid/items"),
        fetch("/api/v1/plaid/statement-entries?page_size=20"),
      ]);
      if (!itemsRes.ok) throw new Error("Failed to load Plaid items");
      const itemsJson = await itemsRes.json();
      setItems(itemsJson.data || []);
      if (entriesRes.ok) {
        const entriesJson = await entriesRes.json();
        setEntries(entriesJson.data || []);
      }
    } catch (err) {
      toast.error(err.message || "Failed to load Plaid data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [activeClient?.id, loadData]);

  const createLinkToken = useCallback(async () => {
    setCreatingToken(true);
    try {
      const res = await fetch("/api/v1/plaid/link-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create link token");
      }
      setLinkToken(data.link_token);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreatingToken(false);
    }
  }, []);

  const onPlaidSuccess = useCallback(
    async (publicToken, metadata) => {
      try {
        const res = await fetch("/api/v1/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution: metadata?.institution
              ? {
                  id: metadata.institution.institution_id,
                  name: metadata.institution.name,
                }
              : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Exchange failed");
        toast.success(
          `Connected ${data.institution_name || "Plaid item"}${
            data.sync?.added != null ? ` — synced ${data.sync.added} txs` : ""
          }`
        );
        setLinkToken(null);
        loadData();
      } catch (err) {
        toast.error(err.message);
      }
    },
    [loadData]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: (err) => {
      if (err) toast.error(err.display_message || err.error_message || "Plaid Link exited");
      setLinkToken(null);
    },
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  const handleSync = async (itemId) => {
    setSyncingItemId(itemId);
    try {
      const res = await fetch("/api/v1/plaid/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaid_item_id: itemId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast.success("Sync complete");
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncingItemId(null);
    }
  };

  const handleDisconnect = async (itemId, institutionName) => {
    if (!confirm(`Disconnect ${institutionName || "this Plaid item"}?`)) return;
    try {
      const res = await fetch(`/api/v1/plaid/items?id=${itemId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Disconnect failed");
      toast.success("Disconnected");
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Plaid Bank Feeds"
        description="Connect your bank accounts to automatically pull transactions into the ledger."
        backLink="/admin/accounting"
        actionLabel={creatingToken ? "Preparing…" : "Connect a bank"}
        onAction={createLinkToken}
        actionIcon={<Link2 className="h-4 w-4" />}
        actionDisabled={creatingToken}
      />

      <Card>
        <CardHeader>
          <CardTitle>Connected Institutions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No Plaid items yet. Click <strong>Connect a bank</strong> above to add one.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <p className="font-medium">
                        {item.institution_name || "Unnamed institution"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.bank_accounts.length} account
                        {item.bank_accounts.length === 1 ? "" : "s"} · last sync
                        {" "}
                        {formatDate(item.last_sync_at)}
                      </p>
                    </div>
                    <Badge className={statusColor(item.status)}>{item.status}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={syncingItemId === item.id}
                      onClick={() => handleSync(item.id)}
                      className="gap-2"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${
                          syncingItemId === item.id ? "animate-spin" : ""
                        }`}
                      />
                      Sync now
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleDisconnect(item.id, item.institution_name)
                      }
                      className="gap-2 text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Disconnect
                    </Button>
                  </div>
                  {item.error_message ? (
                    <div className="mt-2 flex items-start gap-2 rounded bg-amber-50 p-2 text-sm text-amber-900">
                      <AlertTriangle className="h-4 w-4 mt-0.5" />
                      <span>
                        {item.error_code}: {item.error_message}
                      </span>
                    </div>
                  ) : null}
                  {item.bank_accounts.length > 0 ? (
                    <ul className="mt-3 ml-4 space-y-1 text-sm">
                      {item.bank_accounts.map((a) => (
                        <li key={a.id} className="flex items-center gap-2">
                          <CheckCircle2
                            className={`h-3.5 w-3.5 ${
                              a.is_active
                                ? "text-emerald-600"
                                : "text-muted-foreground"
                            }`}
                          />
                          <span className="font-medium">{a.name}</span>
                          {a.mask ? (
                            <span className="text-muted-foreground">
                              ••{a.mask}
                            </span>
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            {a.currency}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Bank Statement Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Entries will appear here after the first sync.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Description</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4 text-right">Amount</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">
                        {new Date(e.posted_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="font-medium">{e.description}</div>
                        {e.merchant_name ? (
                          <div className="text-xs text-muted-foreground">
                            {e.merchant_name}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {e.category || "—"}
                      </td>
                      <td
                        className={`py-2 pr-4 text-right font-mono ${
                          Number(e.amount) < 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }`}
                      >
                        {Number(e.amount).toLocaleString(undefined, {
                          style: "currency",
                          currency: e.currency || "USD",
                        })}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge
                          className={
                            e.reconciliation === "Reconciled"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-zinc-100 text-zinc-700"
                          }
                        >
                          {e.reconciliation}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 text-xs text-muted-foreground">
            Reconciliation tools ship in Phase 2. These staging rows become
            matchable items once that UI is live.
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        <Link href="/admin/accounting" className="underline">
          ← Back to Accounting
        </Link>
      </div>
    </div>
  );
}
