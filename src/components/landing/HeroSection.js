"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Cpu, Cloud, BarChart3 } from "lucide-react";
import MagneticButton from "@/components/gsap/MagneticButton";

const AICoreScene = dynamic(() => import("@/components/three/AICoreScene"), {
  ssr: false,
});

const floatingMetrics = [
  { label: "AI Models", value: "32+", icon: Cpu, position: "top-[15%] left-[8%]", delay: 0.8 },
  { label: "Uptime", value: "99.99%", icon: Cloud, position: "top-[25%] right-[10%]", delay: 1.0 },
  { label: "Projects", value: "150+", icon: BarChart3, position: "bottom-[20%] left-[12%]", delay: 1.2 },
  { label: "Latency", value: "47ms", icon: Sparkles, position: "bottom-[28%] right-[8%]", delay: 1.4 },
];

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* 3D AI Core scene */}
      <div className="absolute inset-0 z-0">
        <AICoreScene />
      </div>

      {/* Volumetric lighting */}
      <div className="volumetric-light z-0" />

      {/* Gradient overlays */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#030308]/60 via-transparent to-[#030308]" />
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#030308]/40 via-transparent to-[#030308]/40" />

      {/* Floating metric badges */}
      {floatingMetrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: metric.delay, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute ${metric.position} z-10 hidden lg:block`}
          >
            <div className="holo-glass px-4 py-3 float-organic" style={{ animationDelay: `${metric.delay}s` }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3b82f6]/20 to-[#00d4ff]/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-[#60a5fa]" />
                </div>
                <div>
                  <div className="text-lg font-bold gradient-text-cinematic leading-none">{metric.value}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{metric.label}</div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* Main content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="cinematic-badge mb-8">
            <span>Elite Software Innovation Lab</span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="cinematic-headline mb-6"
        >
          BUILDING THE FUTURE
          <br />
          <span className="cinematic-headline-accent">OF SOFTWARE</span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap justify-center gap-3 mb-10"
        >
          {["Custom Software", "AI Systems", "SaaS Products", "Growth Platforms"].map((tag) => (
            <span
              key={tag}
              className="px-4 py-1.5 rounded-full text-sm font-medium text-gray-300 border border-white/10 bg-white/[0.02] backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <MagneticButton>
            <Link href="/contact" className="btn-cinematic">
              Start Your Project <ArrowRight className="w-4 h-4" />
            </Link>
          </MagneticButton>
          <MagneticButton>
            <Link href="/#showcase" className="btn-cinematic-ghost">
              Explore Our Work
            </Link>
          </MagneticButton>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <div className="float-soft">
          <div className="w-6 h-10 rounded-full border-2 border-white/15 flex justify-center pt-2">
            <div className="w-1 h-2 bg-[#00d4ff] rounded-full" />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
