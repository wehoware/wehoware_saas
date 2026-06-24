"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, BarChart3, Cpu, ShoppingCart, HeartPulse } from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";

const vault = [
  {
    title: "Real-Time Trading Platform",
    category: "FinTech",
    icon: BarChart3,
    desc: "WebSocket-powered trading dashboard with sub-50ms latency, advanced charting, and real-time portfolio analytics.",
    metrics: [
      { label: "Latency", value: "47ms" },
      { label: "Uptime", value: "99.99%" },
      { label: "Daily Trades", value: "2.4M" },
    ],
    tags: ["React", "WebSocket", "Redis", "TimescaleDB"],
    color: "#3b82f6",
    glow: "rgba(59,130,246,0.2)",
  },
  {
    title: "AI Content Engine",
    category: "AI / ML",
    icon: Cpu,
    desc: "GPT-4 powered content generation platform with multi-language support, brand voice training, and SEO optimization.",
    metrics: [
      { label: "Languages", value: "32" },
      { label: "Avg Gen Time", value: "1.2s" },
      { label: "Content/Mo", value: "50M+" },
    ],
    tags: ["Next.js", "OpenAI", "Pinecone", "Vercel"],
    color: "#00d4ff",
    glow: "rgba(0,212,255,0.2)",
  },
  {
    title: "Headless E-Commerce",
    category: "Retail",
    icon: ShoppingCart,
    desc: "Composable commerce architecture with edge-rendered storefronts, AI recommendations, and multi-region inventory.",
    metrics: [
      { label: "Conversion", value: "+45%" },
      { label: "Page Speed", value: "0.8s" },
      { label: "SKUs", value: "1.2M" },
    ],
    tags: ["Next.js", "Shopify", "Algolia", "Stripe"],
    color: "#818cf8",
    glow: "rgba(129,140,248,0.2)",
  },
  {
    title: "Healthcare Portal",
    category: "HealthTech",
    icon: HeartPulse,
    desc: "HIPAA-compliant patient management system with telemedicine, scheduling, and AI-assisted diagnostics.",
    metrics: [
      { label: "Active Users", value: "10k+" },
      { label: "Compliance", value: "100%" },
      { label: "Telemed Visits", value: "500k" },
    ],
    tags: ["React", "WebRTC", "AWS", "Python"],
    color: "#34d399",
    glow: "rgba(52,211,153,0.2)",
  },
];

export default function Interactive3DShowcase() {
  const [active, setActive] = useState(0);

  return (
    <section id="showcase" className="relative py-32 overflow-hidden">
      {/* Ambient glow */}
      <div className="glow-orb w-[600px] h-[600px] bg-[#818cf8]/5 top-[15%] right-[10%]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-20">
          <ScrollReveal y={20}>
            <div className="cinematic-badge mb-6">
              <span>Product Vault</span>
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1}>
            <h2 className="cinematic-headline mb-4">
              PRODUCTS THAT <span className="cinematic-headline-accent">DEFINE INDUSTRIES</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal y={20} delay={0.2}>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Explore our vault of enterprise-grade products trusted by millions of users worldwide.
            </p>
          </ScrollReveal>
        </div>

        {/* Vault layout */}
        <div className="grid lg:grid-cols-[320px_1fr] gap-8">
          {/* Vault selector */}
          <div className="space-y-3">
            {vault.map((item, i) => {
              const Icon = item.icon;
              return (
                <ScrollReveal key={item.title} y={15} delay={i * 0.05}>
                  <button
                    onClick={() => setActive(i)}
                    className={`vault-item w-full text-left p-5 rounded-2xl transition-all duration-500 flex items-center gap-4 ${
                      active === i ? "vault-item-active" : ""
                    }`}
                    style={active === i ? { borderColor: `${item.color}40`, background: `${item.color}08` } : {}}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500"
                      style={{
                        background: active === i ? `linear-gradient(135deg, ${item.color}30, ${item.color}10)` : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active === i ? item.color + "40" : "rgba(255,255,255,0.05)"}`,
                      }}
                    >
                      <Icon className="w-6 h-6" style={{ color: active === i ? item.color : "#666" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-bold truncate transition-colors ${active === i ? "text-white" : "text-gray-400"}`}>
                        {item.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.category}</div>
                    </div>
                    {active === i && (
                      <motion.div
                        layoutId="vault-indicator"
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: item.color }}
                      />
                    )}
                  </button>
                </ScrollReveal>
              );
            })}
          </div>

          {/* Vault display */}
          <ScrollReveal y={30} delay={0.1}>
            <Scroll3DTilt max={6}>
              <div className="vault-display relative min-h-[520px] overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -30, filter: "blur(10px)" }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10 p-8 lg:p-12 h-full flex flex-col"
                  >
                    {/* Background glow */}
                    <div
                      className="absolute inset-0 opacity-30 pointer-events-none"
                      style={{ background: `radial-gradient(circle at 50% 50%, ${vault[active].glow}, transparent 70%)` }}
                    />

                    {/* Category badge */}
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: vault[active].color }} />
                      <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: vault[active].color }}>
                        {vault[active].category}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-3xl lg:text-4xl font-black text-white mb-6">{vault[active].title}</h3>

                    {/* Description */}
                    <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-2xl">{vault[active].desc}</p>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-4 mb-10">
                      {vault[active].metrics.map((m) => (
                        <div key={m.label} className="holo-glass p-5 text-center">
                          <div className="text-3xl font-black mb-1" style={{ color: vault[active].color }}>
                            {m.value}
                          </div>
                          <div className="text-xs text-gray-500 uppercase tracking-wider">{m.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Tech tags */}
                    <div className="flex flex-wrap gap-2 mb-10">
                      {vault[active].tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-white/[0.03] border border-white/5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* CTA */}
                    <div className="mt-auto">
                      <a
                        href="/contact"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-white group"
                      >
                        <span>View case study</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" style={{ color: vault[active].color }} />
                      </a>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Corner accents */}
                <div className="vault-corner top-0 left-0" style={{ borderColor: vault[active].color }} />
                <div className="vault-corner top-0 right-0" style={{ borderColor: vault[active].color }} />
                <div className="vault-corner bottom-0 left-0" style={{ borderColor: vault[active].color }} />
                <div className="vault-corner bottom-0 right-0" style={{ borderColor: vault[active].color }} />
              </div>
            </Scroll3DTilt>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
