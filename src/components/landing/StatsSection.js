"use client";

import ScrollReveal from "@/components/gsap/ScrollReveal";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";
import CountUp from "@/components/gsap/CountUp";

const stats = [
  { value: 150, suffix: "+", label: "Projects Delivered", color: "#3b82f6" },
  { value: 50, suffix: "+", label: "Enterprise Clients", color: "#00d4ff" },
  { value: 99.9, suffix: "%", label: "Uptime SLA", decimals: 1, color: "#818cf8" },
  { value: 4.9, suffix: "/5", label: "Client Rating", decimals: 1, color: "#34d399" },
];

export default function StatsSection() {
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-5" />
      <div className="glow-orb w-[500px] h-[500px] bg-[#3b82f6]/5 top-[30%] left-[30%]" />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <ScrollReveal y={20}>
            <div className="cinematic-badge mb-6">
              <span>By the Numbers</span>
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1}>
            <h2 className="cinematic-headline mb-4">
              PROVEN IMPACT
            </h2>
          </ScrollReveal>
        </div>

        <ScrollReveal stagger={0.12} className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <Scroll3DTilt key={s.label} max={8} className="ai-module holo-shimmer-bg p-8 text-center">
              <div className="stat-number mb-3 text-5xl font-black" style={{ color: s.color }}>
                <CountUp end={s.value} suffix={s.suffix} decimals={s.decimals || 0} />
              </div>
              <div className="text-sm text-gray-400 uppercase tracking-wider">{s.label}</div>
              {/* Data stream indicator */}
              <div className="mt-4 flex items-center gap-1 justify-center">
                {Array.from({ length: 12 }).map((_, j) => (
                  <div
                    key={j}
                    className="w-1 h-1 rounded-full"
                    style={{
                      background: s.color,
                      opacity: 0.2 + (j / 12) * 0.8,
                    }}
                  />
                ))}
              </div>
            </Scroll3DTilt>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
