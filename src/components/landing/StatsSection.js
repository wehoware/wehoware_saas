"use client";

import ScrollReveal from "@/components/gsap/ScrollReveal";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";
import CountUp from "@/components/gsap/CountUp";

const stats = [
  { value: 150, suffix: "+", label: "Projects Delivered" },
  { value: 50, suffix: "+", label: "Enterprise Clients" },
  { value: 99.9, suffix: "%", label: "Uptime SLA", decimals: 1 },
  { value: 4.9, suffix: "/5", label: "Client Rating", decimals: 1 },
];

export default function StatsSection() {
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 gradient-mesh opacity-40" />
      <div className="absolute inset-0 grid-bg-animated opacity-20" />
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <ScrollReveal stagger={0.12} className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <Scroll3DTilt key={i} max={8} className="premium-card p-8 text-center">
              <div className="stat-number gradient-text-premium mb-3">
                <CountUp end={s.value} suffix={s.suffix} decimals={s.decimals || 0} />
              </div>
              <div className="text-sm text-gray-400 uppercase tracking-wider">{s.label}</div>
            </Scroll3DTilt>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
