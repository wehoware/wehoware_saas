"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
  const pathname = usePathname();
  
  // Skip rendering footer on admin and print pages
  if (pathname.startsWith('/admin') || pathname.startsWith('/print')) {
    return null;
  }

  return (
    <footer className="bg-[#050505] border-t border-white/5">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 mt-12 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {/* Company Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4 gradient-text">Wehoware</h3>
            <p className="text-gray-400 mb-4">
              We architect, build, and scale software products and marketing systems that drive measurable growth for ambitious companies.
            </p>
            <div className="flex space-x-4">
              <Link href="#" className="text-gray-500 hover:text-[#00d4ff] transition-colors">
                <Facebook size={20} />
              </Link>
              <Link href="#" className="text-gray-500 hover:text-[#00d4ff] transition-colors">
                <Twitter size={20} />
              </Link>
              <Link href="#" className="text-gray-500 hover:text-[#00d4ff] transition-colors">
                <Instagram size={20} />
              </Link>
              <Link href="#" className="text-gray-500 hover:text-[#00d4ff] transition-colors">
                <Linkedin size={20} />
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-[#00d4ff]">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-gray-400 hover:text-[#00d4ff] transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-gray-400 hover:text-[#00d4ff] transition-colors">
                  Services
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-gray-400 hover:text-[#00d4ff] transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-gray-400 hover:text-[#00d4ff] transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-[#00d4ff] transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-[#00d4ff]">Our Services</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/services" className="text-gray-400 hover:text-[#00d4ff] transition-colors">
                  Web Development
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-gray-400 hover:text-[#00d4ff] transition-colors">
                  Mobile Apps
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-gray-400 hover:text-[#00d4ff] transition-colors">
                  Cloud & DevOps
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-gray-400 hover:text-[#00d4ff] transition-colors">
                  UI/UX Design
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-gray-400 hover:text-[#00d4ff] transition-colors">
                  SEO & Marketing
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-[#00d4ff]">Contact Us</h3>
            <ul className="space-y-4">
              <li className="flex items-start">
                <MapPin className="mr-2 h-5 w-5 text-[#3b82f6] shrink-0 mt-0.5" />
                <span className="text-gray-400">
                  123 Tech Plaza, Suite 500<br />
                  San Francisco, CA 94105
                </span>
              </li>
              <li className="flex items-center">
                <Phone className="mr-2 h-5 w-5 text-[#3b82f6]" />
                <a href="tel:+12345678900" className="text-gray-400 hover:text-[#00d4ff] transition-colors">
                  +1 (234) 567-8900
                </a>
              </li>
              <li className="flex items-center">
                <Mail className="mr-2 h-5 w-5 text-[#3b82f6]" />
                <a href="mailto:hello@wehoware.com" className="text-gray-400 hover:text-[#00d4ff] transition-colors">
                  hello@wehoware.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} Wehoware Technologies. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="/privacy-policy" className="text-sm text-gray-500 hover:text-[#00d4ff] transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms-of-service" className="text-sm text-gray-500 hover:text-[#00d4ff] transition-colors">
                Terms of Service
              </Link>
              <Link href="/disclaimer" className="text-sm text-gray-500 hover:text-[#00d4ff] transition-colors">
                Disclaimer
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
