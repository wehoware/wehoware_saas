"use client";

import { Star, Quote } from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";

const testimonials = [
  { name: "Sarah Chen", role: "CTO, FinFlow", text: "Wehoware rebuilt our trading platform from scratch. Performance improved 10x and we launched in 3 months.", rating: 5, color: "#3b82f6" },
  { name: "Marcus Reid", role: "CEO, ShopWave", text: "Their team understood our vision immediately. The e-commerce engine they built doubled our conversion rate.", rating: 5, color: "#00d4ff" },
  { name: "Dr. Amara Okafor", role: "Founder, MedBridge", text: "HIPAA compliance was critical. Wehoware delivered a secure, beautiful patient portal that our users love.", rating: 5, color: "#818cf8" },
  { name: "James Park", role: "VP Eng, DataSync", text: "Best dev partner we have worked with. Their SaaS platform saved us 6 months of internal development.", rating: 5, color: "#34d399" },
];

export default function TestimonialsSection() {
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-5" />
      <div className="glow-orb w-[400px] h-[400px] bg-[#818cf8]/5 top-[20%] right-[15%]" />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="text-center mb-20">
          <ScrollReveal y={20}>
            <div className="cinematic-badge mb-6">
              <span>Client Voices</span>
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1}>
            <h2 className="cinematic-headline mb-4">
              TRUSTED BY <span className="cinematic-headline-accent">LEADERS</span>
            </h2>
          </ScrollReveal>
        </div>

        <ScrollReveal stagger={0.1} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testimonials.map((t) => (
            <Scroll3DTilt key={t.name} max={6} className="ai-module p-8 relative">
              <Quote className="w-8 h-8 absolute top-6 right-6" style={{ color: `${t.color}30` }} />
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-current" style={{ color: t.color }} />
                ))}
              </div>
              <p className="text-gray-300 mb-6 text-lg leading-relaxed">&ldquo;{t.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}80)`, boxShadow: `0 0 20px ${t.color}30` }}
                >
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-white">{t.name}</div>
                  <div className="text-sm text-gray-500">{t.role}</div>
                </div>
              </div>
            </Scroll3DTilt>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
