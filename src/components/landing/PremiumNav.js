"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight } from "lucide-react";

const navItems = [
  { name: "Platform", href: "/#platform" },
  { name: "Solutions", href: "/#solutions" },
  { name: "Showcase", href: "/#showcase" },
  { name: "Pricing", href: "/#pricing" },
  { name: "About", href: "/about" },
];

export default function PremiumNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isAdminPage = pathname.startsWith("/admin") || pathname.startsWith("/print");
  if (isAdminPage) return null;

  return (
    <header className={`premium-nav ${isScrolled ? "premium-nav-scrolled" : ""}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#00d4ff] flex items-center justify-center text-white font-bold text-sm group-hover:scale-110 transition-transform" style={{ transition: "transform 0.3s" }}>
            W
          </div>
          <span className="text-lg font-bold text-white tracking-tight">Wehoware</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link key={item.name} href={item.href} className="premium-nav-link">
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="premium-nav-link">
            Sign in
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-gray-200 transition-colors"
          >
            Get Started <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <button
          className="md:hidden text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5 px-6 py-6 space-y-4">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="block text-gray-300 hover:text-white text-sm font-medium"
              onClick={() => setMobileOpen(false)}
            >
              {item.name}
            </Link>
          ))}
          <div className="pt-4 border-t border-white/5 space-y-3">
            <Link href="/login" className="block text-gray-400 text-sm" onClick={() => setMobileOpen(false)}>
              Sign in
            </Link>
            <Link
              href="/contact"
              className="block text-center px-4 py-2.5 rounded-lg bg-white text-black text-sm font-semibold"
              onClick={() => setMobileOpen(false)}
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
