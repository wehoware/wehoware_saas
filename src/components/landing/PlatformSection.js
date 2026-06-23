"use client";

import Link from "next/link";
import { LayoutDashboard, Users, BarChart3, FileEdit, Workflow } from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import ScrollParallax from "@/components/gsap/ScrollParallax";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";
import MagneticButton from "@/components/gsap/MagneticButton";

const features = [
  { icon: LayoutDashboard, title: "Multi-Tenant Dashboards", desc: "Isolated workspaces per client with centralized control" },
  { icon: Users, title: "Role-Based Access", desc: "Granular permissions for admins, managers, and clients" },
  { icon: BarChart3, title: "Real-Time Analytics", desc: "Live reporting and performance dashboards" },
  { icon: FileEdit, title: "Content Management", desc: "Built-in CMS for blogs, services, and SEO" },
  { icon: Workflow, title: "Task Management", desc: "Project tracking with team collaboration tools" },
];

export default function PlatformSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-10" />
      <ScrollParallax speed={0.1} className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#3b82f6]/5 blur-[120px] pointer-events-none" />
      <div className="relative z-10 max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <ScrollReveal y={30} rotateX={10}>
            <div className="inline-block px-3 py-1 rounded-full glass-card text-sm text-[#00d4ff] mb-4">
              The Wehoware Platform
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1} rotateX={15}>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              One Dashboard. <span className="gradient-text">Total Control.</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal y={20} delay={0.2} opacity={0}>
            <p className="text-gray-400 mb-8 text-lg">
              Our SaaS platform unifies project management, content, analytics,
              and client collaboration into a single command center.
            </p>
          </ScrollReveal>
          <ScrollReveal stagger={0.08} className="space-y-4 mb-8">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#3b82f6]/10 shrink-0">
                  <f.icon className="w-5 h-5 text-[#60a5fa]" />
                </div>
                <div>
                  <div className="font-semibold text-gray-100">{f.title}</div>
                  <div className="text-sm text-gray-500">{f.desc}</div>
                </div>
              </div>
            ))}
          </ScrollReveal>
          <ScrollReveal y={20} delay={0.3} opacity={0}>
            <MagneticButton>
              <Link href="/contact" className="btn-glow inline-flex items-center gap-2">
                Request a Demo
              </Link>
            </MagneticButton>
          </ScrollReveal>
        </div>

        <ScrollReveal y={40} delay={0.2} className="relative" scrub>
          <Scroll3DTilt max={8} className="glass-card p-2 rounded-2xl pulse-glow">
            <div className="rounded-xl overflow-hidden bg-[#0a0a0a] aspect-video relative">
              <div className="absolute inset-0 grid-bg opacity-30" />
              <div className="absolute top-0 left-0 right-0 h-8 bg-[#111] flex items-center px-3 gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              </div>
              <div className="absolute top-10 left-0 right-0 bottom-0 p-4 flex gap-3">
                <div className="w-1/4 space-y-2">
                  <div className="h-6 rounded bg-[#3b82f6]/20" />
                  <div className="h-4 rounded bg-gray-800" />
                  <div className="h-4 rounded bg-gray-800" />
                  <div className="h-4 rounded bg-gray-800" />
                  <div className="h-4 rounded bg-[#3b82f6]/30" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="h-20 rounded bg-gray-800/50" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-16 rounded bg-[#3b82f6]/15" />
                    <div className="h-16 rounded bg-[#00d4ff]/15" />
                  </div>
                  <div className="h-12 rounded bg-gray-800/50" />
                </div>
              </div>
            </div>
          </Scroll3DTilt>
        </ScrollReveal>
      </div>
    </section>
  );
}
