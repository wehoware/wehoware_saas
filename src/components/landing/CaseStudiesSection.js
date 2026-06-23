"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";

const cases = [
  {
    title: "FinTech Dashboard",
    category: "Web App",
    result: "+300% user engagement",
    desc: "Real-time trading platform with WebSocket feeds and advanced charting",
    gradient: "from-blue-600/20 to-cyan-500/20",
  },
  {
    title: "E-Commerce Engine",
    category: "Retail",
    result: "+45% conversion rate",
    desc: "Headless commerce with AI-powered product recommendations",
    gradient: "from-purple-600/20 to-blue-500/20",
  },
  {
    title: "Healthcare Portal",
    category: "SaaS",
    result: "10k+ active users",
    desc: "HIPAA-compliant patient management with telemedicine integration",
    gradient: "from-cyan-500/20 to-teal-500/20",
  },
];

export default function CaseStudiesSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-10" />
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <ScrollReveal y={20} rotateX={10}>
            <div className="inline-block px-3 py-1 rounded-full glass-card text-sm text-[#00d4ff] mb-4">
              Case Studies
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1} rotateX={15}>
            <h2 className="text-4xl md:text-5xl font-bold">
              Proven <span className="gradient-text">Results</span>
            </h2>
          </ScrollReveal>
        </div>

        <ScrollReveal stagger={0.12} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cases.map((c, i) => (
            <Scroll3DTilt key={i} max={10} className="glass-card p-1 group block">
              <Link href="/services" className="block h-full">
                <div className={`rounded-xl bg-gradient-to-br ${c.gradient} p-6 h-full`}>
                  <div className="text-xs text-[#00d4ff] mb-2 uppercase tracking-wider">{c.category}</div>
                  <h3 className="text-2xl font-bold text-gray-100 mb-3">{c.title}</h3>
                  <p className="text-gray-400 text-sm mb-4">{c.desc}</p>
                  <div className="text-lg font-bold gradient-text mb-4">{c.result}</div>
                  <div className="text-sm text-[#60a5fa] inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                    View case study <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            </Scroll3DTilt>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
