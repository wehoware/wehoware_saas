import AdminLayout from '@/components/AdminLayout';

export const metadata = {
  title: 'Admin Dashboard - Wehoware',
  description: 'Secure admin portal for managing Wehoware website content',
};

export default function Layout({ children }) {
  return <AdminLayout>{children}</AdminLayout>;
}
