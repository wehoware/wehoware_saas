"use client";

import { useState } from "react";
import {
  Code2,
  Brain,
  Cloud,
  Smartphone,
  TrendingUp,
  Shield,
  ArrowRight,
} from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";
import MagneticButton from "@/components/gsap/MagneticButton";
import Link from "next/link";

const services = [
  {
    icon: Code2,
    title: "Custom Software",
    tagline: "Enterprise-Grade Engineering",
    description:
      "Bespoke software solutions built with precision architecture, AI-assisted development, and enterprise-grade security.",
    features: [
      "Web Platforms",
      "API Ecosystems",
      "Microservices",
      "Real-Time Systems",
    ],
    color: "#3b82f6",
    glow: "rgba(59,130,246,0.3)",
  },
  {
    icon: Brain,
    title: "AI Systems",
    tagline: "Intelligence at Scale",
    description:
      "Custom AI models, LLM integration, and machine learning pipelines that transform data into competitive advantage.",
    features: [
      "LLM Integration",
      "Computer Vision",
      "Predictive Analytics",
      "AI Automation",
    ],
    color: "#00d4ff",
    glow: "rgba(0,212,255,0.3)",
  },
  {
    icon: Cloud,
    title: "SaaS Products",
    tagline: "From Zero to Scale",
    description:
      "Multi-tenant SaaS platforms with subscription billing, role-based access, and cloud-native architecture.",
    features: [
      "Multi-Tenant",
      "Subscription Billing",
      "Admin Dashboards",
      "API Access",
    ],
    color: "#818cf8",
    glow: "rgba(129,140,248,0.3)",
  },
  {
    icon: Smartphone,
    title: "Mobile Apps",
    tagline: "Native & Cross-Platform",
    description:
      "iOS, Android, and cross-platform mobile experiences with offline-first architecture and push engagement.",
    features: [
      "iOS & Android",
      "React Native",
      "Offline-First",
      "Push Notifications",
    ],
    color: "#c084fc",
    glow: "rgba(192,132,252,0.3)",
  },
  {
    icon: TrendingUp,
    title: "Digital Marketing",
    tagline: "Growth Engineering",
    description:
      "Data-driven marketing automation, SEO, and growth pipelines that turn launches into market dominance.",
    features: [
      "SEO Engineering",
      "Growth Funnels",
      "Marketing Automation",
      "Analytics",
    ],
    color: "#60a5fa",
    glow: "rgba(96,165,250,0.3)",
  },
  {
    icon: Shield,
    title: "Security & Compliance",
    tagline: "Enterprise-Grade Protection",
    description:
      "SOC 2, GDPR, HIPAA compliance with end-to-end encryption, audit logs, and zero-trust architecture.",
    features: ["SOC 2 Type II", "GDPR Ready", "HIPAA Compliant", "Zero-Trust"],
    color: "#34d399",
    glow: "rgba(52,211,153,0.3)",
  },
];

export default function ServicesSection() {
  const [activeService, setActiveService] = useState(0);

  return (
    <section id="solutions" className="relative py-32 overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="glow-orb w-[500px] h-[500px] bg-[#3b82f6]/5 top-[10%] left-[5%]" />
      <div className="glow-orb w-[400px] h-[400px] bg-[#00d4ff]/5 bottom-[20%] right-[10%]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-20">
          <ScrollReveal y={20}>
            <div className="cinematic-badge mb-6">
              <span>Service Ecosystem</span>
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1}>
            <h2 className="cinematic-headline mb-4">
              EVERYTHING YOU NEED <br />
              TO BUILD & SCALE
            </h2>
          </ScrollReveal>
          <ScrollReveal y={20} delay={0.2}>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Six interconnected service modules. One unified ecosystem for
              software innovation.
            </p>
          </ScrollReveal>
        </div>

        {/* Service grid - floating ecosystem */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, i) => {
            const Icon = service.icon;
            return (
              <ScrollReveal key={service.title} y={40} delay={i * 0.08}>
                <Scroll3DTilt max={10}>
                  <div
                    className="service-orb h-full group cursor-pointer"
                    onMouseEnter={() => setActiveService(i)}
                  >
                    {/* Icon with glow */}
                    <div className="relative mb-6">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110"
                        style={{
                          background: `linear-gradient(135deg, ${service.color}20, ${service.color}05)`,
                          border: `1px solid ${service.color}30`,
                        }}
                      >
                        <Icon
                          className="w-7 h-7"
                          style={{ color: service.color }}
                        />
                      </div>
                      <div
                        className="absolute inset-0 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{ background: service.glow }}
                      />
                    </div>

                    {/* Content */}
                    <div
                      className="text-xs uppercase tracking-widest mb-2"
                      style={{ color: service.color }}
                    >
                      {service.tagline}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">
                      {service.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6">
                      {service.description}
                    </p>

                    {/* Features */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {service.features.map((f) => (
                        <span
                          key={f}
                          className="px-2.5 py-1 rounded-md text-[11px] font-medium text-gray-400 bg-white/[0.03] border border-white/5 group-hover:border-white/10 transition-colors"
                        >
                          {f}
                        </span>
                      ))}
                    </div>

                    {/* Neural link indicator */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 group-hover:text-white transition-colors">
                      <span>Explore Service</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Scroll3DTilt>
              </ScrollReveal>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <ScrollReveal y={20}>
            <MagneticButton>
              <Link href="/contact" className="btn-cinematic">
                Start Your Project <ArrowRight className="w-4 h-4" />
              </Link>
            </MagneticButton>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
