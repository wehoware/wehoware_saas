import React from 'react';
import Link from 'next/link';

const InvoiceList = ({ invoices }) => {
  if (!invoices || invoices.length === 0) {
    return <p className="text-gray-600">No invoices found.</p>;
  }

  return (
    <div className="overflow-x-auto bg-white shadow-md rounded-lg">
      <table className="min-w-full">
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            <th className="py-3 px-4 text-left text-sm font-semibold">Invoice ID</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Client Name</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Amount</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Status</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Date</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700 divide-y divide-gray-200">
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-gray-50">
              <td className="py-3 px-4 text-sm">{invoice.id}</td>
              <td className="py-3 px-4 text-sm">{invoice.clientName}</td>
              <td className="py-3 px-4 text-sm">${invoice.amount.toFixed(2)}</td>
              <td className="py-3 px-4 text-sm">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${invoice.status === 'Paid' ? 'bg-green-100 text-green-700' :
invoice.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
'bg-red-100 text-red-700' // Overdue or Cancelled
                    }`}
                >
                  {invoice.status}
                </span>
              </td>
              <td className="py-3 px-4 text-sm">{new Date(invoice.date).toLocaleDateString()}</td>
              <td className="py-3 px-4 text-sm space-x-2">
                <Link href={`/admin/invoices/${invoice.id}`} legacyBehavior>
                  <a className="text-blue-600 hover:text-blue-800 font-medium transition duration-150">View</a>
                </Link>
                <Link href={`/admin/invoices/edit/${invoice.id}`} legacyBehavior>
                  <a className="text-yellow-600 hover:text-yellow-800 font-medium transition duration-150">Edit</a>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InvoiceList;
