"use client";

/**
 * CloneInvoiceSheet
 *
 * Lets the user pick a previous invoice and copy its client + line items
 * into the create-invoice form. Searchable, paginated to last 50 entries.
 *
 * Props:
 *   open          : boolean
 *   onOpenChange  : (open: boolean) => void
 *   onClone       : (invoicePayload) => void  // receives full invoice data
 */
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, Search, Copy } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatInvoiceDate, formatCurrency } from "@/lib/invoiceFormat";

const FETCH_LIMIT = 50;

export default function CloneInvoiceSheet({ open, onOpenChange, onClone }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cloningId, setCloningId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          limit: String(FETCH_LIMIT),
          sortBy: "invoiceDate",
          sortOrder: "desc",
        });
        const res = await fetch(`/api/v1/invoices?${params.toString()}`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Failed to load previous invoices");
        }
        const json = await res.json();
        if (!cancelled) setInvoices(Array.isArray(json.data) ? json.data : []);
      } catch (err) {
        if (!cancelled) toast.error(err.message || "Failed to load invoices");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.client_name?.toLowerCase().includes(q) ||
        inv.client_email?.toLowerCase().includes(q)
    );
  }, [invoices, search]);

  const handleClone = async (invoiceId) => {
    if (cloningId) return;
    try {
      setCloningId(invoiceId);
      const res = await fetch(`/api/v1/invoices/${invoiceId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to load source invoice");
      }
      const data = await res.json();
      const payload = data?.data ?? data;
      onClone?.(payload);
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || "Failed to clone invoice");
    } finally {
      setCloningId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Clone Previous Invoice</SheetTitle>
          <SheetDescription>
            Copy the client, line items, currency, tax rate, and notes from a
            previous invoice. Dates and invoice number are reset.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by invoice # or client..."
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-10">
            {invoices.length === 0
              ? "No invoices yet. Create one first to enable cloning."
              : "No invoices match your search."}
          </p>
        ) : (
          <ul className="divide-y border rounded-md">
            {filtered.map((inv) => {
              const isLoading = cloningId === inv.id;
              return (
                <li
                  key={inv.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-semibold truncate">
                      {inv.invoice_number}
                    </p>
                    <p className="text-xs text-gray-600 truncate">
                      {inv.client_name}
                      {inv.client_email ? ` · ${inv.client_email}` : ""}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatInvoiceDate(inv.invoice_date)} ·{" "}
                      {formatCurrency(inv.total, inv.currency)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleClone(inv.id)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" /> Clone
                      </>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
