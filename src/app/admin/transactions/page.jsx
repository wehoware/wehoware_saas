import React from 'react';
import TransactionList from '@/components/transactions/TransactionList';

// Sample data - replace with actual data fetching logic
const sampleTransactions = [
  { id: 'TXN-001', date: '2024-05-10', description: 'Subscription Payment - Pro Plan', amount: 49.99, type: 'Subscription', status: 'Completed' },
  { id: 'TXN-002', date: '2024-05-09', description: 'Service Fee - Project Alpha', amount: 250.00, type: 'Service', status: 'Completed' },
  { id: 'TXN-003', date: '2024-05-08', description: 'Refund - Order #12345', amount: -20.00, type: 'Refund', status: 'Completed' },
  { id: 'TXN-004', date: '2024-05-07', description: 'Payout - April Earnings', amount: 1200.75, type: 'Payout', status: 'Pending' },
  { id: 'TXN-005', date: '2024-05-06', description: 'One-time Purchase - Add-on', amount: 15.00, type: 'Sale', status: 'Failed' },
];

const AdminTransactionsPage = () => {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Transactions</h1>
        <p className="text-sm md:text-base text-gray-600 mt-1">View and manage all financial transactions.</p>
      </header>
      
      <div className="mb-6">
        <input 
          type="text" 
          placeholder="Search transactions (e.g., ID, description)" 
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow duration-150"
        />
      </div>

      <TransactionList transactions={sampleTransactions} />
    </div>
  );
};

export default AdminTransactionsPage;
