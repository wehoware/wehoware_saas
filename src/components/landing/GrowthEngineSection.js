"use client";

import { motion } from "framer-motion";
import { TrendingUp, Search, Share2, Mail, Target, BarChart3, ArrowUpRight, Zap } from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";

const growthChannels = [
  {
    icon: Search,
    title: "SEO Engineering",
    metric: "+340%",
    metricLabel: "Organic Traffic",
    description: "Technical SEO, content engineering, and programmatic page generation at scale.",
    color: "#3b82f6",
  },
  {
    icon: Share2,
    title: "Social Amplification",
    metric: "2.1M",
    metricLabel: "Monthly Reach",
    description: "Data-driven social strategies with AI-generated content and automated scheduling.",
    color: "#00d4ff",
  },
  {
    icon: Mail,
    title: "Email Automation",
    metric: "48%",
    metricLabel: "Open Rate",
    description: "Behavioral email sequences with AI-personalized content and predictive send timing.",
    color: "#818cf8",
  },
  {
    icon: Target,
    title: "Paid Acquisition",
    metric: "3.2x",
    metricLabel: "ROAS",
    description: "Programmatic ad optimization with real-time bidding and AI-driven creative testing.",
    color: "#c084fc",
  },
];

const growthMetrics = [
  { month: "Jan", value: 30 },
  { month: "Feb", value: 45 },
  { month: "Mar", value: 55 },
  { month: "Apr", value: 70 },
  { month: "May", value: 85 },
  { month: "Jun", value: 100 },
];

export default function GrowthEngineSection() {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Ambient glow */}
      <div className="glow-orb w-[600px] h-[600px] bg-[#3b82f6]/5 top-[20%] left-[20%]" />
      <div className="glow-orb w-[400px] h-[400px] bg-[#00d4ff]/5 bottom-[30%] right-[15%]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-20">
          <ScrollReveal y={20}>
            <div className="cinematic-badge mb-6">
              <span>Growth Engine</span>
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1}>
            <h2 className="cinematic-headline mb-4">
              ENGINEERED FOR <span className="cinematic-headline-accent">GROWTH</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal y={20} delay={0.2}>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Marketing isn&apos;t an afterthought. It&apos;s a data-driven growth engine built into your product.
            </p>
          </ScrollReveal>
        </div>

        {/* Growth chart visualization */}
        <ScrollReveal y={40}>
          <div className="holo-glass p-8 mb-12">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Growth Trajectory</div>
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-[#00d4ff]" />
                  <span className="text-3xl font-black gradient-text-cinematic">+233%</span>
                  <span className="text-sm text-gray-500">in 6 months</span>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#34d399]/10 border border-[#34d399]/20">
                <div className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse" />
                <span className="text-xs font-semibold text-[#34d399] uppercase tracking-wider">Live</span>
              </div>
            </div>

            {/* Bar chart */}
            <div className="flex items-end justify-between gap-4 h-48">
              {growthMetrics.map((m, i) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-3">
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    whileInView={{ height: `${m.value}%`, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full rounded-t-lg relative group cursor-pointer"
                    style={{
                      background: `linear-gradient(180deg, #00d4ff, #3b82f6)`,
                      boxShadow: "0 0 20px rgba(0,212,255,0.2)",
                    }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-bold text-white whitespace-nowrap">{m.value}%</span>
                    </div>
                  </motion.div>
                  <span className="text-xs text-gray-500">{m.month}</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Channel cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {growthChannels.map((channel, i) => {
            const Icon = channel.icon;
            return (
              <ScrollReveal key={channel.title} y={30} delay={i * 0.08}>
                <Scroll3DTilt max={8}>
                  <div className="ai-module h-full group">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                      style={{
                        background: `linear-gradient(135deg, ${channel.color}20, ${channel.color}05)`,
                        border: `1px solid ${channel.color}30`,
                      }}
                    >
                      <Icon className="w-6 h-6" style={{ color: channel.color }} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{channel.title}</h3>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-3xl font-black" style={{ color: channel.color }}>{channel.metric}</span>
                      <ArrowUpRight className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-4">{channel.metricLabel}</div>
                    <p className="text-sm text-gray-400 leading-relaxed">{channel.description}</p>
                  </div>
                </Scroll3DTilt>
              </ScrollReveal>
            );
          })}
        </div>

        {/* Bottom highlight bar */}
        <ScrollReveal y={20} delay={0.2}>
          <div className="holo-glass mt-12 p-6 flex flex-wrap items-center justify-center gap-8 text-center">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-[#00d4ff]" />
              <span className="text-sm text-gray-300">AI-Powered Content Generation</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-[#3b82f6]" />
              <span className="text-sm text-gray-300">Real-Time Analytics Dashboard</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-[#818cf8]" />
              <span className="text-sm text-gray-300">Predictive Audience Targeting</span>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
