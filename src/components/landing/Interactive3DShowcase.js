"use client";

import { useState } from "react";
import { ArrowRight, BarChart3, Cpu, ShoppingCart, HeartPulse } from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";
import ScrollParallax from "@/components/gsap/ScrollParallax";

const projects = [
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
    gradient: "from-blue-600/20 via-cyan-500/10 to-transparent",
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
    gradient: "from-purple-600/20 via-indigo-500/10 to-transparent",
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
    gradient: "from-green-600/20 via-emerald-500/10 to-transparent",
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
    gradient: "from-rose-600/20 via-pink-500/10 to-transparent",
  },
];

export default function Interactive3DShowcase() {
  const [active, setActive] = useState(0);

  return (
    <section id="showcase" className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 gradient-mesh opacity-30" />
      <ScrollParallax speed={0.08} className="absolute top-1/4 right-0 w-96 h-96 rounded-full bg-[#818cf8]/5 blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <ScrollReveal y={20} rotateX={10}>
            <span className="section-label mb-6">Showcase</span>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1} rotateX={15}>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight mt-6 mb-4">
              Projects that
              <br />
              <span className="gradient-text-premium">define industries</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal y={20} delay={0.2} opacity={0}>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Explore our portfolio of enterprise-grade products trusted by millions of users.
            </p>
          </ScrollReveal>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-8">
          <div className="space-y-2">
            {projects.map((p, i) => {
              const Icon = p.icon;
              return (
                <ScrollReveal key={p.title} y={15} delay={i * 0.05} opacity={0}>
                  <button
                    onClick={() => setActive(i)}
                    className={`w-full text-left p-4 rounded-xl transition-all duration-300 flex items-center gap-3 ${
                      active === i
                        ? "glass-card border-[#3b82f6]/30 bg-white/5"
                        : "hover:bg-white/2 border border-transparent"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      active === i ? "bg-gradient-to-br from-[#3b82f6]/30 to-[#00d4ff]/20" : "bg-white/5"
                    }`}>
                      <Icon className={`w-5 h-5 ${active === i ? "text-[#60a5fa]" : "text-gray-500"}`} />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-sm font-semibold truncate ${active === i ? "text-white" : "text-gray-400"}`}>
                        {p.title}
                      </div>
                      <div className="text-xs text-gray-500">{p.category}</div>
                    </div>
                  </button>
                </ScrollReveal>
              );
            })}
          </div>

          <ScrollReveal y={30} rotateX={8} scale={0.98}>
            <Scroll3DTilt max={5} className="showcase-card p-8 lg:p-12 min-h-[500px] flex flex-col">
              <div className={`absolute inset-0 bg-gradient-to-br ${projects[active].gradient} pointer-events-none`} />

              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <span className="premium-badge mb-3">{projects[active].category}</span>
                    <h3 className="text-3xl font-bold text-white mt-3">{projects[active].title}</h3>
                  </div>
                </div>

                <p className="text-gray-400 text-lg leading-relaxed mb-8">
                  {projects[active].desc}
                </p>

                <div className="grid grid-cols-3 gap-4 mb-8">
                  {projects[active].metrics.map((m) => (
                    <div key={m.label} className="glass-card p-4 rounded-xl text-center">
                      <div className="text-2xl font-bold gradient-text-premium">{m.value}</div>
                      <div className="text-xs text-gray-500 mt-1">{m.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 mb-8">
                  {projects[active].tags.map((tag) => (
                    <span key={tag} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-auto">
                  <a
                    href="/contact"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:gap-3 transition-all"
                  >
                    View case study <ArrowRight className="w-4 h-4 text-[#60a5fa]" />
                  </a>
                </div>
              </div>
            </Scroll3DTilt>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
