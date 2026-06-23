"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const navItems = [
  { name: 'Home', href: '/' },
  { name: 'Services', href: '/services' },
  { name: 'Blog', href: '/blog' },
  { name: 'Contact', href: '/contact' },
  { name: 'About', href: '/about' },
];

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Handle admin and print paths specially
  const isAdminPage = pathname.startsWith('/admin') || pathname.startsWith('/print');
  // Landing page uses PremiumNav instead
  const isLandingPage = pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const isActive = (path) => pathname === path;

  // Don't render the header on admin pages or landing page
  if (isAdminPage || isLandingPage) return null;
  
  return (
    <header className={`header ${isScrolled ? 'header-scrolled' : ''}`}>
      <div className="container header-content">
        {/* Logo */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/" className="logo">
            <span className="gradient-text">Wehoware</span>
          </Link>
        </motion.div>

        {/* Desktop Navigation */}
        <nav className="nav-desktop">
          {navItems.map((item, index) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link 
                href={item.href}
                className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
              >
                {item.name}
              </Link>
            </motion.div>
          ))}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: navItems.length * 0.1 }}
          >
            <Link 
              href="/login" 
              className="btn-glow"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
            >
              Login
            </Link>
          </motion.div>
        </nav>

        {/* Mobile Menu Button */}
        <button 
          className="mobile-menu-button" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Menu"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div 
          className="mobile-menu"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          <nav>
            {navItems.map((item) => (
              <Link 
                key={item.name} 
                href={item.href}
                className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <Link 
              href="/login" 
              className="btn-glow"
              style={{display: 'block', marginTop: '1rem', textAlign: 'center', padding: '0.5rem 1.25rem', fontSize: '0.875rem'}}
              onClick={() => setMobileMenuOpen(false)}
            >
              Login
            </Link>
          </nav>
        </motion.div>
      )}
    </header>
  );
};

export default Header;
