"use client";

import { Check } from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";
import MagneticButton from "@/components/gsap/MagneticButton";
import Link from "next/link";

const plans = [
  {
    name: "Starter",
    price: "$2,500",
    period: "/mo",
    desc: "For startups validating their idea",
    features: ["1 active project", "Up to 5 team members", "Basic analytics", "Email support", "Community access"],
    highlight: false,
    color: "#818cf8",
  },
  {
    name: "Growth",
    price: "$5,900",
    period: "/mo",
    desc: "For scaling companies",
    features: ["5 active projects", "Up to 25 team members", "Advanced analytics", "Priority support", "Custom integrations", "API access"],
    highlight: true,
    color: "#00d4ff",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For large organizations",
    features: ["Unlimited projects", "Unlimited team members", "Custom dashboards", "Dedicated manager", "SLA guarantee", "On-premise option"],
    highlight: false,
    color: "#c084fc",
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-5" />
      <div className="glow-orb w-[500px] h-[500px] bg-[#3b82f6]/5 top-[20%] left-[30%]" />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="text-center mb-20">
          <ScrollReveal y={20}>
            <div className="cinematic-badge mb-6">
              <span>Pricing</span>
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1}>
            <h2 className="cinematic-headline mb-4">
              PRICING THAT <span className="cinematic-headline-accent">SCALES WITH YOU</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal y={20} delay={0.2}>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Transparent pricing. No hidden fees. Cancel anytime.
            </p>
          </ScrollReveal>
        </div>

        <ScrollReveal stagger={0.1} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <Scroll3DTilt
              key={p.name}
              max={p.highlight ? 4 : 8}
              className={`ai-module p-8 relative ${p.highlight ? "holo-shimmer-bg" : ""}`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#00d4ff] text-xs font-bold text-white whitespace-nowrap">
                  MOST POPULAR
                </div>
              )}
              <h3 className="text-xl font-bold text-white mb-1">{p.name}</h3>
              <p className="text-sm text-gray-500 mb-6">{p.desc}</p>
              <div className="mb-6">
                <span className="text-4xl font-black" style={{ color: p.color }}>{p.price}</span>
                <span className="text-gray-400">{p.period}</span>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-6" />
              <ul className="space-y-3 mb-8">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 shrink-0" style={{ color: p.color }} /> {f}
                  </li>
                ))}
              </ul>
              <MagneticButton>
                <Link
                  href="/contact"
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                    p.highlight
                      ? "btn-cinematic"
                      : "btn-cinematic-ghost"
                  }`}
                >
                  Get Started
                </Link>
              </MagneticButton>
            </Scroll3DTilt>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
