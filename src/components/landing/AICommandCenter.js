"use client";

import { motion } from "framer-motion";
import { Brain, Cpu, GitBranch, Activity, Zap, Database, Eye, Workflow } from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";

const modules = [
  {
    icon: Brain,
    title: "Neural Engine",
    status: "ACTIVE",
    metric: "32 Models",
    description: "Custom-trained LLMs and neural networks powering intelligent features across your product ecosystem.",
    color: "#3b82f6",
  },
  {
    icon: GitBranch,
    title: "Code Pipeline",
    status: "STREAMING",
    metric: "847 Commits",
    description: "AI-assisted development with automated code review, testing, and continuous integration.",
    color: "#00d4ff",
  },
  {
    icon: Database,
    title: "Data Lake",
    status: "SYNCED",
    metric: "2.4TB",
    description: "Unified data infrastructure with real-time ingestion, ETL pipelines, and predictive analytics.",
    color: "#818cf8",
  },
  {
    icon: Activity,
    title: "Monitoring",
    status: "OPTIMAL",
    metric: "99.99%",
    description: "24/7 system health monitoring with predictive alerting and automated incident response.",
    color: "#34d399",
  },
  {
    icon: Eye,
    title: "Vision AI",
    status: "PROCESSING",
    metric: "12K FPS",
    description: "Computer vision models for image recognition, OCR, and real-time video analysis.",
    color: "#c084fc",
  },
  {
    icon: Workflow,
    title: "Automation",
    status: "RUNNING",
    metric: "156 Flows",
    description: "Intelligent workflow automation connecting your tools, data, and teams seamlessly.",
    color: "#60a5fa",
  },
];

const neuralNodes = [
  { top: "20%", left: "15%", delay: 0 },
  { top: "35%", left: "45%", delay: 0.5 },
  { top: "60%", left: "25%", delay: 1 },
  { top: "25%", left: "70%", delay: 1.5 },
  { top: "55%", left: "75%", delay: 2 },
  { top: "70%", left: "55%", delay: 2.5 },
];

export default function AICommandCenter() {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#060614]/50 to-transparent" />
      <div className="absolute inset-0 grid-bg opacity-5" />

      {/* Neural network background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {neuralNodes.map((node, i) => (
          <div
            key={i}
            className="neural-node"
            style={{ top: node.top, left: node.left, animationDelay: `${node.delay}s` }}
          />
        ))}
        {/* Connection lines via SVG */}
        <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
          <defs>
            <linearGradient id="neural-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
              <stop offset="50%" stopColor="#00d4ff" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="15%" y1="20%" x2="45%" y2="35%" stroke="url(#neural-gradient)" strokeWidth="1" className="data-flow-line" />
          <line x1="45%" y1="35%" x2="25%" y2="60%" stroke="url(#neural-gradient)" strokeWidth="1" className="data-flow-line" />
          <line x1="45%" y1="35%" x2="70%" y2="25%" stroke="url(#neural-gradient)" strokeWidth="1" className="data-flow-line" />
          <line x1="70%" y1="25%" x2="75%" y2="55%" stroke="url(#neural-gradient)" strokeWidth="1" className="data-flow-line" />
          <line x1="75%" y1="55%" x2="55%" y2="70%" stroke="url(#neural-gradient)" strokeWidth="1" className="data-flow-line" />
          <line x1="55%" y1="70%" x2="25%" y2="60%" stroke="url(#neural-gradient)" strokeWidth="1" className="data-flow-line" />
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-20">
          <ScrollReveal y={20}>
            <div className="cinematic-badge mb-6">
              <span>AI Command Center</span>
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1}>
            <h2 className="cinematic-headline mb-4">
              INTELLIGENCE <span className="cinematic-headline-accent">AT WORK</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal y={20} delay={0.2}>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Real-time visibility into the AI systems powering your products.
            </p>
          </ScrollReveal>
        </div>

        {/* AI Module Grid */}
        <div className="ai-grid">
          {modules.map((mod, i) => {
            const Icon = mod.icon;
            return (
              <ScrollReveal key={mod.title} y={30} delay={i * 0.06}>
                <div className="ai-module holo-shimmer-bg group">
                  {/* Status indicator */}
                  <div className="flex items-center justify-between mb-6">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${mod.color}20, ${mod.color}05)`,
                        border: `1px solid ${mod.color}30`,
                      }}
                    >
                      <Icon className="w-6 h-6" style={{ color: mod.color }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: mod.color }} />
                      <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: mod.color }}>
                        {mod.status}
                      </span>
                    </div>
                  </div>

                  {/* Title and metric */}
                  <h3 className="text-lg font-bold text-white mb-1">{mod.title}</h3>
                  <div className="text-3xl font-black mb-3" style={{ color: mod.color }}>
                    {mod.metric}
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">{mod.description}</p>

                  {/* Bottom data stream indicator */}
                  <div className="mt-6 flex items-center gap-1">
                    {Array.from({ length: 20 }).map((_, j) => (
                      <motion.div
                        key={j}
                        initial={{ opacity: 0.1 }}
                        animate={{ opacity: [0.1, 1, 0.1] }}
                        transition={{
                          duration: 2,
                          delay: j * 0.05,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="flex-1 h-1 rounded-full"
                        style={{ background: mod.color }}
                      />
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        {/* Central stats bar */}
        <ScrollReveal y={30} delay={0.3}>
          <div className="holo-glass mt-12 p-8 flex flex-wrap justify-around items-center gap-8">
            {[
              { label: "Models Running", value: "32", icon: Brain },
              { label: "API Calls/Day", value: "4.2M", icon: Zap },
              { label: "Avg Latency", value: "47ms", icon: Activity },
              { label: "Accuracy", value: "99.2%", icon: Cpu },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center">
                  <Icon className="w-6 h-6 mx-auto mb-2 text-[#00d4ff]" />
                  <div className="text-3xl font-black gradient-text-cinematic">{stat.value}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
