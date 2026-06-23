"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import ScrollParallax from "@/components/gsap/ScrollParallax";
import MagneticButton from "@/components/gsap/MagneticButton";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden gradient-mesh noise-overlay pt-16">
      <div className="absolute inset-0 z-0 grid-bg-animated opacity-20" />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#050505]/40 via-transparent to-[#050505]" />

      <ScrollParallax speed={0.12} className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-[#3b82f6]/6 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[#00d4ff]/5 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#818cf8]/3 blur-[150px]" />
      </ScrollParallax>

      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full premium-badge mb-8">
            <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse" />
            <span>AI-Powered Development Platform</span>
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40, rotateX: 15 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
          style={{ perspective: 1200 }}
          className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight mb-6 leading-[1.05]"
        >
          Build the future
          <br />
          <span className="gradient-text-premium">with intelligence</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          The enterprise platform for engineering, deploying, and scaling
          software products. AI-assisted development, real-time collaboration,
          and infrastructure that grows with you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <MagneticButton>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-black font-semibold text-base hover:bg-gray-100 transition-colors"
              style={{ boxShadow: "0 0 40px rgba(255,255,255,0.1)" }}
            >
              Start Building <ArrowRight className="w-4 h-4" />
            </Link>
          </MagneticButton>
          <MagneticButton>
            <Link
              href="/#showcase"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl glass-card text-white font-semibold text-base hover:border-white/20 transition-colors"
            >
              <Play className="w-4 h-4" /> Watch Demo
            </Link>
          </MagneticButton>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease: [0.23, 1, 0.32, 1] }}
          className="mt-12 flex items-center justify-center gap-6 text-xs text-gray-500"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> 99.99% Uptime
          </span>
          <span className="w-px h-3 bg-white/10" />
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" /> SOC 2 Type II
          </span>
          <span className="w-px h-3 bg-white/10" />
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff]" /> GDPR Ready
          </span>
        </motion.div>
      </div>

      <ScrollParallax speed={0.5} className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <div className="float-soft">
          <div className="w-6 h-10 rounded-full border-2 border-white/15 flex justify-center pt-2">
            <div className="w-1 h-2 bg-white/30 rounded-full" />
          </div>
        </div>
      </ScrollParallax>
    </section>
  );
}
