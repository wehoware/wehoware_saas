"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Search, Plus, X, Loader2, User } from "lucide-react";

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * CustomerPicker — searchable popover for selecting a customer.
 *
 * Props:
 *   value         : string | null — selected customer id
 *   onChange      : (customer: { id, name, email, contact_person, phone } | null) => void
 *   disabled      : boolean
 */
export default function CustomerPicker({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef(null);

  // Fetch customers on mount and when search changes
  useEffect(() => {
    let cancelled = false;
    async function fetchCustomers() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          limit: "20",
          sortBy: "name",
          sortOrder: "asc",
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        const res = await fetch(`/api/v1/customers?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (!cancelled) setCustomers(json.data || []);
      } catch (err) {
        console.error("[CustomerPicker] fetch error:", err);
        if (!cancelled) setCustomers([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchCustomers();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  // Resolve selected customer name when value prop changes
  useEffect(() => {
    if (!value) {
      setSelectedCustomer(null);
      return;
    }
    // If it's already in our loaded list, use it
    const found = customers.find((c) => c.id === value);
    if (found) {
      setSelectedCustomer(found);
      return;
    }
    // Otherwise fetch single customer
    let cancelled = false;
    async function fetchOne() {
      try {
        const res = await fetch(`/api/v1/customers/${value}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        if (!cancelled) setSelectedCustomer(data);
      } catch (err) {
        console.error("[CustomerPicker] fetchOne error:", err);
        if (!cancelled) setSelectedCustomer(null);
      }
    }
    fetchOne();
    return () => {
      cancelled = true;
    };
  }, [value, customers]);

  const handleSelect = useCallback(
    (customer) => {
      setSelectedCustomer(customer);
      onChange(customer);
      setOpen(false);
      setSearch("");
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    setSelectedCustomer(null);
    onChange(null);
    setSearch("");
  }, [onChange]);

  async function handleCreateCustomer(e) {
    e.preventDefault();
    const name = (createName || "").trim();
    if (!name) return;
    try {
      setIsCreating(true);
      const res = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: createEmail || null,
          phone: createPhone || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to create customer");
      }
      const saved = await res.json();
      handleSelect({
        id: saved.id,
        name: saved.name,
        email: saved.email,
        contact_person: saved.contact_person,
        phone: saved.phone,
      });
      setCreateDialogOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePhone("");
    } catch (err) {
      alert(err.message || "Failed to create customer");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {selectedCustomer
                  ? selectedCustomer.name
                  : "Select or search customer…"}
              </span>
            </div>
            {selectedCustomer ? (
              <span
                className="ml-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
              >
                <X className="h-4 w-4" />
              </span>
            ) : (
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder="Search customers…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[200px] overflow-y-auto">
            {isLoading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Loading…
              </div>
            ) : customers.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {debouncedSearch
                  ? "No customers found."
                  : "No customers yet."}
              </div>
            ) : (
              <div className="flex flex-col">
                {customers.map((customer) => (
                  <button
                    key={customer.id}
                    className="flex flex-col items-start px-3 py-2 text-sm hover:bg-accent w-full text-left"
                    onClick={() =>
                      handleSelect({
                        id: customer.id,
                        name: customer.name,
                        email: customer.email,
                        contact_person: customer.contact_person,
                        phone: customer.phone,
                      })
                    }
                  >
                    <span className="font-medium">{customer.name}</span>
                    {customer.email && (
                      <span className="text-xs text-muted-foreground">
                        {customer.email}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create new customer
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Inline Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Customer</DialogTitle>
            <DialogDescription>
              Add a new customer to your directory.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCustomer} className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Customer name"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                placeholder="+1 555-0100"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create Customer"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
