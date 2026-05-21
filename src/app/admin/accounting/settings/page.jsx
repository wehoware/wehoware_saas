"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Building2, Wallet, Bell } from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import { useAuth } from "@/contexts/auth-context";

export default function AccountingSettingsPage() {
  const { activeClient } = useAuth();
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/v1/accounting-settings");
        if (!res.ok) throw new Error("Failed to load settings");
        const json = await res.json();
        if (!cancelled) setSettings(json);
      } catch (err) {
        toast.error(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [activeClient?.id]);

  async function save() {
    if (!settings) return;
    try {
      setIsSaving(true);
      const res = await fetch("/api/v1/accounting-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_currency: settings.default_currency,
          default_tax_rate: Number(settings.default_tax_rate) || 0,
          fiscal_year_start: Number(settings.fiscal_year_start) || 1,
          bill_number_format: settings.bill_number_format,
          next_bill_number: Number(settings.next_bill_number) || 1,
          reminder_enabled: settings.reminder_enabled,
          reminder_days_before: Number(settings.reminder_days_before) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setSettings(json);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !settings) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <AdminPageHeader
        title="Accounting Settings"
        description="Currency, tax, bill numbering, and reminders"
        actionLabel={isSaving ? "Saving…" : "Save"}
        actionIcon={
          isSaving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )
        }
        onAction={save}
        actionDisabled={isSaving}
      />

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">
            <Building2 className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="banks">
            <Wallet className="h-4 w-4 mr-2" />
            Bank Accounts
          </TabsTrigger>
          <TabsTrigger value="reminders">
            <Bell className="h-4 w-4 mr-2" />
            Reminders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Currency & Tax</CardTitle>
              <CardDescription>Defaults for new invoices and bills</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="currency">Default Currency</Label>
                <Input
                  id="currency"
                  value={settings.default_currency}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      default_currency: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="tax-rate">Default Tax Rate (%)</Label>
                <Input
                  id="tax-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={settings.default_tax_rate}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      default_tax_rate: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="fiscal">Fiscal Year Start (month)</Label>
                <Input
                  id="fiscal"
                  type="number"
                  min="1"
                  max="12"
                  value={settings.fiscal_year_start}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      fiscal_year_start: e.target.value,
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Bill Numbering</CardTitle>
              <CardDescription>
                Use tokens: {"{YYYY}"}, {"{MM}"}, {"{XXXX}"} (sequence)
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="bill-format">Bill Number Format</Label>
                <Input
                  id="bill-format"
                  value={settings.bill_number_format}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      bill_number_format: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="next-bill">Next Bill Number</Label>
                <Input
                  id="next-bill"
                  type="number"
                  min="1"
                  value={settings.next_bill_number}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      next_bill_number: e.target.value,
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banks" className="mt-6">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Bank Accounts</CardTitle>
              <CardDescription>
                Connect bank accounts to enable real-time transaction reconciliation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground py-12 text-center border-2 border-dashed border-gray-200 rounded-lg">
                Plaid integration ships in Phase 2. CSV import will also be
                available there.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminders" className="mt-6">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Payment Reminders</CardTitle>
              <CardDescription>
                Automated email reminders before invoices fall due
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.reminder_enabled}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      reminder_enabled: e.target.checked,
                    }))
                  }
                />
                <span className="text-sm">
                  Send reminder emails to clients with overdue invoices
                </span>
              </label>
              <div>
                <Label htmlFor="rem-days">Days before due date</Label>
                <Input
                  id="rem-days"
                  type="number"
                  min="0"
                  max="90"
                  value={settings.reminder_days_before}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      reminder_days_before: e.target.value,
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
