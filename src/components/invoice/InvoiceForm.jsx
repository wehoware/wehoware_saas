import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // Corrected import for App Router
import { Button } from "@/components/ui/button"; // Assuming you have a Button component
import { Input } from "@/components/ui/input"; // Assuming you have an Input component
import { Label } from "@/components/ui/label"; // Assuming you have a Label component
import { Textarea } from "@/components/ui/textarea"; // Assuming you have a Textarea component
import { PlusCircleIcon, Trash2Icon } from "lucide-react";
import SelectInput from "@/components/ui/select";

const InvoiceForm = ({ initialData, onSubmit, isEditing = false }) => {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("Pending"); // Default status
  const [items, setItems] = useState([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (initialData) {
      setClientName(initialData.clientName || "");
      setClientEmail(initialData.clientEmail || "");
      setInvoiceDate(
        initialData.invoiceDate
          ? new Date(initialData.invoiceDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setDueDate(
        initialData.dueDate
          ? new Date(initialData.dueDate).toISOString().split("T")[0]
          : ""
      );
      setStatus(initialData.status || "Pending");
      setItems(
        initialData.items && initialData.items.length > 0
          ? initialData.items
          : [{ description: "", quantity: 1, unitPrice: 0 }]
      );
      setNotes(initialData.notes || "");
    }
  }, [initialData]);

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

  const calculateTotal = () => {
    return items
      .reduce((total, item) => total + item.quantity * item.unitPrice, 0)
      .toFixed(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = {
      clientName,
      clientEmail,
      invoiceDate,
      dueDate,
      status,
      items,
      notes,
      totalAmount: parseFloat(calculateTotal()),
      id: initialData?.id, // Include ID if editing
    };
    onSubmit(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 bg-white p-6 md:p-8 rounded-lg shadow-lg"
    >
      <h2 className="text-xl md:text-2xl font-semibold text-gray-800 mb-6">
        {isEditing ? "Edit Invoice" : "Create New Invoice"}
      </h2>

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
          <Input
            id="invoiceDate"
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            required
            className="w-full"
          />
        </div>
        <div>
          <Label
            htmlFor="dueDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Due Date
          </Label>
          <Input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {/* Status */}
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
      <div className="text-right mt-6">
        <p className="text-xl font-semibold text-gray-800">
          Total: ${calculateTotal()}
        </p>
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
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isEditing ? "Save Changes" : "Create Invoice"}
        </Button>
      </div>
    </form>
  );
};

export default InvoiceForm;
