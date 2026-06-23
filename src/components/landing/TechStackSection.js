"use client";

import dynamic from "next/dynamic";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import ScrollParallax from "@/components/gsap/ScrollParallax";

const TechScene = dynamic(() => import("@/components/three/TechScene"), { ssr: false });

export default function TechStackSection() {
  return (
    <section className="relative py-24 overflow-hidden min-h-[80vh] flex items-center">
      <div className="absolute inset-0 z-0 opacity-50">
        <TechScene />
      </div>
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#050505] via-transparent to-[#050505]" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 w-full">
        <div className="text-center mb-12">
          <ScrollReveal y={20} rotateX={10}>
            <div className="inline-block px-3 py-1 rounded-full glass-card text-sm text-[#00d4ff] mb-4">
              Our Arsenal
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1} rotateX={15}>
            <h2 className="text-4xl md:text-5xl font-bold">
              Tech <span className="gradient-text">Nebula</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal y={20} delay={0.2} opacity={0} scrub>
            <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
              We navigate the full spectrum of modern technology to engineer solutions that last.
            </p>
          </ScrollReveal>
        </div>

        <ScrollReveal stagger={0.05} className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto" scrub start="top 80%" end="bottom 60%">
          {["React", "Next.js", "Node.js", "Python", "TypeScript", "AWS", "Docker", "Kubernetes", "MySQL", "PostgreSQL", "Prisma", "GraphQL", "Three.js", "GSAP", "TailwindCSS", "Redis", "Vercel", "Stripe"].map((tech, i) => (
            <span key={i} className="px-4 py-2 rounded-full glass-card text-sm text-gray-300 hover:text-[#00d4ff] hover:border-[#00d4ff]/30 transition-colors">
              {tech}
            </span>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
