"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ScrollReveal from "@/components/gsap/ScrollReveal";
import ScrollParallax from "@/components/gsap/ScrollParallax";
import MagneticButton from "@/components/gsap/MagneticButton";

const VortexScene = dynamic(() => import("@/components/three/VortexScene"), { ssr: false });

export default function CTASection() {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-50">
        <VortexScene />
      </div>
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#030308] via-transparent to-[#030308]" />

      <ScrollParallax speed={0.2} className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-[#3b82f6]/8 blur-[120px]" />
      </ScrollParallax>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <ScrollReveal y={20}>
          <div className="cinematic-badge mb-8">
            <span>Let&apos;s Build</span>
          </div>
        </ScrollReveal>
        <ScrollReveal y={30} delay={0.1}>
          <h2 className="cinematic-headline mb-6">
            READY TO BUILD<br />
            <span className="cinematic-headline-accent">SOMETHING EXTRAORDINARY?</span>
          </h2>
        </ScrollReveal>
        <ScrollReveal y={20} delay={0.2}>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Let&apos;s transform your vision into a digital reality.
            Schedule a free consultation with our team today.
          </p>
        </ScrollReveal>
        <ScrollReveal y={20} delay={0.3}>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <MagneticButton>
              <Link href="/contact" className="btn-cinematic inline-flex items-center gap-2 text-lg">
                Start Your Project <ArrowRight className="w-5 h-5" />
              </Link>
            </MagneticButton>
            <MagneticButton>
              <Link href="/about" className="btn-cinematic-ghost inline-flex items-center gap-2 text-lg">
                Learn About Us
              </Link>
            </MagneticButton>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
