"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { ArrowRight, ArrowDown, BarChart3, Cpu, ShoppingCart, HeartPulse } from "lucide-react";

const vault = [
  {
    title: "Real-Time Trading Platform",
    category: "FinTech",
    icon: BarChart3,
    desc: "WebSocket-powered trading dashboard with sub-50ms latency, advanced charting, and real-time portfolio analytics.",
    metrics: [
      { label: "Latency", value: "47ms" },
      { label: "Uptime", value: "99.99%" },
      { label: "Daily Trades", value: "2.4M" },
    ],
    tags: ["React", "WebSocket", "Redis", "TimescaleDB"],
    color: "#3b82f6",
    glow: "rgba(59,130,246,0.2)",
  },
  {
    title: "AI Content Engine",
    category: "AI / ML",
    icon: Cpu,
    desc: "GPT-4 powered content generation platform with multi-language support, brand voice training, and SEO optimization.",
    metrics: [
      { label: "Languages", value: "32" },
      { label: "Avg Gen Time", value: "1.2s" },
      { label: "Content/Mo", value: "50M+" },
    ],
    tags: ["Next.js", "OpenAI", "Pinecone", "Vercel"],
    color: "#00d4ff",
    glow: "rgba(0,212,255,0.2)",
  },
  {
    title: "Headless E-Commerce",
    category: "Retail",
    icon: ShoppingCart,
    desc: "Composable commerce architecture with edge-rendered storefronts, AI recommendations, and multi-region inventory.",
    metrics: [
      { label: "Conversion", value: "+45%" },
      { label: "Page Speed", value: "0.8s" },
      { label: "SKUs", value: "1.2M" },
    ],
    tags: ["Next.js", "Shopify", "Algolia", "Stripe"],
    color: "#818cf8",
    glow: "rgba(129,140,248,0.2)",
  },
  {
    title: "Healthcare Portal",
    category: "HealthTech",
    icon: HeartPulse,
    desc: "HIPAA-compliant patient management system with telemedicine, scheduling, and AI-assisted diagnostics.",
    metrics: [
      { label: "Active Users", value: "10k+" },
      { label: "Compliance", value: "100%" },
      { label: "Telemed Visits", value: "500k" },
    ],
    tags: ["React", "WebRTC", "AWS", "Python"],
    color: "#34d399",
    glow: "rgba(52,211,153,0.2)",
  },
];

function VaultCard({ item, index, smoothProgress, total, velocity }) {
  const Icon = item.icon;
  const center = index / (total - 1);
  const spread = 0.22;

  const dist = useTransform(smoothProgress, (p) => p - center);

  // ── Card slides DOWN through viewport with depth ──
  const y = useTransform(dist, [-spread, 0, spread], ["-55vh", "14vh", "83vh"]);
  const opacity = useTransform(dist, [-spread, -spread * 0.3, spread * 0.3, spread], [0, 1, 1, 0]);
  const scale = useTransform(dist, [-spread, 0, spread], [0.82, 1, 0.82]);
  const rotateX = useTransform(dist, [-spread, 0, spread], [16, 0, -16]);

  // ── Velocity-aware skew (cinematic motion lean) ──
  const skewY = useTransform(velocity, [-4, 0, 4], [2.5, 0, -2.5]);

  // ── Single blur on card container only (perf) ──
  const cardBlur = useTransform(dist, [-spread, -spread * 0.25, spread * 0.25, spread], [18, 0, 0, 18]);
  const cardFilter = useTransform(cardBlur, (b) => `blur(${b}px)`);

  // ── Z-index: active card always on top ──
  const zIndex = useTransform(dist, (d) => {
    const a = Math.abs(d);
    if (a < spread * 0.35) return 20;
    if (a < spread) return 10;
    return 5;
  });

  // ── Background glow pulse ──
  const glowOpacity = useTransform(dist, [-spread, 0, spread], [0, 0.45, 0]);
  const glowScale = useTransform(dist, [-spread, 0, spread], [0.6, 1.25, 0.6]);

  // ── Icon: rotation + scale pop + expanding glow ──
  const iconRotate = useTransform(dist, [-spread, 0, spread], [-65, 0, 65]);
  const iconScale = useTransform(dist, [-spread, 0, spread], [0.45, 1.25, 0.45]);
  const iconGlowSize = useTransform(dist, [-spread, 0, spread], [0, 60, 0]);
  const iconBoxShadow = useTransform(iconGlowSize, (s) => `0 0 ${s}px ${item.color}50, 0 0 ${s * 2}px ${item.color}20`);

  // ── Content parallax (no nested blur — parent handles it) ──
  const contentY = useTransform(dist, [-spread, 0, spread], [40, 0, -40]);

  // ── Subtitle: slide from left ──
  const subtitleX = useTransform(dist, [-spread, 0, spread], [-30, 0, 30]);
  const subtitleOpacity = useTransform(dist, [-spread, -spread * 0.25, spread * 0.25, spread], [0, 1, 1, 0]);

  // ── Title: scale + letter-spacing breathe ──
  const titleScale = useTransform(dist, [-spread, 0, spread], [0.85, 1.05, 0.85]);
  const titleSpacing = useTransform(dist, [-spread, 0, spread], ["0.04em", "-0.02em", "0.04em"]);

  // ── Description: gentle parallax ──
  const descY = useTransform(dist, [-spread, 0, spread], [20, 0, -20]);

  // ── Metrics: stagger reveal ──
  const metricsY = useTransform(dist, [-spread * 0.85, -spread * 0.1, spread * 0.1, spread * 0.85], [30, 0, 0, -30]);
  const metricsOpacity = useTransform(dist, [-spread, -spread * 0.2, spread * 0.2, spread], [0, 1, 1, 0]);

  // ── Tags: cascade ──
  const tagsY = useTransform(dist, [-spread * 0.7, -spread * 0.05, spread * 0.05, spread * 0.7], [20, 0, 0, -20]);
  const tagsOpacity = useTransform(dist, [-spread * 0.8, -spread * 0.15, spread * 0.15, spread * 0.8], [0, 1, 1, 0]);

  // ── CTA: slide from right ──
  const ctaX = useTransform(dist, [-spread, 0, spread], [25, 0, -25]);
  const ctaOpacity = useTransform(dist, [-spread * 0.7, -spread * 0.1, spread * 0.1, spread * 0.7], [0, 1, 1, 0]);

  // ── Corner accents: draw-in ──
  const cornerScale = useTransform(dist, [-spread * 0.5, 0, spread * 0.5], [0.3, 1, 0.3]);
  const cornerOpacity = useTransform(dist, [-spread, -spread * 0.25, spread * 0.25, spread], [0, 1, 1, 0]);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center px-6"
      style={{
        y,
        opacity,
        scale,
        rotateX,
        skewY,
        transformPerspective: 1400,
        filter: cardFilter,
        zIndex,
        willChange: "transform, opacity, filter",
      }}
    >
      <div className="vault-display relative w-full max-w-3xl mx-auto min-h-[378px] overflow-hidden" style={{ transform: "scale(0.9)", transformOrigin: "center center" }}>
        {/* Background glow */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 45%, ${item.glow}, transparent 65%)`,
            opacity: glowOpacity,
            scale: glowScale,
          }}
        />

        {/* Content with parallax (no nested blur) */}
        <motion.div
          className="relative z-10 p-5 lg:p-9 h-full flex flex-col"
          style={{ y: contentY }}
        >
          {/* Category badge */}
          <motion.div
            className="flex items-center gap-2 mb-4"
            style={{ x: subtitleX, opacity: subtitleOpacity }}
          >
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: item.color }} />
            <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: item.color }}>
              {item.category}
            </span>
          </motion.div>

          {/* Icon with rotation + expanding glow */}
          <motion.div className="mb-5" style={{ rotate: iconRotate, scale: iconScale }}>
            <motion.div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${item.color}28, ${item.color}08)`,
                border: `1px solid ${item.color}45`,
                boxShadow: iconBoxShadow,
              }}
            >
              <Icon className="w-5 h-5" style={{ color: item.color }} />
            </motion.div>
          </motion.div>

          {/* Title with scale + letter-spacing breathe */}
          <motion.h3
            className="text-xl lg:text-2xl font-black text-white mb-4"
            style={{ scale: titleScale, letterSpacing: titleSpacing }}
          >
            {item.title}
          </motion.h3>

          {/* Description with gentle parallax */}
          <motion.p
            className="text-gray-400 text-xs leading-relaxed mb-4 max-w-xl"
            style={{ y: descY }}
          >
            {item.desc}
          </motion.p>

          {/* Metrics with stagger reveal */}
          <motion.div
            className="grid grid-cols-3 gap-2 mb-4"
            style={{ y: metricsY, opacity: metricsOpacity }}
          >
            {item.metrics.map((m) => (
              <div key={m.label} className="holo-glass p-2.5 text-center">
                <div className="text-lg font-black mb-0.5" style={{ color: item.color }}>
                  {m.value}
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">{m.label}</div>
              </div>
            ))}
          </motion.div>

          {/* Tags with cascade */}
          <motion.div
            className="flex flex-wrap gap-2 mb-4"
            style={{ y: tagsY, opacity: tagsOpacity }}
          >
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-white/[0.03] border border-white/5"
              >
                {tag}
              </span>
            ))}
          </motion.div>

          {/* CTA sliding from right */}
          <motion.div className="mt-auto" style={{ x: ctaX, opacity: ctaOpacity }}>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white group"
            >
              <span>View case study</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" style={{ color: item.color }} />
            </a>
          </motion.div>
        </motion.div>

        {/* Corner accents with draw-in */}
        {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos) => (
          <motion.div
            key={pos}
            className={`vault-corner ${pos}`}
            style={{ borderColor: item.color, scale: cornerScale, opacity: cornerOpacity }}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default function Interactive3DShowcase() {
  const containerRef = useRef(null);
  const scrollProgress = useMotionValue(0);
  const smoothProgress = useSpring(scrollProgress, { stiffness: 150, damping: 40, mass: 0.8, overshootClamping: true });
  const velocity = useMotionValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  const total = vault.length;

  useEffect(() => {
    setIsReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    let lastP = 0;
    let lastT = performance.now();

    const onScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.max(0, Math.min(1, -rect.top / (rect.height - vh)));

      const now = performance.now();
      const dt = now - lastT;
      if (dt > 0) {
        const v = (progress - lastP) * 1000 / dt;
        velocity.set(Math.max(-4, Math.min(4, v)));
      }
      lastP = progress;
      lastT = now;

      scrollProgress.set(progress);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollProgress, velocity]);

  useEffect(() => {
    const unsub = smoothProgress.on("change", (p) => {
      setActiveIndex(Math.min(total - 1, Math.max(0, Math.floor(p * total))));
    });
    return () => unsub();
  }, [smoothProgress, total]);

  // Header stays sticky throughout all vault cards — fades with the sticky container naturally
  const headerOpacity = useTransform(smoothProgress, [0, 1], [1, 1]);
  const headerY = useTransform(smoothProgress, [0, 1], [0, 0]);

  // Global progress bar
  const progressWidth = useTransform(smoothProgress, [0, 1], ["0%", "100%"]);

  // Scene counter opacity (visible during card sequence)
  const counterOpacity = useTransform(smoothProgress, [0, 0.05, 0.93, 1], [0, 1, 1, 0]);

  // Scroll hint fades after first card
  const hintOpacity = useTransform(smoothProgress, [0, 0.08], [1, 0]);

  // ── Reduced motion: static fallback ──
  if (isReducedMotion) {
    return (
      <section id="showcase-content" className="relative py-32 bg-[#060614]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-52">
            <div className="cinematic-badge mb-4 inline-flex">
              <span>Product Vault</span>
            </div>
            <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight ">
              PRODUCTS THAT DEFINE INDUSTRIES
            </h2>

            
            <p className="text-gray-500 max-w-xl mx-auto text-sm mt-3">
              Explore our vault of enterprise-grade products trusted by millions worldwide.
            </p>
          </div>
          <div className="space-y-8">
            {vault.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="vault-display relative p-8 lg:p-12 overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-30 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at 50% 50%, ${item.glow}, transparent 65%)` }}
                  />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                      <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: item.color }}>
                        {item.category}
                      </span>
                    </div>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: `linear-gradient(135deg, ${item.color}28, ${item.color}08)`, border: `1px solid ${item.color}45` }}>
                      <Icon className="w-8 h-8" style={{ color: item.color }} />
                    </div>
                    <h3 className="text-3xl lg:text-4xl font-black text-white mb-4">{item.title}</h3>
                    <p className="text-gray-400 text-lg leading-relaxed mb-6 max-w-2xl">{item.desc}</p>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {item.metrics.map((m) => (
                        <div key={m.label} className="holo-glass p-5 text-center">
                          <div className="text-3xl font-black mb-1" style={{ color: item.color }}>{m.value}</div>
                          <div className="text-xs text-gray-500 uppercase tracking-wider">{m.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {item.tags.map((tag) => (
                        <span key={tag} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-white/[0.03] border border-white/5">{tag}</span>
                      ))}
                    </div>
                    <a href="/contact" className="inline-flex items-center gap-2 text-sm font-semibold text-white group">
                      <span>View case study</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" style={{ color: item.color }} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={containerRef}
      className="relative"
      style={{ height: `${(total + 1) * 100}vh` }}
    >
      <div className="sticky top-0 h-screen overflow-hidden flex items-center" style={{ perspective: "1400px" }}>
        {/* ── Atmospheric background layers ── */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#030308] via-[#060614] to-[#030308]" />
        <div className="absolute inset-0 grid-bg opacity-[0.04]" />

        {/* Drifting ambient glow orbs for depth */}
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${vault[activeIndex].glow}, transparent 60%)`,
            filter: "blur(80px)",
            top: "10%",
            left: "5%",
          }}
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${vault[activeIndex].glow}, transparent 60%)`,
            filter: "blur(80px)",
            bottom: "10%",
            right: "5%",
          }}
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* ── Scene counter (film slate) ── */}
        <motion.div
          className="absolute top-1/2 left-6 md:left-10 -translate-y-1/2 z-30 pointer-events-none"
          style={{ opacity: counterOpacity }}
        >
          <div className="flex flex-col items-start gap-2">
            <div
              className="text-7xl md:text-8xl font-black leading-none tabular-nums"
              style={{ color: `${vault[activeIndex].color}25` }}
            >
              {String(activeIndex + 1).padStart(2, "0")}
            </div>
            <div className="text-xs uppercase tracking-[0.3em] text-gray-600 font-mono">
              / {String(total).padStart(2, "0")}
            </div>
          </div>
        </motion.div>

        {/* ── Header with scroll-driven fade ── */}
        <motion.div
          className="absolute top-20 left-1/2 z-30 text-center w-full max-w-5xl"
          style={{ opacity: headerOpacity, y: headerY, x: "-50%" }}
        >
          <div className="cinematic-badge mb-3">
            <span>Product Vault</span>
          </div>
          <h2
            className="cinematic-headline"
            style={{ fontSize: "clamp(3rem, 7vw, 5.5rem)" }}
          >
            <span className="block whitespace-nowrap">PRODUCTS THAT</span>
            <span className="block whitespace-nowrap">DEFINE INDUSTRIES</span>
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto text-xs mt-2">
            Explore our vault of enterprise-grade products trusted by millions worldwide.
          </p>
        </motion.div>

        {/* ── Vault cards — each slides down through viewport ── */}
        {vault.map((item, i) => (
          <VaultCard
            key={item.title}
            item={item}
            index={i}
            smoothProgress={smoothProgress}
            total={total}
            velocity={velocity}
          />
        ))}

        {/* ── Side progress indicator ── */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-3">
          {vault.map((item, i) => (
            <div
              key={item.title}
              className="w-1 h-10 rounded-full transition-all duration-500"
              style={{
                background: activeIndex === i ? item.color : "rgba(255,255,255,0.08)",
                boxShadow: activeIndex === i ? `0 0 12px ${item.color}80` : "none",
              }}
            />
          ))}
        </div>

        {/* ── Bottom progress bar with gradient through all vault colors ── */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/5 z-30">
          <motion.div
            className="h-full"
            style={{
              width: progressWidth,
              background: `linear-gradient(to right, ${vault.map((v) => v.color).join(", ")})`,
            }}
          />
        </div>

        {/* ── Scroll hint with pulse (fades after first card) ── */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 text-xs text-gray-500 flex items-center gap-2"
          style={{ opacity: hintOpacity }}
        >
          <motion.span
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            Scroll to explore
          </motion.span>
          <motion.div
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowDown className="w-3 h-3" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
