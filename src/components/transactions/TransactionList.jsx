import React from 'react';

const TransactionList = ({ transactions }) => {
  if (!transactions || transactions.length === 0) {
    return <p className="text-gray-600">No transactions found.</p>;
  }

  return (
    <div className="overflow-x-auto bg-white shadow-md rounded-lg">
      <table className="min-w-full">
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            <th className="py-3 px-4 text-left text-sm font-semibold">ID</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Date</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Description</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Amount</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Type</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="text-gray-700 divide-y divide-gray-200">
          {transactions.map((transaction) => (
            <tr key={transaction.id} className="hover:bg-gray-50">
              <td className="py-3 px-4 text-sm">{transaction.id}</td>
              <td className="py-3 px-4 text-sm">{new Date(transaction.date).toLocaleDateString()}</td>
              <td className="py-3 px-4 text-sm">{transaction.description}</td>
              <td className="py-3 px-4 text-sm">${transaction.amount.toFixed(2)}</td>
              <td className="py-3 px-4 text-sm">{transaction.type}</td>
              <td className="py-3 px-4 text-sm">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${transaction.status === 'Completed' ? 'bg-green-100 text-green-700' :
transaction.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
'bg-red-100 text-red-700' // Failed
                    }`}
                >
                  {transaction.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionList;
