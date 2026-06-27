"use client";

import { Github, Linkedin, Twitter } from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import Scroll3DTilt from "@/components/gsap/Scroll3DTilt";

const team = [
  { name: "Sai Akhil", role: "Founder & CEO", bio: "Visionary leader driving innovation and growth" },
  { name: "Abhinay", role: "Operation Manager", bio: "Streamlining operations for seamless delivery" },
];

export default function TeamSection() {
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-5" />
      <div className="glow-orb w-[400px] h-[400px] bg-[#818cf8]/5 top-[30%] left-[35%]" />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="text-center mb-20">
          <ScrollReveal y={20}>
            <div className="cinematic-badge mb-6">
              <span>The Team</span>
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1}>
            <h2 className="cinematic-headline mb-4">
              MINDS BEHIND WEHOWARE
            </h2>
          </ScrollReveal>
        </div>

        <ScrollReveal stagger={0.1} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {team.map((m) => (
            <Scroll3DTilt key={m.name} max={10} className="ai-module holo-shimmer-bg p-8 text-center group">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#00d4ff] flex items-center justify-center text-3xl font-bold text-white group-hover:scale-110 transition-transform duration-500" style={{ boxShadow: "0 0 30px rgba(59,130,246,0.3)" }}>
                {m.name.charAt(0)}
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{m.name}</h3>
              <div className="text-sm text-[#00d4ff] font-semibold mb-3 uppercase tracking-wider">{m.role}</div>
              <p className="text-sm text-gray-400 mb-6">{m.bio}</p>
              <div className="flex justify-center gap-4">
                <Linkedin className="w-5 h-5 text-gray-600 hover:text-[#3b82f6] cursor-pointer transition-colors" />
                <Twitter className="w-5 h-5 text-gray-600 hover:text-[#3b82f6] cursor-pointer transition-colors" />
                <Github className="w-5 h-5 text-gray-600 hover:text-[#3b82f6] cursor-pointer transition-colors" />
              </div>
            </Scroll3DTilt>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
