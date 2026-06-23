"use client";

import ScrollReveal from "@/components/gsap/ScrollReveal";
import ScrollParallax from "@/components/gsap/ScrollParallax";

const steps = [
  { num: "01", title: "Discovery", desc: "Deep-dive workshops to understand your business, users, and goals" },
  { num: "02", title: "Architecture", desc: "Technical blueprints, wireframes, and system design" },
  { num: "03", title: "Development", desc: "Agile sprints with weekly demos and continuous integration" },
  { num: "04", title: "Launch", desc: "Deployment, monitoring, and post-launch optimization" },
  { num: "05", title: "Scale", desc: "Growth engineering, A/B testing, and performance tuning" },
];

export default function ProcessSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-10" />
      <ScrollParallax speed={0.08} className="absolute top-1/3 left-0 w-72 h-72 rounded-full bg-[#00d4ff]/5 blur-[100px] pointer-events-none" />
      <div className="relative z-10 max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <ScrollReveal y={20} rotateX={10}>
            <div className="inline-block px-3 py-1 rounded-full glass-card text-sm text-[#00d4ff] mb-4">
              How We Work
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1} rotateX={15}>
            <h2 className="text-4xl md:text-5xl font-bold">
              The <span className="gradient-text">Pipeline</span>
            </h2>
          </ScrollReveal>
        </div>

        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#3b82f6]/30 to-transparent hidden md:block" />
          <ScrollReveal stagger={0.15} className="space-y-8" scrub start="top 80%" end="bottom 30%">
            {steps.map((s, i) => (
              <div key={i} className={`flex items-center gap-6 ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}>
                <div className="flex-1 glass-card p-6 md:text-right neon-border">
                  <div className="text-3xl font-bold gradient-text mb-2">{s.num}</div>
                  <h3 className="text-xl font-bold text-gray-100 mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-400">{s.desc}</p>
                </div>
                <div className="hidden md:flex w-4 h-4 rounded-full bg-[#3b82f6] pulse-glow shrink-0" />
                <div className="flex-1 hidden md:block" />
              </div>
            ))}
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
