"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeProvider } from '@/components/theme-provider';
import { useAuth } from '@/contexts/auth-context';
import AdminHeader from '@/components/AdminHeader';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  MessageSquare,
  Search,
  Settings,
  LogOut,
  Menu,
  X,
  FormInput,
  Link as LinkIcon,
  BarChart,
  Users,
  Building
} from 'lucide-react';

// Common sidebar items for all roles
const commonSidebarItems = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    title: 'Services',
    href: '/admin/services',
    icon: <Briefcase className="h-5 w-5" />,
  },
  {
    title: 'Blogs',
    href: '/admin/blogs',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    title: 'SEO',
    href: '/admin/seo',
    icon: <Search className="h-5 w-5" />,
  },
  {
    title: 'Inquiries',
    href: '/admin/inquiries',
    icon: <MessageSquare className="h-5 w-5" />,
  },
  {
    title: 'Integrations',
    href: '/admin/integrations',
    icon: <LinkIcon className="h-5 w-5" />,
  },
  {
    title: 'Forms',
    href: '/admin/forms',
    icon: <FormInput className="h-5 w-5" />,
  },
  { 
    title: 'Reports',
    href: '/admin/reports',
    icon: <BarChart className="h-5 w-5" />,
  },
  {
    title: 'Settings',
    href: '/admin/settings',
    icon: <Settings className="h-5 w-5" />,
  },
];

// Employee-only sidebar items
const employeeOnlySidebarItems = [
  {
    title: 'Clients',
    href: '/admin/clients',
    icon: <Building className="h-5 w-5" />,
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: <Users className="h-5 w-5" />,
  },
  {
    title: 'Forms',
    href: '/admin/forms',
    icon: <FormInput className="h-5 w-5" />,
  },
  {
    title: 'Integrations',
    href: '/admin/integrations',
    icon: <LinkIcon className="h-5 w-5" />,
  },
];

const AdminLayout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const { user, loading: isLoading, logout, isEmployee } = useAuth();
  
  // Determine which sidebar items to show based on role
  const sidebarItems = [...commonSidebarItems];
  
  // Add employee-only items for employees/admins
  if (isEmployee) {
    sidebarItems.splice(1, 0, ...employeeOnlySidebarItems);
  }
  
  // Handle screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    // Initial check
    checkScreenSize();

    // Add event listener
    window.addEventListener('resize', checkScreenSize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">
          <svg
            className="w-12 h-12"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
          </svg>
        </div>
      </div>
    );
  }
  
  // Redirect if not authenticated
  if (!isLoading && !user) {
    return null; // Auth context will handle the redirect
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <div className="min-h-screen flex bg-background">
        {/* Sidebar */}
        <div
          className={`${isSidebarOpen ? 'w-64' : 'w-0 lg:w-16'} 
          fixed inset-y-0 z-50 flex flex-col transition-all duration-300 
          bg-muted/40 backdrop-blur-xl border-r border-gray-200 shadow-md`}
        >
          <div className="flex h-16 items-center justify-between px-4">
            {isSidebarOpen && (
              <Link 
                href="/admin" 
                className="flex items-center gap-2 font-semibold"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                >
                  <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
                </svg>
                <span className="text-xl">Wehoware</span>
              </Link>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden" 
              onClick={toggleSidebar}
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
          <ScrollArea className="flex-1 overflow-auto py-2">
            <nav className="grid gap-1 px-2">
              {sidebarItems.map((item, index) => (
                <Link
                  key={index}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all 
                  ${pathname === item.href 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-accent/50 text-muted-foreground hover:text-accent-foreground'} 
                  ${!isSidebarOpen && 'justify-center'}`}
                >
                  {item.icon}
                  {isSidebarOpen && <span>{item.title}</span>}
                </Link>
              ))}
            </nav>
          </ScrollArea>
          <div className="mt-auto p-4">
            <ModeToggle />
            <Button 
              variant="outline" 
              className={`mt-4 w-full ${!isSidebarOpen && 'justify-center p-0 h-10 w-10'}`}
              onClick={logout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {isSidebarOpen && <span>Logout</span>}
            </Button>
          </div>
        </div>

        {/* Mobile sidebar backdrop */}
        {isMobile && isSidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" 
            onClick={toggleSidebar}
          />
        )}

        {/* Main content */}
        <div className={`flex-1 overflow-auto ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}>
          {/* Admin Header with client dropdown */}
          <AdminHeader />
          
          <main className="grid flex-1 items-start gap-4 p-4 sm:p-6 md:gap-8">
            <div className="w-full rounded-xl border border-gray-200 bg-card shadow-md p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default AdminLayout;
