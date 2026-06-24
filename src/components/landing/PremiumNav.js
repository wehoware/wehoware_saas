"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight } from "lucide-react";

const navItems = [
  { name: "Ecosystem", href: "/#solutions" },
  { name: "Process", href: "/#process" },
  { name: "Vault", href: "/#showcase" },
  { name: "AI Core", href: "/#ai-command" },
  { name: "Growth", href: "/#growth" },
  { name: "Pricing", href: "/#pricing" },
  { name: "About", href: "/about" },
];

export default function PremiumNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const navRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (navRef.current) {
        const rect = navRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left - rect.width / 2,
          y: e.clientY - rect.top - rect.height / 2,
        });
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const isAdminPage = pathname.startsWith("/admin") || pathname.startsWith("/print");
  if (isAdminPage) return null;

  return (
    <header
      ref={navRef}
      className={`cinematic-nav ${isScrolled ? "cinematic-nav-scrolled" : ""}`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo with magnetic effect */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#00d4ff] flex items-center justify-center text-white font-bold text-sm transition-all duration-300 group-hover:scale-110"
            style={{
              boxShadow: "0 0 20px rgba(59,130,246,0.3)",
              transform: `translate(${mousePos.x * 0.02}px, ${mousePos.y * 0.02}px)`,
            }}
          >
            W
          </div>
          <span className="text-lg font-bold text-white tracking-tight">Wehoware</span>
        </Link>

        {/* Desktop nav with magnetic links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="cinematic-nav-link"
            >
              {item.name}
            </Link>
          ))}
        </nav>

        {/* CTA buttons */}
        <div className="hidden lg:flex items-center gap-3">
          <Link href="/login" className="cinematic-nav-link">
            Sign in
          </Link>
          <Link href="/contact" className="btn-cinematic-sm">
            Get Started <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="lg:hidden text-white p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden absolute top-16 left-0 right-0 bg-[#030308]/95 backdrop-blur-2xl border-b border-white/5 px-6 py-6 space-y-3">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="block text-gray-300 hover:text-white text-sm font-medium py-2"
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
              className="block text-center px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#00d4ff] text-white text-sm font-semibold"
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
