"use client";

import Link from "next/link";
import { Code, Palette, Cloud, Smartphone, Search, Zap, ArrowRight } from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";

const services = [
  { icon: Code, title: "Web Development", desc: "Custom web apps built with Next.js, React, and modern APIs", tags: ["Next.js", "React", "Node"] },
  { icon: Smartphone, title: "Mobile Apps", desc: "Native and cross-platform iOS & Android applications", tags: ["React Native", "Flutter"] },
  { icon: Cloud, title: "Cloud & DevOps", desc: "Scalable infrastructure on AWS, Docker, and Kubernetes", tags: ["AWS", "Docker", "K8s"] },
  { icon: Palette, title: "UI/UX Design", desc: "Award-winning interfaces with user-centered design thinking", tags: ["Figma", "Design Systems"] },
  { icon: Search, title: "SEO & Analytics", desc: "Data-driven optimization for search visibility and conversion", tags: ["SEO", "Analytics"] },
  { icon: Zap, title: "Marketing Automation", desc: "Growth engines with email, social, and CRM integration", tags: ["HubSpot", "Mailchimp"] },
];

export default function ServicesSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-10" />
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <ScrollReveal y={20} rotateX={10}>
            <div className="inline-block px-3 py-1 rounded-full glass-card text-sm text-[#00d4ff] mb-4">
              What We Do
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1} rotateX={15}>
            <h2 className="text-4xl md:text-5xl font-bold">
              Services <span className="gradient-text">Constellation</span>
            </h2>
          </ScrollReveal>
        </div>

        <ScrollReveal stagger={0.1} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s, i) => (
            <Scroll3DTilt key={i} max={12} className="glass-card p-8 group cursor-pointer neon-border">
              <div className="p-3 rounded-xl bg-[#3b82f6]/10 mb-4 inline-block group-hover:bg-[#3b82f6]/20 transition-colors">
                <s.icon className="w-6 h-6 text-[#60a5fa]" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-100">{s.title}</h3>
              <p className="text-gray-400 text-sm mb-4">{s.desc}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {s.tags.map((t, j) => (
                  <span key={j} className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">{t}</span>
                ))}
              </div>
              <Link href="/services" className="text-sm text-[#00d4ff] inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                Learn more <ArrowRight className="w-3 h-3" />
              </Link>
            </Scroll3DTilt>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
