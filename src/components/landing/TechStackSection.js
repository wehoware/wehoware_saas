"use client";

import dynamic from "next/dynamic";
import ScrollReveal from "@/components/gsap/ScrollReveal";

const TechScene = dynamic(() => import("@/components/three/TechScene"), { ssr: false });

export default function TechStackSection() {
  return (
    <section className="relative py-32 overflow-hidden min-h-[80vh] flex items-center">
      <div className="absolute inset-0 z-0 opacity-40">
        <TechScene />
      </div>
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#030308] via-transparent to-[#030308]" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 w-full">
        <div className="text-center mb-16">
          <ScrollReveal y={20}>
            <div className="cinematic-badge mb-6">
              <span>Our Arsenal</span>
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1}>
            <h2 className="cinematic-headline mb-4">
              TECH <span className="cinematic-headline-accent">NEBULA</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal y={20} delay={0.2}>
            <p className="text-gray-400 mt-4 max-w-2xl mx-auto text-lg">
              We navigate the full spectrum of modern technology to engineer solutions that last.
            </p>
          </ScrollReveal>
        </div>

        <ScrollReveal stagger={0.05} className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
          {["React", "Next.js", "Node.js", "Python", "TypeScript", "AWS", "Docker", "Kubernetes", "MySQL", "PostgreSQL", "Prisma", "GraphQL", "Three.js", "GSAP", "TailwindCSS", "Redis", "Vercel", "Stripe"].map((tech) => (
            <span
              key={tech}
              className="px-4 py-2 rounded-full text-sm font-medium text-gray-300 bg-white/[0.02] border border-white/5 hover:text-[#00d4ff] hover:border-[#00d4ff]/30 hover:bg-[#00d4ff]/5 transition-all duration-300"
            >
              {tech}
            </span>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
