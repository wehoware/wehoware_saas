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
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-10" />
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <ScrollReveal y={20} rotateX={10}>
            <div className="inline-block px-3 py-1 rounded-full glass-card text-sm text-[#00d4ff] mb-4">
              The Team
            </div>
          </ScrollReveal>
          <ScrollReveal y={30} delay={0.1} rotateX={15}>
            <h2 className="text-4xl md:text-5xl font-bold">
              Minds Behind <span className="gradient-text">Wehoware</span>
            </h2>
          </ScrollReveal>
        </div>

        <ScrollReveal stagger={0.1} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {team.map((m, i) => (
            <Scroll3DTilt key={i} max={12} className="glass-card p-6 text-center group">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#00d4ff] flex items-center justify-center text-2xl font-bold text-white group-hover:scale-110 transition-transform">
                {m.name.charAt(0)}
              </div>
              <h3 className="font-bold text-gray-100">{m.name}</h3>
              <div className="text-sm text-[#00d4ff] mb-2">{m.role}</div>
              <p className="text-xs text-gray-500 mb-4">{m.bio}</p>
              <div className="flex justify-center gap-3">
                <Linkedin className="w-4 h-4 text-gray-600 hover:text-[#3b82f6] cursor-pointer transition-colors" />
                <Twitter className="w-4 h-4 text-gray-600 hover:text-[#3b82f6] cursor-pointer transition-colors" />
                <Github className="w-4 h-4 text-gray-600 hover:text-[#3b82f6] cursor-pointer transition-colors" />
              </div>
            </Scroll3DTilt>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
