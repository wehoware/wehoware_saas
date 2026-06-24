"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useMotionValue } from "framer-motion";
import { Search, PenTool, Code2, Rocket, RefreshCw } from "lucide-react";

const chambers = [
  {
    number: "01",
    icon: Search,
    title: "DISCOVERY",
    subtitle: "Understanding Your Vision",
    description: "We immerse ourselves in your world — analyzing market dynamics, user behaviors, and technical constraints to architect the perfect blueprint.",
    deliverables: ["Market Research", "User Personas", "Technical Spec", "Project Roadmap"],
    accent: "#3b82f6",
  },
  {
    number: "02",
    icon: PenTool,
    title: "DESIGN",
    subtitle: "Crafting the Experience",
    description: "Where cinema meets functionality. Our designers create immersive, intuitive interfaces backed by design systems that scale across every touchpoint.",
    deliverables: ["UI/UX Design", "Prototyping", "Design System", "User Testing"],
    accent: "#00d4ff",
  },
  {
    number: "03",
    icon: Code2,
    title: "DEVELOP",
    subtitle: "Engineering Excellence",
    description: "AI-assisted development meets human craftsmanship. Clean code, scalable architecture, and continuous integration ensure precision at every layer.",
    deliverables: ["Frontend", "Backend", "AI Integration", "Cloud Setup"],
    accent: "#818cf8",
  },
  {
    number: "04",
    icon: Rocket,
    title: "DEPLOY",
    subtitle: "Launch & Scale",
    description: "From zero to production in record time. Automated deployment pipelines, monitoring, and scaling strategies that handle growth effortlessly.",
    deliverables: ["CI/CD Pipeline", "Cloud Deploy", "Monitoring", "Performance"],
    accent: "#c084fc",
  },
  {
    number: "05",
    icon: RefreshCw,
    title: "EVOLVE",
    subtitle: "Continuous Innovation",
    description: "We don't stop at launch. Data-driven iteration, feature evolution, and growth engineering ensure your product stays ahead of the curve.",
    deliverables: ["Analytics", "A/B Testing", "Feature Updates", "Growth Engineering"],
    accent: "#34d399",
  },
];

export default function ProcessSection() {
  const containerRef = useRef(null);
  const x = useMotionValue(0);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const chamberWidth = Math.min(vw * 0.8, 900);
      const paddingLeft = vw * 0.1;
      const gap = 32;
      const trackWidth = paddingLeft + chambers.length * chamberWidth + (chambers.length - 1) * gap;
      setScrollDistance(Math.max(0, trackWidth - vw));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      // Progress: 0 when section top hits viewport top, 1 when section bottom hits viewport top
      const progress = Math.max(0, Math.min(1, -rect.top / (rect.height - vh)));
      x.set(progress * -scrollDistance);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollDistance, x]);

  return (
    <section ref={containerRef} className="relative" style={{ height: `${(chambers.length + 1) * 100}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden flex items-center">
        <div className="absolute inset-0 bg-gradient-to-r from-[#030308] via-[#060614] to-[#030308]" />
        <div className="absolute inset-0 grid-bg opacity-5" />

        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 text-center">
          <div className="cinematic-badge mb-4">
            <span>Development Pipeline</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            THE <span className="cinematic-headline-accent">PROCESS</span>
          </h2>
        </div>

        <motion.div style={{ x, willChange: "transform" }} className="flex gap-8 pl-[10vw]">
          {chambers.map((chamber, i) => {
            const Icon = chamber.icon;
            return (
              <div
                key={chamber.number}
                className="chamber relative flex-shrink-0"
                style={{ width: "80vw", maxWidth: "900px" }}
              >
                <div className="chamber-number">{chamber.number}</div>

                <div className="relative z-10 max-w-2xl">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="mb-8"
                  >
                    <div
                      className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
                      style={{
                        background: `linear-gradient(135deg, ${chamber.accent}20, ${chamber.accent}05)`,
                        border: `1px solid ${chamber.accent}30`,
                      }}
                    >
                      <Icon className="w-10 h-10" style={{ color: chamber.accent }} />
                    </div>
                  </motion.div>

                  <div className="text-xs uppercase tracking-widest mb-2" style={{ color: chamber.accent }}>
                    {chamber.subtitle}
                  </div>
                  <h3 className="text-5xl md:text-6xl font-black text-white mb-6">{chamber.title}</h3>
                  <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-xl">{chamber.description}</p>

                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    {chamber.deliverables.map((d) => (
                      <div
                        key={d}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5"
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: chamber.accent }} />
                        <span className="text-sm text-gray-300">{d}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="absolute bottom-12 left-0 right-0 flex items-center gap-2 px-8">
                  {chambers.map((c, idx) => (
                    <div
                      key={`${chamber.number}-${c.number}`}
                      className="h-0.5 flex-1 rounded-full transition-all duration-500"
                      style={{
                        background: idx <= i ? chamber.accent : "rgba(255,255,255,0.05)",
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </motion.div>

        <div className="absolute bottom-8 right-8 text-xs text-gray-500 flex items-center gap-2">
          <span>Scroll to explore</span>
          <div className="w-6 h-0.5 bg-gradient-to-r from-[#3b82f6] to-transparent" />
        </div>
      </div>
    </section>
  );
}
