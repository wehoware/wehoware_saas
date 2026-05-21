"use client";

import React from "react";
import Link from "next/link";
import { formatInvoiceDate } from "@/lib/invoiceFormat";

const STATUS_CLASS = {
  Paid: "bg-green-100 text-green-700",
  Pending: "bg-yellow-100 text-yellow-700",
  Draft: "bg-gray-100 text-gray-700",
  Overdue: "bg-red-100 text-red-700",
  Cancelled: "bg-gray-200 text-gray-600",
};

/**
 * Lightweight presentational table for invoices.
 * Consumes the canonical API shape: snake_case fields with `total` numeric and
 * separate `invoice_date` / `due_date` ISO date strings.
 */
const InvoiceList = ({ invoices }) => {
  if (!invoices || invoices.length === 0) {
    return <p className="text-gray-600">No invoices found.</p>;
  }

  return (
    <div className="overflow-x-auto bg-white shadow-md rounded-lg">
      <table className="min-w-full">
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            <th className="py-3 px-4 text-left text-sm font-semibold">Invoice #</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Client</th>
            <th className="py-3 px-4 text-right text-sm font-semibold">Amount</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Status</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Invoice Date</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Due Date</th>
            <th className="py-3 px-4 text-right text-sm font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700 divide-y divide-gray-200">
          {invoices.map((invoice) => {
            const statusClass =
              STATUS_CLASS[invoice.status] ?? "bg-gray-100 text-gray-700";
            const currency = invoice.currency || "";
            const total = Number(invoice.total ?? invoice.amount ?? 0);
            return (
              <tr key={invoice.id} className="hover:bg-gray-50">
                <td className="py-3 px-4 text-sm font-medium">
                  {invoice.invoice_number ?? invoice.id}
                </td>
                <td className="py-3 px-4 text-sm">
                  <div>{invoice.client_name ?? invoice.clientName ?? "—"}</div>
                  {invoice.client_email && (
                    <div className="text-xs text-gray-500">{invoice.client_email}</div>
                  )}
                </td>
                <td className="py-3 px-4 text-sm text-right">
                  {currency} {total.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-sm">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${statusClass}`}
                  >
                    {invoice.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm">
                  {formatInvoiceDate(invoice.invoice_date)}
                </td>
                <td className="py-3 px-4 text-sm">
                  {formatInvoiceDate(invoice.due_date)}
                </td>
                <td className="py-3 px-4 text-sm text-right space-x-3">
                  <Link
                    href={`/admin/accounting/invoices/${invoice.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium transition duration-150"
                  >
                    View
                  </Link>
                  <Link
                    href={`/admin/accounting/invoices/edit/${invoice.id}`}
                    className="text-yellow-600 hover:text-yellow-800 font-medium transition duration-150"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default InvoiceList;
