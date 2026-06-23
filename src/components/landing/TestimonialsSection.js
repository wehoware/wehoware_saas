"use client";

import { Star, Quote } from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";

const testimonials = [
  { name: "Sarah Chen", role: "CTO, FinFlow", text: "Wehoware rebuilt our trading platform from scratch. Performance improved 10x and we launched in 3 months.", rating: 5 },
  { name: "Marcus Reid", role: "CEO, ShopWave", text: "Their team understood our vision immediately. The e-commerce engine they built doubled our conversion rate.", rating: 5 },
  { name: "Dr. Amara Okafor", role: "Founder, MedBridge", text: "HIPAA compliance was critical. Wehoware delivered a secure, beautiful patient portal that our users love.", rating: 5 },
  { name: "James Park", role: "VP Eng, DataSync", text: "Best dev partner we've worked with. Their SaaS platform saved us 6 months of internal development.", rating: 5 },
];

export default function TestimonialsSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-10" />
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <ScrollReveal y={20} rotateX={10}>
            <div className="inline-block px-3 py-1 rounded-full glass-card text-sm text-[#00d4ff] mb-4">
              Testimonials
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1} rotateX={15}>
            <h2 className="text-4xl md:text-5xl font-bold">
              Client <span className="gradient-text">Voices</span>
            </h2>
          </ScrollReveal>
        </div>

        <ScrollReveal stagger={0.1} className="grid grid-cols-1 md:grid-cols-2 gap-6" scrub start="top 80%" end="bottom 40%">
          {testimonials.map((t, i) => (
            <Scroll3DTilt key={i} max={8} className="glass-card p-8 relative">
              <Quote className="w-8 h-8 text-[#3b82f6]/30 absolute top-6 right-6" />
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-[#00d4ff] text-[#00d4ff]" />
                ))}
              </div>
              <p className="text-gray-300 mb-6 text-lg leading-relaxed">&ldquo;{t.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#00d4ff] flex items-center justify-center text-white font-bold">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-gray-100">{t.name}</div>
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
