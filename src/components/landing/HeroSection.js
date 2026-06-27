"use client";

import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Cpu, Cloud, BarChart3, Zap } from "lucide-react";
import MagneticButton from "@/components/gsap/MagneticButton";

const MechaWarriorScene = dynamic(
  () => import("@/components/three/MechaWarriorScene"),
  {
    ssr: false,
  },
);

const floatingMetrics = [
  {
    label: "AI Models",
    value: "32+",
    icon: Cpu,
    position: "top-[14%] left-[6%]",
    delay: 1.2,
  },
  {
    label: "Uptime",
    value: "99.99%",
    icon: Cloud,
    position: "top-[22%] right-[7%]",
    delay: 1.4,
  },
  {
    label: "Projects",
    value: "150+",
    icon: BarChart3,
    position: "bottom-[24%] left-[9%]",
    delay: 1.6,
  },
  {
    label: "Latency",
    value: "47ms",
    icon: Zap,
    position: "bottom-[30%] right-[6%]",
    delay: 1.8,
  },
];

const easeCinematic = [0.16, 1, 0.3, 1];

/* ── Animated counter for metric values ── */
function AnimatedCounter({ value, delay }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    const timer = setTimeout(() => {
      const numeric = parseFloat(value.replace(/[^0-9.]/g, "")) || 0;
      const suffix = value.replace(/[0-9.]/g, "");
      const duration = 1600;
      const start = performance.now();

      const tick = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = numeric * eased;
        setDisplay(
          (Number.isInteger(numeric)
            ? Math.round(current)
            : current.toFixed(2)
          ).toString() + suffix,
        );
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return <span ref={ref}>{display}</span>;
}

/* ── Cursor glow follower ── */
function CursorGlow() {
  const mouseX = useMotionValue(-500);
  const mouseY = useMotionValue(-500);
  const springX = useSpring(mouseX, { stiffness: 120, damping: 30, mass: 0.5 });
  const springY = useSpring(mouseY, { stiffness: 120, damping: 30, mass: 0.5 });
  const x = useTransform(springX, (v) => `${v - 250}px`);
  const y = useTransform(springY, (v) => `${v - 250}px`);

  useEffect(() => {
    const handler = (e) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [mouseX, mouseY]);

  return (
    <motion.div className="hero-cursor-glow" style={{ x, y }} aria-hidden />
  );
}

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#030308]">
      {/* ── Layered atmospheric background ── */}
      {/* Deep space gradient base */}
      <div className="hero-bg-base z-0" />
      {/* Animated aurora glow */}
      <div className="hero-aurora z-0" />
      {/* Starfield dots */}
      <div className="hero-starfield z-0" />
      {/* Horizon glow line */}
      <div className="hero-horizon-glow z-0" />

      {/* ── 3D Mecha Warrior scene — follows mouse ── */}
      <div className="absolute inset-0 z-0">
        <MechaWarriorScene />
      </div>

      {/* ── Cursor glow ── */}
      <CursorGlow />

      {/* ── Volumetric lighting ── */}
      <div className="volumetric-light z-0" />

      {/* ── Film-grade gradient overlays ── */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#030308]/40 via-transparent to-[#030308]/80" />
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#030308]/30 via-transparent to-[#030308]/30" />
      {/* Edge vignette for cinematic framing */}
      <div className="hero-vignette z-0" />
      {/* Film grain texture */}
      <div className="hero-grain z-0" />

      {/* ── HUD corner brackets ── */}
      <div className="hero-bracket hero-bracket-tl z-10" />
      <div className="hero-bracket hero-bracket-tr z-10" />
      <div className="hero-bracket hero-bracket-bl z-10" />
      <div className="hero-bracket hero-bracket-br z-10" />

      {/* ── Floating metric badges ── */}
      {floatingMetrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              duration: 1,
              delay: metric.delay,
              ease: easeCinematic,
            }}
            className={`absolute ${metric.position} z-10 hidden lg:block`}
          >
            <div
              className="holo-glass hero-metric-card px-5 py-4 float-organic"
              style={{ animationDelay: `${metric.delay}s` }}
            >
              <div className="flex items-center gap-3.5">
                <div className="hero-metric-icon">
                  <Icon className="w-4 h-4 text-[#60a5fa]" />
                </div>
                <div>
                  <div className="text-xl font-bold gradient-text-cinematic leading-none tabular-nums">
                    <AnimatedCounter
                      value={metric.value}
                      delay={metric.delay}
                    />
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-1.5 font-medium">
                    {metric.label}
                  </div>
                </div>
              </div>
              {/* Bottom accent line */}
              <div className="hero-metric-accent" />
            </div>
          </motion.div>
        );
      })}

      {/* ── Vertical side label ── */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, delay: 2, ease: easeCinematic }}
        className="absolute right-6 top-1/2 -translate-y-1/2 z-10 hidden xl:flex flex-col items-center gap-3"
        aria-hidden
      >
        <div className="w-px h-16 bg-gradient-to-b from-transparent via-[#00d4ff]/40 to-transparent" />
        <span className="hero-side-label">SCROLL TO EXPLORE</span>
        <div className="w-px h-16 bg-gradient-to-b from-[#00d4ff]/40 via-transparent to-transparent" />
      </motion.div>

      {/* ── Badge at top ── */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: easeCinematic }}
        className="absolute top-14 left-0 right-0 z-10 flex justify-center"
      >
        <div className="cinematic-badge">
          <span>Elite Software Innovation Lab</span>
        </div>
      </motion.div>

      {/* ── Main content ── */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto pt-72">
        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.2, delay: 0.3, ease: easeCinematic }}
          className="cinematic-headline mb-2 whitespace-nowrap"
        >
          THE FUTURE
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1, ease: easeCinematic }}
          className="text-base md:text-lg text-gray-400/80 max-w-2xl mx-auto mb-3 leading-relaxed font-light"
        >
          We engineer intelligent software ecosystems that transform ambitious
          ideas into real world impact.
        </motion.p>

        {/* Tag pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.1, ease: easeCinematic }}
          className="flex flex-wrap justify-center gap-2.5 mb-2"
        >
          {[
            "Custom Software",
            "AI Systems",
            "SaaS Products",
            "Growth Platforms",
          ].map((tag, i) => (
            <motion.span
              key={tag}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.5,
                delay: 1.2 + i * 0.08,
                ease: easeCinematic,
              }}
              className="hero-tag"
            >
              {tag}
            </motion.span>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.5, ease: easeCinematic }}
          className="flex flex-col mt-10 sm:flex-row gap-4 justify-center items-center"
        >
          <MagneticButton strength={0.35}>
            <Link href="/contact" className="btn-cinematic group">
              <span className="relative z-10 flex items-center gap-2">
                Start Your Project
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
          </MagneticButton>
          <MagneticButton strength={0.25}>
            <Link href="/#showcase" className="btn-cinematic-ghost group">
              <span className="flex items-center gap-2">
                Explore Our Work
                <span className="hero-cta-arrow">
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </span>
            </Link>
          </MagneticButton>
        </motion.div>
      </div>

      {/* ── Scroll indicator ── */}
      {/* <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 2.2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3"
      >
        <span className="text-[10px] text-gray-600 uppercase tracking-[0.3em] font-medium">Scroll</span>
        <div className="float-soft">
          <div className="hero-scroll-track">
            <div className="hero-scroll-dot" />
          </div>
        </div>
      </motion.div> */}

      {/* ── Bottom fade into next section ── */}
      <div className="absolute bottom-0 left-0 right-0 h-32 z-10 bg-gradient-to-t from-[#030308] via-[#030308]/60 to-transparent pointer-events-none" />
    </section>
  );
}
