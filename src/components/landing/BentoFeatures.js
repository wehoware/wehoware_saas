"use client";

import { Cpu, Shield, Zap, GitBranch, BarChart3, Globe } from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";

export default function BentoFeatures() {
  return (
    <section id="platform" className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 gradient-mesh opacity-50" />
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <ScrollReveal y={20} rotateX={10}>
            <span className="section-label mb-6">Platform</span>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1} rotateX={15}>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight mt-6 mb-4">
              Everything you need to
              <br />
              <span className="gradient-text-premium">ship faster</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal y={20} delay={0.2} opacity={0}>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              A unified platform that replaces your entire development stack.
              From ideation to deployment, all in one place.
            </p>
          </ScrollReveal>
        </div>

        <ScrollReveal stagger={0.08} className="bento-grid">
          <Scroll3DTilt max={6} className="bento-item bento-item-large p-8 min-h-[280px] flex flex-col justify-between glow-ring">
            <div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3b82f6]/20 to-[#00d4ff]/10 flex items-center justify-center mb-4">
                <Cpu className="w-6 h-6 text-[#60a5fa]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">AI-Assisted Development</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Generate components, APIs, and tests with context-aware AI.
                Code suggestions that understand your entire codebase.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <span className="premium-badge">GPT-4 Powered</span>
              <span className="premium-badge">Real-time</span>
            </div>
          </Scroll3DTilt>

          <Scroll3DTilt max={8} className="bento-item p-8 min-h-[280px] flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Enterprise Security</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                SOC 2 Type II, GDPR, and HIPAA compliance built-in.
                End-to-end encryption and SSO.
              </p>
            </div>
          </Scroll3DTilt>

          <Scroll3DTilt max={8} className="bento-item p-8 min-h-[280px] flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-yellow-500/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Edge Deployment</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Deploy globally in seconds. 300+ edge locations.
                Zero-config CDN and automatic scaling.
              </p>
            </div>
          </Scroll3DTilt>

          <Scroll3DTilt max={8} className="bento-item p-8 min-h-[280px] flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/10 flex items-center justify-center mb-4">
                <GitBranch className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Git-Native Workflow</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Every branch gets its own preview deployment.
                Review apps, instant rollbacks, and merge queues.
              </p>
            </div>
          </Scroll3DTilt>

          <Scroll3DTilt max={6} className="bento-item bento-item-large p-8 min-h-[280px] flex flex-col justify-between glow-ring">
            <div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff]/20 to-blue-500/10 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-[#00d4ff]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Real-Time Analytics</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Monitor performance, track user behavior, and analyze errors
                in real-time. Custom dashboards and alerting built-in.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-6">
              <div className="glass-card p-2 rounded-lg text-center">
                <div className="text-lg font-bold gradient-text-premium">47ms</div>
                <div className="text-[10px] text-gray-500">p99 Latency</div>
              </div>
              <div className="glass-card p-2 rounded-lg text-center">
                <div className="text-lg font-bold gradient-text-premium">99.99%</div>
                <div className="text-[10px] text-gray-500">Uptime</div>
              </div>
              <div className="glass-card p-2 rounded-lg text-center">
                <div className="text-lg font-bold gradient-text-premium">12M+</div>
                <div className="text-[10px] text-gray-500">Requests/day</div>
              </div>
            </div>
          </Scroll3DTilt>

          <Scroll3DTilt max={8} className="bento-item p-8 min-h-[280px] flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center mb-4">
                <Globe className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Global Infrastructure</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Multi-region deployments with automatic failover.
                Data residency controls and compliance.
              </p>
            </div>
          </Scroll3DTilt>
        </ScrollReveal>
      </div>
    </section>
  );
}
