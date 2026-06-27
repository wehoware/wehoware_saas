"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Lightbulb, PenTool, Code2, Rocket } from "lucide-react";

const storySteps = [
  {
    number: "01",
    icon: Lightbulb,
    title: "THE SPARK",
    subtitle: "Ideation & Discovery",
    description: "Every great product starts with a conversation. We dive deep into your vision, market landscape, and user needs to architect a blueprint for innovation.",
    metrics: ["Market Analysis", "User Research", "Technical Feasibility", "Product Roadmap"],
    accent: "from-[#3b82f6] to-[#60a5fa]",
  },
  {
    number: "02",
    icon: PenTool,
    title: "THE BLUEPRINT",
    subtitle: "Design & Architecture",
    description: "Where art meets engineering. Our design team crafts cinematic interfaces while architects build scalable, secure, future-proof technical foundations.",
    metrics: ["UI/UX Design", "System Architecture", "Prototyping", "Design Systems"],
    accent: "from-[#00d4ff] to-[#3b82f6]",
  },
  {
    number: "03",
    icon: Code2,
    title: "THE FORGE",
    subtitle: "Development & AI Integration",
    description: "Code becomes reality. AI-assisted development, real-time collaboration, and continuous integration ensure rapid, precise, and scalable product engineering.",
    metrics: ["AI-Assisted Coding", "Cloud Infrastructure", "CI/CD Pipeline", "Quality Assurance"],
    accent: "from-[#818cf8] to-[#00d4ff]",
  },
  {
    number: "04",
    icon: Rocket,
    title: "THE LAUNCH",
    subtitle: "Scale & Growth",
    description: "From deployment to domination. We don't just ship products — we engineer growth through data-driven optimization, marketing automation, and continuous evolution.",
    metrics: ["Cloud Deployment", "Growth Analytics", "Marketing Automation", "Continuous Evolution"],
    accent: "from-[#c084fc] to-[#818cf8]",
  },
];

export default function CompanyStorySection() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section ref={containerRef} className="relative">
      {/* Section header */}
      <div className="text-center py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="cinematic-badge mb-6">
            <span>Our Process</span>
          </div>
          <h2 className="cinematic-headline mb-4">
            FROM IDEA TO IMPACT
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Four chambers of innovation. One seamless journey from concept to scale.
          </p>
        </motion.div>
      </div>

      {/* Story timeline */}
      <div className="relative max-w-6xl mx-auto px-6 pb-32">
        {/* Central progress line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5 -translate-x-1/2" />
        <motion.div
          style={{ height: lineHeight }}
          className="absolute left-1/2 top-0 w-px bg-gradient-to-b from-[#3b82f6] via-[#00d4ff] to-[#818cf8] -translate-x-1/2"
        />

        {storySteps.map((step, index) => {
          const Icon = step.icon;
          const isLeft = index % 2 === 0;

          return (
            <div key={step.number} className="story-step relative">
              {/* Node on the line */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true, margin: "-20%" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
              >
                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${step.accent} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${step.accent} blur-xl opacity-40`} />
              </motion.div>

              {/* Content card */}
              <div className={`flex items-center ${isLeft ? "justify-start" : "justify-end"}`}>
                <motion.div
                  initial={{ opacity: 0, x: isLeft ? -60 : 60, filter: "blur(8px)" }}
                  whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, margin: "-15%" }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  className={`w-[45%] ${isLeft ? "pr-16 text-right" : "pl-16"}`}
                >
                  <div className="holo-glass p-8 group">
                    {/* Giant number */}
                    <div className={`text-6xl font-black bg-gradient-to-br ${step.accent} bg-clip-text text-transparent leading-none mb-2 opacity-80`}>
                      {step.number}
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">{step.subtitle}</div>
                    <h3 className="text-2xl font-bold text-white mb-4">{step.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6">{step.description}</p>
                    <div className={`flex flex-wrap gap-2 ${isLeft ? "justify-end" : "justify-start"}`}>
                      {step.metrics.map((m) => (
                        <span
                          key={m}
                          className="px-2.5 py-1 rounded-md text-[11px] font-medium text-gray-400 bg-white/[0.03] border border-white/5"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
