"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircleIcon, Trash2Icon } from "lucide-react";
import SelectInput from "@/components/ui/select";
import DatePicker from "@/components/ui/date-picker";
import { toIsoDateOnly } from "@/lib/invoiceFormat";
import CustomerPicker from "./CustomerPicker";

const DEFAULT_CURRENCY = "CAD";
const DEFAULT_TAX_RATE = 0;
const DEFAULT_STATUS = "Draft";

const todayIso = () => new Date().toISOString().split("T")[0];

const createEmptyItem = () => ({ description: "", quantity: 1, unitPrice: 0 });

/**
 * Reusable invoice form (create + edit).
 *
 * Props
 *   initialData : invoice payload from /api/v1/invoices/[id] (snake_case)
 *   defaults    : invoice settings defaults (currency, tax rate, notes) for new invoices
 *   onSubmit    : (formData) => Promise<void>
 *   isEditing   : boolean — switches submit label and skips defaults application
 */
const InvoiceForm = ({
  initialData,
  defaults,
  onSubmit,
  isEditing = false,
}) => {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [customerId, setCustomerId] = useState(null);
  const [invoiceDate, setInvoiceDate] = useState(todayIso);
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [taxRate, setTaxRate] = useState(DEFAULT_TAX_RATE);
  const [items, setItems] = useState(() => [createEmptyItem()]);
  const [notes, setNotes] = useState("");
  const [billingStartDate, setBillingStartDate] = useState("");
  const [billingEndDate, setBillingEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hydrate from initialData (edit / clone) — runs whenever the upstream
  // payload changes so a parent-driven "clone" reset reflows the form.
  useEffect(() => {
    if (!initialData) return;
    setClientName(initialData.client_name ?? "");
    setClientEmail(initialData.client_email ?? "");
    setCustomerId(initialData.customer_id ?? null);
    setInvoiceDate(
      toIsoDateOnly(initialData.invoice_date) || todayIso()
    );
    setDueDate(toIsoDateOnly(initialData.due_date) || "");
    setStatus(initialData.status || DEFAULT_STATUS);
    setCurrency(initialData.currency || DEFAULT_CURRENCY);
    if (initialData.tax_rate !== undefined && initialData.tax_rate !== null) {
      setTaxRate(Number(initialData.tax_rate));
    }
    const lineItems = initialData.line_items || initialData.items || [];
    setItems(
      lineItems.length > 0
        ? lineItems.map((item) => ({
            description: item.description || "",
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
          }))
        : [createEmptyItem()]
    );
    setNotes(initialData.notes ?? "");
    setBillingStartDate(toIsoDateOnly(initialData.billing_start_date) || "");
    setBillingEndDate(toIsoDateOnly(initialData.billing_end_date) || "");
  }, [initialData]);

  // Apply settings defaults only on create (no initialData) and only when
  // the user hasn't typed anything yet. Won't overwrite an in-progress edit.
  useEffect(() => {
    if (isEditing || initialData || !defaults) return;
    if (defaults.default_currency) setCurrency(defaults.default_currency);
    if (defaults.default_tax_rate !== undefined && defaults.default_tax_rate !== null) {
      setTaxRate(Number(defaults.default_tax_rate));
    }
    if (defaults.default_notes) setNotes(defaults.default_notes);
    // Only run on first defaults load; subsequent changes shouldn't clobber
    // a user's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults?.default_currency, defaults?.default_tax_rate, defaults?.default_notes]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    if (field === "quantity" || field === "unitPrice") {
      newItems[index][field] = parseFloat(value) || 0;
    } else {
      newItems[index][field] = value;
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const calculateSubtotal = () => {
    return items
      .reduce((total, item) => total + item.quantity * item.unitPrice, 0)
      .toFixed(2);
  };

  const calculateTaxAmount = () => {
    const subtotal = parseFloat(calculateSubtotal());
    const tax = subtotal * (taxRate / 100);
    return tax.toFixed(2);
  };

  const calculateTotal = () => {
    const subtotal = parseFloat(calculateSubtotal());
    const tax = parseFloat(calculateTaxAmount());
    return (subtotal + tax).toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!clientName?.trim()) {
      toast.error("Client name is required");
      return;
    }
    if (!invoiceDate) {
      toast.error("Invoice date is required");
      return;
    }
    if (!dueDate) {
      toast.error("Due date is required");
      return;
    }
    const formData = {
      customer_id: customerId,
      client_name: clientName,
      client_email: clientEmail,
      invoice_date: invoiceDate,
      due_date: dueDate,
      status: status || DEFAULT_STATUS,
      currency,
      tax_rate: Number(taxRate) || 0,
      line_items: items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity) || 0,
        unit_price: Number(it.unitPrice) || 0,
      })),
      notes,
      billing_start_date: billingStartDate || null,
      billing_end_date: billingEndDate || null,
      subtotal: Number.parseFloat(calculateSubtotal()),
      tax_amount: Number.parseFloat(calculateTaxAmount()),
      total_amount: Number.parseFloat(calculateTotal()),
      id: initialData?.id,
    };
    try {
      setIsSubmitting(true);
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 bg-white p-6 md:p-8 rounded-lg shadow-lg"
    >
      <h2 className="text-xl md:text-2xl font-semibold text-gray-800 mb-6">
        {isEditing ? "Edit Invoice" : "Create New Invoice"}
      </h2>

      {/* Customer Picker */}
      <div className="mb-4">
        <Label className="block text-sm font-medium text-gray-700 mb-1">
          Customer
        </Label>
        <CustomerPicker
          value={customerId}
          onChange={(customer) => {
            if (customer) {
              setCustomerId(customer.id);
              setClientName(customer.name || "");
              setClientEmail(customer.email || "");
            } else {
              setCustomerId(null);
            }
          }}
          disabled={isSubmitting}
        />
        <p className="text-xs text-gray-500 mt-1">
          Select a customer to auto-fill details, or enter manually below.
        </p>
      </div>

      {/* Client Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label
            htmlFor="clientName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Client Name
          </Label>
          <Input
            id="clientName"
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Enter client's full name"
            required
            className="w-full"
          />
        </div>
        <div>
          <Label
            htmlFor="clientEmail"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Client Email
          </Label>
          <Input
            id="clientEmail"
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="client@example.com"
            required
            className="w-full"
          />
        </div>
      </div>

      {/* Invoice Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label
            htmlFor="invoiceDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Invoice Date
          </Label>
          <DatePicker
            id="invoiceDate"
            name="invoiceDate"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            placeholder="Pick invoice date"
          />
        </div>
        <div>
          <Label
            htmlFor="dueDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Due Date
          </Label>
          <DatePicker
            id="dueDate"
            name="dueDate"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            placeholder="Pick due date"
          />
        </div>
      </div>

      {/* Billing Period */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label
            htmlFor="billingStartDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Billing Start Date <span className="text-gray-400 font-normal">(optional)</span>
          </Label>
          <DatePicker
            id="billingStartDate"
            name="billingStartDate"
            value={billingStartDate}
            onChange={(e) => setBillingStartDate(e.target.value)}
            placeholder="Pick billing start date"
          />
        </div>
        <div>
          <Label
            htmlFor="billingEndDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Billing End Date <span className="text-gray-400 font-normal">(optional)</span>
          </Label>
          <DatePicker
            id="billingEndDate"
            name="billingEndDate"
            value={billingEndDate}
            onChange={(e) => setBillingEndDate(e.target.value)}
            placeholder="Pick billing end date"
          />
        </div>
      </div>

      {/* Status and Currency */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Status
          </Label>
          <SelectInput
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: "Pending", label: "Pending" },
              { value: "Paid", label: "Paid" },
              { value: "Overdue", label: "Overdue" },
              { value: "Draft", label: "Draft" },
              { value: "Cancelled", label: "Cancelled" },
            ]}
          />
        </div>
        <div>
          <Label
            htmlFor="currency"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Currency
          </Label>
          <SelectInput
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={[
              { value: "CAD", label: "CAD (Canadian Dollar)" },
              { value: "USD", label: "USD (US Dollar)" },
              { value: "EUR", label: "EUR (Euro)" },
              { value: "GBP", label: "GBP (British Pound)" },
            ]}
          />
        </div>
      </div>

      {/* Invoice Items */}
      <div>
        <Label className="block text-lg font-medium text-gray-800 mb-3">
          Invoice Items
        </Label>
        {items.map((item, index) => (
          <div
            key={index}
            className="grid grid-cols-12 gap-3 mb-3 p-3 border rounded-md items-end"
          >
            <div className="col-span-12 md:col-span-5">
              <Label
                htmlFor={`item-description-${index}`}
                className="text-xs text-gray-600"
              >
                Description
              </Label>
              <Input
                id={`item-description-${index}`}
                type="text"
                placeholder="Service or product description"
                value={item.description}
                onChange={(e) =>
                  handleItemChange(index, "description", e.target.value)
                }
                required
                className="w-full mt-1"
              />
            </div>
            <div className="col-span-6 md:col-span-2">
              <Label
                htmlFor={`item-quantity-${index}`}
                className="text-xs text-gray-600"
              >
                Quantity
              </Label>
              <Input
                id={`item-quantity-${index}`}
                type="number"
                placeholder="1"
                value={item.quantity}
                onChange={(e) =>
                  handleItemChange(index, "quantity", e.target.value)
                }
                required
                min="0.01"
                step="0.01"
                className="w-full mt-1"
              />
            </div>
            <div className="col-span-6 md:col-span-2">
              <Label
                htmlFor={`item-unitPrice-${index}`}
                className="text-xs text-gray-600"
              >
                Unit Price
              </Label>
              <Input
                id={`item-unitPrice-${index}`}
                type="number"
                placeholder="0.00"
                value={item.unitPrice}
                onChange={(e) =>
                  handleItemChange(index, "unitPrice", e.target.value)
                }
                required
                min="0.00"
                step="0.01"
                className="w-full mt-1"
              />
            </div>
            <div className="col-span-12 md:col-span-2 flex items-center">
              <p className="text-sm text-gray-700 w-full mt-1 md:mt-7 text-right pr-2">
                Subtotal: ${(item.quantity * item.unitPrice).toFixed(2)}
              </p>
            </div>
            <div className="col-span-12 md:col-span-1 flex justify-end items-center md:mt-6">
              {items.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2Icon className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={addItem}
          className="mt-2 text-blue-600 border-blue-600 hover:bg-blue-50"
        >
          <PlusCircleIcon className="w-5 h-5 mr-2" /> Add Item
        </Button>
      </div>

      {/* Tax Rate */}
      <div>
        <Label
          htmlFor="taxRate"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Tax Rate (%)
        </Label>
        <Input
          id="taxRate"
          type="number"
          value={taxRate}
          onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
          placeholder="13"
          min="0"
          max="100"
          step="0.1"
          className="w-full"
        />
        <p className="text-xs text-gray-500 mt-1">Enter tax rate as percentage (e.g., 13 for 13%)</p>
      </div>

      {/* Notes */}
      <div>
        <Label
          htmlFor="notes"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Notes / Terms
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional notes, terms and conditions, or payment instructions."
          rows={3}
          className="w-full"
        />
      </div>

      {/* Total Amount */}
      <div className="bg-gray-50 p-4 rounded-lg mt-6">
        <div className="flex justify-between mb-2">
          <span className="text-gray-600">Subtotal:</span>
          <span className="font-medium">{currency} {calculateSubtotal()}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-gray-600">Tax ({taxRate}%):</span>
          <span className="font-medium">{currency} {calculateTaxAmount()}</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-gray-300">
          <span className="text-lg font-semibold text-gray-800">Total:</span>
          <span className="text-lg font-bold text-gray-900">{currency} {calculateTotal()}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="text-gray-700 border-gray-300 hover:bg-gray-100"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSubmitting
            ? isEditing
              ? "Saving..."
              : "Creating..."
            : isEditing
              ? "Save Changes"
              : "Create Invoice"}
        </Button>
      </div>
    </form>
  );
};

export default InvoiceForm;
