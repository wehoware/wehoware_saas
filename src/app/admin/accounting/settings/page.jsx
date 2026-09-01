"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Save,
  Building2,
  Wallet,
  Bell,
  RotateCcw,
  Calendar,
  Hash,
  Percent,
  Coins,
  Plug,
  FileText,
  CheckCircle2,
  Info,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import SelectInput from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const CURRENCY_OPTIONS = [
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "CNY", label: "CNY — Chinese Yuan" },
  { value: "AED", label: "AED — UAE Dirham" },
];

const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const BILL_FORMAT_PRESETS = [
  "BILL-{YYYY}-{XXXX}",
  "BILL-{YYYY}{MM}-{XXXX}",
  "INV-{YYYY}-{XXXXX}",
  "BILL-{MM}-{XXXX}",
  "{YYYY}-{XXXX}",
];

const FORMAT_TOKENS = [
  { token: "{YYYY}", description: "4-digit year (e.g. 2026)" },
  { token: "{MM}", description: "2-digit month (01–12)" },
  { token: "{XXXX}", description: "4-digit sequence (zero-padded)" },
  { token: "{XXX}", description: "3-digit sequence (zero-padded)" },
  { token: "{XXXXX}", description: "5-digit sequence (zero-padded)" },
];

// Render a bill number format string into a preview using the current date
// and the provided next sequence number.
function previewBillNumber(format, sequence) {
  if (!format) return "";
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const seq = Number(sequence) || 1;
  return format
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{XXXXX\}/g, String(seq).padStart(5, "0"))
    .replace(/\{XXXX\}/g, String(seq).padStart(4, "0"))
    .replace(/\{XXX\}/g, String(seq).padStart(3, "0"));
}

function isFormatValid(format) {
  if (!format || !format.trim()) return false;
  return /\{X+\}/.test(format);
}

export default function AccountingSettingsPage() {
  const { activeClient } = useAuth();
  const [settings, setSettings] = useState(null);
  const [original, setOriginal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  // Read ?tab=banks (etc.) from the URL on first load so the dashboard's
  // "Connect Bank Account" button can deep-link into a specific tab.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["general", "banks", "reminders"].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!activeClient?.id) return;
      try {
        setIsLoading(true);
        const res = await fetch("/api/v1/accounting-settings");
        if (!res.ok) throw new Error("Failed to load settings");
        const json = await res.json();
        if (cancelled) return;
        // Normalize numeric fields to strings for controlled inputs.
        const normalized = {
          ...json,
          default_tax_rate: json.default_tax_rate != null ? String(json.default_tax_rate) : "0",
          fiscal_year_start: json.fiscal_year_start != null ? String(json.fiscal_year_start) : "1",
          next_bill_number: json.next_bill_number != null ? String(json.next_bill_number) : "1",
        };
        setSettings(normalized);
        setOriginal(normalized);
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

  const update = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const isDirty = useMemo(() => {
    if (!settings || !original) return false;
    const keys = [
      "default_currency",
      "default_tax_rate",
      "fiscal_year_start",
      "bill_number_format",
      "next_bill_number",
      "reminder_enabled",
      "reminder_days_before",
    ];
    return keys.some((k) => String(settings[k]) !== String(original[k]));
  }, [settings, original]);

  const formatValid = isFormatValid(settings?.bill_number_format);
  const billPreview = settings ? previewBillNumber(settings.bill_number_format, settings.next_bill_number) : "";

  const taxRateNum = Number(settings?.default_tax_rate) || 0;
  const taxRateValid = Number.isFinite(taxRateNum) && taxRateNum >= 0 && taxRateNum <= 100;
  const nextBillValid = Number.isInteger(Number(settings?.next_bill_number)) && Number(settings?.next_bill_number) >= 1 && Number(settings?.next_bill_number) <= 999999;
  const reminderDaysValid = Number.isInteger(Number(settings?.reminder_days_before)) && Number(settings?.reminder_days_before) >= 0 && Number(settings?.reminder_days_before) <= 90;

  const canSave = isDirty && formatValid && taxRateValid && nextBillValid && reminderDaysValid && !isSaving;

  async function save() {
    if (!settings || !canSave) return;
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
      const normalized = {
        ...json,
        default_tax_rate: json.default_tax_rate != null ? String(json.default_tax_rate) : "0",
        fiscal_year_start: json.fiscal_year_start != null ? String(json.fiscal_year_start) : "1",
        next_bill_number: json.next_bill_number != null ? String(json.next_bill_number) : "1",
      };
      setSettings(normalized);
      setOriginal(normalized);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function reset() {
    if (original) {
      setSettings(original);
      toast("Changes reverted", { icon: "↩️" });
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
        actionLabel={isSaving ? "Saving…" : "Save changes"}
        actionIcon={
          isSaving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )
        }
        onAction={save}
        actionDisabled={!canSave}
        secondaryActionLabel="Reset"
        secondaryActionIcon={<RotateCcw size={16} />}
        onSecondaryAction={reset}
        secondaryActionDisabled={!isDirty || isSaving}
      />

      {isDirty && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 mb-4">
          <Info className="h-4 w-4 shrink-0" />
          You have unsaved changes. Click <strong>Save changes</strong> to persist them.
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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

        {/* ───────────── General tab ───────────── */}
        <TabsContent value="general" className="mt-6 space-y-6">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                Currency & Tax
              </CardTitle>
              <CardDescription>Defaults applied to new invoices and bills</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <SelectInput
                  id="currency"
                  name="default_currency"
                  value={settings.default_currency}
                  onChange={(e) => update("default_currency", e.target.value)}
                  options={CURRENCY_OPTIONS}
                />
                <p className="text-xs text-muted-foreground">
                  Used when an invoice or bill doesn&apos;t specify its own currency.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax-rate">Default Tax Rate (%)</Label>
                <div className="relative">
                  <Input
                    id="tax-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={settings.default_tax_rate}
                    onChange={(e) => update("default_tax_rate", e.target.value)}
                    className={cn("pr-9", !taxRateValid && "border-red-400 focus-visible:ring-red-400")}
                  />
                  <Percent className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                <p className={cn("text-xs", taxRateValid ? "text-muted-foreground" : "text-red-600")}>
                  {taxRateValid
                    ? "Applied as a percentage on taxable line items."
                    : "Must be a number between 0 and 100."}
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="fiscal" className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Fiscal Year Start (month)
                </Label>
                <div className="sm:w-[240px]">
                  <SelectInput
                    id="fiscal"
                    name="fiscal_year_start"
                    value={settings.fiscal_year_start}
                    onChange={(e) => update("fiscal_year_start", e.target.value)}
                    options={MONTH_OPTIONS}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Determines the start month used by reports and yearly roll-ups.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                Bill Numbering
              </CardTitle>
              <CardDescription>
                Customize how bill numbers are generated. Use tokens to embed dates and a running sequence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bill-format">Bill Number Format</Label>
                  <Input
                    id="bill-format"
                    value={settings.bill_number_format}
                    onChange={(e) => update("bill_number_format", e.target.value)}
                    className={cn(!formatValid && "border-red-400 focus-visible:ring-red-400")}
                    placeholder="BILL-{YYYY}-{XXXX}"
                  />
                  <p className={cn("text-xs", formatValid ? "text-muted-foreground" : "text-red-600")}>
                    {formatValid
                      ? "Must contain at least one sequence token like {XXXX}."
                      : "Format must contain a sequence token (e.g. {XXXX})."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="next-bill">Next Bill Number</Label>
                  <Input
                    id="next-bill"
                    type="number"
                    min="1"
                    max="999999"
                    value={settings.next_bill_number}
                    onChange={(e) => update("next_bill_number", e.target.value)}
                    className={cn(!nextBillValid && "border-red-400 focus-visible:ring-red-400")}
                  />
                  <p className="text-xs text-muted-foreground">
                    The sequence number that will be used for the next bill.
                  </p>
                </div>
              </div>

              {/* Quick presets */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Quick presets
                </Label>
                <div className="flex flex-wrap gap-2">
                  {BILL_FORMAT_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={settings.bill_number_format === preset ? "default" : "outline"}
                      size="sm"
                      className="font-mono text-xs h-8"
                      onClick={() => update("bill_number_format", preset)}
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Token legend */}
              <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Available tokens
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {FORMAT_TOKENS.map((t) => (
                    <div key={t.token} className="flex items-center gap-2 text-xs">
                      <code className="rounded bg-background px-1.5 py-0.5 font-mono text-primary border border-border/60">
                        {t.token}
                      </code>
                      <span className="text-muted-foreground">{t.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live preview */}
              <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
                <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Next bill number preview
                </div>
                <code className="text-lg font-mono font-semibold text-primary">
                  {formatValid ? billPreview || "—" : "Fix the format to see a preview"}
                </code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────────── Bank Accounts tab ───────────── */}
        <TabsContent value="banks" className="mt-6">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                Bank Accounts
              </CardTitle>
              <CardDescription>
                Connect bank accounts to enable real-time transaction reconciliation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Plug className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold">Plaid integration coming in Phase 2</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Securely connect your bank accounts through Plaid to automatically import and
                  reconcile transactions. CSV import will also be available.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1">
                    <CheckCircle2 className="h-3 w-3" /> Real-time feeds
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1">
                    <CheckCircle2 className="h-3 w-3" /> Auto-categorization
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1">
                    <CheckCircle2 className="h-3 w-3" /> CSV import
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────────── Reminders tab ───────────── */}
        <TabsContent value="reminders" className="mt-6">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                Payment Reminders
              </CardTitle>
              <CardDescription>
                Automated email reminders before invoices fall due
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <label
                htmlFor="reminder_enabled"
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 hover:border-border/60 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">Send reminder emails</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Notify clients with overdue invoices via email.
                  </div>
                </div>
                <Switch
                  id="reminder_enabled"
                  checked={settings.reminder_enabled}
                  onCheckedChange={(checked) => update("reminder_enabled", checked)}
                />
              </label>

              <div className={cn("space-y-2", !settings.reminder_enabled && "opacity-50 pointer-events-none")}>
                <Label htmlFor="rem-days">Days before due date</Label>
                <div className="sm:w-[200px]">
                  <Input
                    id="rem-days"
                    type="number"
                    min="0"
                    max="90"
                    value={settings.reminder_days_before}
                    onChange={(e) => update("reminder_days_before", e.target.value)}
                    className={cn(!reminderDaysValid && "border-red-400 focus-visible:ring-red-400")}
                  />
                </div>
                <p className={cn("text-xs", reminderDaysValid ? "text-muted-foreground" : "text-red-600")}>
                  {reminderDaysValid
                    ? settings.reminder_days_before == 0
                      ? "Reminders are sent on the due date itself."
                      : `Reminders are sent ${settings.reminder_days_before} day(s) before the due date.`
                    : "Must be a whole number between 0 and 90."}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
