"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { Search, PenTool, Code2, Rocket, RefreshCw, ArrowDown, ArrowUpRight } from "lucide-react";

const chambers = [
  {
    number: "01",
    icon: Search,
    title: "DISCOVERY",
    subtitle: "Understanding Your Vision",
    description:
      "We immerse ourselves in your world — analyzing market dynamics, user behaviors, and technical constraints to architect the perfect blueprint.",
    deliverables: ["Market Research", "User Personas", "Technical Spec", "Project Roadmap"],
    accent: "#3b82f6",
    accentRgb: "59, 130, 246",
    duration: "Week 1–2",
  },
  {
    number: "02",
    icon: PenTool,
    title: "DESIGN",
    subtitle: "Crafting the Experience",
    description:
      "Where cinema meets functionality. Our designers create immersive, intuitive interfaces backed by design systems that scale across every touchpoint.",
    deliverables: ["UI/UX Design", "Prototyping", "Design System", "User Testing"],
    accent: "#00d4ff",
    accentRgb: "0, 212, 255",
    duration: "Week 3–4",
  },
  {
    number: "03",
    icon: Code2,
    title: "DEVELOP",
    subtitle: "Engineering Excellence",
    description:
      "AI-assisted development meets human craftsmanship. Clean code, scalable architecture, and continuous integration ensure precision at every layer.",
    deliverables: ["Frontend", "Backend", "AI Integration", "Cloud Setup"],
    accent: "#818cf8",
    accentRgb: "129, 140, 248",
    duration: "Week 5–8",
  },
  {
    number: "04",
    icon: Rocket,
    title: "DEPLOY",
    subtitle: "Launch & Scale",
    description:
      "From zero to production in record time. Automated deployment pipelines, monitoring, and scaling strategies that handle growth effortlessly.",
    deliverables: ["CI/CD Pipeline", "Cloud Deploy", "Monitoring", "Performance"],
    accent: "#c084fc",
    accentRgb: "192, 132, 252",
    duration: "Week 9",
  },
  {
    number: "05",
    icon: RefreshCw,
    title: "EVOLVE",
    subtitle: "Continuous Innovation",
    description:
      "We don't stop at launch. Data-driven iteration, feature evolution, and growth engineering ensure your product stays ahead of the curve.",
    deliverables: ["Analytics", "A/B Testing", "Feature Updates", "Growth Engineering"],
    accent: "#34d399",
    accentRgb: "52, 211, 153",
    duration: "Ongoing",
  },
];

function ChamberCard({ chamber, index, x, scrollProgress, layout, totalChambers }) {
  const { chamberWidth, gap, paddingLeft, viewportWidth } = layout;
  const Icon = chamber.icon;
  const rgb = chamber.accentRgb;

  // Center of this chamber in track coordinates
  const chamberCenter = paddingLeft + index * (chamberWidth + gap) + chamberWidth / 2;

  // Distance from viewport center: 0 = centered, + = right (not yet reached), - = left (passed)
  const distance = useTransform(x, (xVal) => chamberCenter + xVal - viewportWidth / 2);

  // Normalized: 0 = centered, ±1 = one chamber width away
  const rawNorm = useTransform(distance, (d) => (chamberWidth > 0 ? d / chamberWidth : 0));
  // Spring-smoothed norm for buttery, organic motion
  const norm = useSpring(rawNorm, { stiffness: 120, damping: 30, mass: 0.5 });

  // ── Chamber container (wide ranges for slow cinematic fade) ──
  const opacity = useTransform(norm, [-2.5, -1, -0.3, 0, 0.3, 1, 2.5], [0, 0.15, 0.7, 1, 0.7, 0.15, 0]);
  const scale = useTransform(norm, [-2, -0.5, 0, 0.5, 2], [0.75, 0.95, 1, 0.95, 0.75]);
  const rotateY = useTransform(norm, [-1.8, 0, 1.8], [22, 0, -22]);
  const chamberBlur = useTransform(norm, [-2.5, -0.6, 0, 0.6, 2.5], [12, 0, 0, 0, 12]);
  const chamberFilter = useTransform(chamberBlur, (b) => `blur(${b}px)`);

  // ── Background number (deep parallax + blur) ──
  const numberX = useTransform(norm, [-2, 0, 2], [180, 0, -180]);
  const numberScale = useTransform(norm, [-2.5, 0, 2.5], [1.8, 1, 1.8]);
  const numberOpacity = useTransform(norm, [-3.5, -0.5, 0, 0.5, 3.5], [0.02, 0.85, 1, 0.85, 0.02]);
  const numberBlur = useTransform(norm, [-2.5, -0.5, 0, 0.5, 2.5], [14, 0, 0, 0, 14]);
  const numberFilter = useTransform(numberBlur, (b) => `blur(${b}px)`);

  // ── Content parallax (deeper for cinematic depth) ──
  const contentY = useTransform(norm, [-1.5, 0, 1.5], [100, 0, -100]);
  const contentBlur = useTransform(norm, [-2, -0.3, 0, 0.3, 2], [10, 0, 0, 0, 10]);
  const contentFilter = useTransform(contentBlur, (b) => `blur(${b}px)`);

  // ── Icon (rotation + scale pop + glow + ring) ──
  const iconRotate = useTransform(norm, [-1.5, 0, 1.5], [-65, 0, 65]);
  const iconScale = useTransform(norm, [-1.5, 0, 1.5], [0.5, 1.3, 0.5]);
  const glowSize = useTransform(norm, [-1.5, 0, 1.5], [0, 100, 0]);
  const glowBoxShadow = useTransform(
    glowSize,
    (s) => `0 0 ${s}px rgba(${rgb}, 0.4), 0 0 ${s * 2.5}px rgba(${rgb}, 0.2)`
  );
  const ringRotate = useTransform(norm, [-2, 0, 2], [-120, 0, 120]);
  const ringScale = useTransform(norm, [-1.5, 0, 1.5], [0.6, 1.15, 0.6]);
  const ringOpacity = useTransform(norm, [-1.5, -0.2, 0, 0.2, 1.5], [0, 0.4, 0.8, 0.4, 0]);

  // ── Accent light beam (vertical beam from top) ──
  const beamOpacity = useTransform(norm, [-1, -0.1, 0, 0.1, 1], [0, 0.5, 0.8, 0.5, 0]);
  const beamHeight = useTransform(norm, [-1.5, 0, 1.5], ["30%", "100%", "30%"]);

  // ── Subtitle (slide + fade) ──
  const subtitleX = useTransform(norm, [-1.5, 0, 1.5], [-60, 0, 60]);
  const subtitleOpacity = useTransform(norm, [-1.5, -0.4, 0, 0.4, 1.5], [0, 0.5, 1, 0.5, 0]);

  // ── Title (scale + letter-spacing) ──
  const titleScale = useTransform(norm, [-1.5, 0, 1.5], [0.8, 1.1, 0.8]);
  const titleSpacing = useTransform(norm, [-1.5, 0, 1.5], ["0.05em", "-0.02em", "0.05em"]);
  const titleOpacity = useTransform(norm, [-2, -0.3, 0, 0.3, 2], [0, 0.6, 1, 0.6, 0]);

  // ── Description (parallax y + fade) ──
  const descY = useTransform(norm, [-1.5, 0, 1.5], [40, 0, -40]);
  const descOpacity = useTransform(norm, [-1.5, -0.3, 0, 0.3, 1.5], [0, 0.5, 1, 0.5, 0]);

  // ── Deliverables (stagger reveal) ──
  const delivY = useTransform(norm, [-1.2, -0.2, 0.2, 1.2], [50, 0, 0, -50]);
  const delivOpacity = useTransform(norm, [-1.5, -0.4, 0, 0.4, 1.5], [0, 0.4, 1, 0.4, 0]);

  // ── Active glow background (wider for slow build) ──
  const glowBgOpacity = useTransform(norm, [-1, 0, 1], [0, 1, 0]);
  const glowBgScale = useTransform(norm, [-1.5, 0, 1.5], [0.8, 1.1, 0.8]);

  // ── Vignette overlay (darkens edges when active) ──
  const vignetteOpacity = useTransform(norm, [-1, -0.2, 0, 0.2, 1], [0, 0.3, 0.6, 0.3, 0]);

  return (
    <motion.div
      className="chamber relative flex-shrink-0"
      style={{
        width: "80vw",
        maxWidth: "900px",
        opacity,
        scale,
        rotateY,
        filter: chamberFilter,
        transformPerspective: 1200,
        willChange: "transform, opacity, filter",
      }}
    >
      {/* Accent light beam from top */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px pointer-events-none"
        style={{
          height: beamHeight,
          background: `linear-gradient(to bottom, transparent, rgba(${rgb}, 0.6), transparent)`,
          opacity: beamOpacity,
        }}
      />

      {/* Active accent glow with scale */}
      <motion.div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 30% 50%, rgba(${rgb}, 0.1), transparent 70%)`,
          opacity: glowBgOpacity,
          scale: glowBgScale,
        }}
      />

      {/* Cinematic vignette */}
      <motion.div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)`,
          opacity: vignetteOpacity,
        }}
      />

      {/* Background number with deep parallax */}
      <motion.div
        className="chamber-number"
        style={{
          color: `rgba(${rgb}, 0.12)`,
          x: numberX,
          scale: numberScale,
          opacity: numberOpacity,
          filter: numberFilter,
        }}
      >
        {chamber.number}
      </motion.div>

      {/* Content with parallax + blur */}
      <motion.div
        className="relative z-10 max-w-2xl"
        style={{ y: contentY, filter: contentFilter }}
      >
        {/* Icon orb with rotating ring + glow pulse */}
        <motion.div className="mb-8 relative" style={{ rotate: iconRotate, scale: iconScale }}>
          {/* Rotating accent ring */}
          <motion.div
            className="absolute -inset-3 rounded-full pointer-events-none"
            style={{
              border: `1px solid rgba(${rgb}, 0.3)`,
              borderTopColor: `rgba(${rgb}, 0.8)`,
              rotate: ringRotate,
              scale: ringScale,
              opacity: ringOpacity,
            }}
          />
          <motion.div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 relative"
            style={{
              background: `linear-gradient(135deg, rgba(${rgb}, 0.15), rgba(${rgb}, 0.03))`,
              border: `1px solid rgba(${rgb}, 0.3)`,
              boxShadow: glowBoxShadow,
              backdropFilter: "blur(12px)",
            }}
          >
            <Icon className="w-10 h-10" style={{ color: chamber.accent }} />
          </motion.div>
        </motion.div>

        {/* Subtitle with slide-in */}
        <motion.div
          className="text-xs uppercase tracking-[0.2em] mb-2 flex items-center gap-3"
          style={{ color: chamber.accent, x: subtitleX, opacity: subtitleOpacity }}
        >
          <span>{chamber.subtitle}</span>
          <span className="text-gray-600">·</span>
          <span className="text-gray-500">{chamber.duration}</span>
        </motion.div>

        {/* Title with scale + letter-spacing + opacity animation */}
        <motion.h3
          className="text-5xl md:text-6xl font-black text-white mb-6"
          style={{ scale: titleScale, letterSpacing: titleSpacing, opacity: titleOpacity }}
        >
          {chamber.title}
        </motion.h3>

        {/* Description with parallax y + fade */}
        <motion.p
          className="text-gray-400 text-lg leading-relaxed mb-8 max-w-xl"
          style={{ y: descY, opacity: descOpacity }}
        >
          {chamber.description}
        </motion.p>

        {/* Deliverables with per-item stagger reveal */}
        <motion.div
          className="grid grid-cols-2 gap-3 max-w-md"
          style={{ y: delivY, opacity: delivOpacity }}
        >
          {chamber.deliverables.map((d, di) => (
            <DeliverableItem
              key={d}
              label={d}
              index={di}
              norm={norm}
              accent={chamber.accent}
              rgb={rgb}
            />
          ))}
        </motion.div>
      </motion.div>

      {/* Per-chamber progress dots */}
      <div className="absolute bottom-12 left-0 right-0 flex items-center gap-2 px-8">
        {Array.from({ length: totalChambers }).map((_, idx) => (
          <ProgressDot
            key={`${chamber.number}-${idx}`}
            dotIndex={idx}
            scrollProgress={scrollProgress}
            total={totalChambers}
            accent={chamber.accent}
          />
        ))}
      </div>
    </motion.div>
  );
}

function DeliverableItem({ label, index, norm, accent, rgb }) {
  const itemOpacity = useTransform(
    norm,
    [-1.2, -0.3 - index * 0.08, 0, 0.3 + index * 0.08, 1.2],
    [0, 0.3, 1, 0.3, 0]
  );
  const itemX = useTransform(norm, [-1.5, 0, 1.5], [30 + index * 10, 0, -30 - index * 10]);
  return (
    <motion.div
      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 transition-colors hover:border-white/10"
      style={{ opacity: itemOpacity, x: itemX }}
    >
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 6px rgba(${rgb}, 0.6)` }} />
      <span className="text-sm text-gray-300">{label}</span>
      <ArrowUpRight className="w-3 h-3 ml-auto text-gray-600" />
    </motion.div>
  );
}

function ProgressDot({ dotIndex, scrollProgress, total, accent }) {
  const fill = useTransform(
    scrollProgress,
    [dotIndex / total, (dotIndex + 0.8) / total],
    [0, 1]
  );
  return (
    <div className="h-0.5 flex-1 rounded-full bg-white/5 overflow-hidden">
      <motion.div
        className="h-full origin-left"
        style={{ scaleX: fill, background: accent }}
      />
    </div>
  );
}

export default function ProcessSection() {
  const containerRef = useRef(null);
  const x = useMotionValue(0);
  const scrollProgress = useMotionValue(0);
  const [layout, setLayout] = useState({
    xStart: 0,
    scrollRange: 0,
    chamberWidth: 0,
    gap: 32,
    paddingLeft: 0,
    viewportWidth: 0,
  });

  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const chamberWidth = Math.min(vw * 0.8, 900);
      const paddingLeft = vw * 0.1;
      const gap = 32;

      // Center of first chamber in track coords
      const firstCenter = paddingLeft + chamberWidth / 2;
      // Center of last chamber in track coords
      const lastCenter =
        paddingLeft + (chambers.length - 1) * (chamberWidth + gap) + chamberWidth / 2;

      // x at scroll 0: chamber 0 is perfectly centered (norm = 0, full opacity)
      const xStart = vw / 2 - firstCenter;
      // x at scroll 1: chamber N is perfectly centered (norm = 0, full opacity)
      const xEnd = vw / 2 - lastCenter;
      const scrollRange = xStart - xEnd;

      setLayout({
        xStart,
        scrollRange: Math.max(0, scrollRange),
        chamberWidth,
        gap,
        paddingLeft,
        viewportWidth: vw,
      });
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
      const rawProgress = Math.max(0, Math.min(1, -rect.top / (rect.height - vh)));
      // Ease-in-out cubic for slow-motion cinematic feel: slow start, fast middle, slow end
      const easedProgress =
        rawProgress < 0.5
          ? 4 * rawProgress * rawProgress * rawProgress
          : 1 - Math.pow(-2 * rawProgress + 2, 3) / 2;
      scrollProgress.set(rawProgress);
      // x goes from xStart (progress 0) to xStart - scrollRange (progress 1)
      x.set(layout.xStart - easedProgress * layout.scrollRange);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [layout.xStart, layout.scrollRange, x, scrollProgress]);

  // Header fade out as you scroll into chambers
  const headerOpacity = useTransform(scrollProgress, [0, 0.1, 0.9, 1], [1, 1, 0.3, 0]);
  const headerY = useTransform(scrollProgress, [0, 0.1, 0.9, 1], [0, 0, -20, -40]);

  // Global progress bar width
  const progressWidth = useTransform(scrollProgress, [0, 1], ["0%", "100%"]);

  // Active chamber index (0-based, fractional)
  const activeIndex = useTransform(scrollProgress, (v) => v * (chambers.length - 1));
  const activeIndexRounded = useTransform(activeIndex, (v) => Math.round(v));
  const activeCounter = useTransform(activeIndexRounded, (v) => String(v + 1).padStart(2, "0"));
  const activeAccent = useTransform(activeIndexRounded, (v) => chambers[Math.max(0, Math.min(chambers.length - 1, v))].accent);
  const activeRgb = useTransform(activeIndexRounded, (v) => chambers[Math.max(0, Math.min(chambers.length - 1, v))].accentRgb);

  // Ambient glow color follows active chamber
  const ambientGlow = useTransform(activeRgb, (rgb) => `radial-gradient(ellipse at 50% 60%, rgba(${rgb}, 0.08), transparent 60%)`);

  // Scroll hint fades out after 15% scroll
  const scrollHintOpacity = useTransform(scrollProgress, [0, 0.15], [1, 0]);

  return (
    <section
      ref={containerRef}
      className="relative"
      style={{ height: `${(chambers.length + 3) * 100}vh` }}
    >
      <div className="sticky top-0 h-screen overflow-hidden flex items-center">
        <div className="absolute inset-0 bg-gradient-to-r from-[#030308] via-[#060614] to-[#030308]" />
        <div className="absolute inset-0 grid-bg opacity-5" />
        {/* Ambient accent glow that follows active chamber */}
        <motion.div className="absolute inset-0 pointer-events-none" style={{ background: ambientGlow }} />

        {/* Header with scroll-driven fade */}
        <motion.div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-20 text-center"
          style={{ opacity: headerOpacity, y: headerY }}
        >
          <div className="cinematic-badge mb-4">
            <span>Development Pipeline</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            THE PROCESS
          </h2>
        </motion.div>

        {/* Active chamber counter (top-right) */}
        <motion.div
          className="absolute top-20 right-12 z-20 flex flex-col items-end gap-1"
          style={{ opacity: headerOpacity }}
        >
          <motion.span
            className="text-5xl font-black tabular-nums leading-none"
            style={{ color: activeAccent }}
          >
            {activeCounter}
          </motion.span>
          <span className="text-xs text-gray-600 tracking-widest uppercase">
            / {String(chambers.length).padStart(2, "0")}
          </span>
        </motion.div>

        {/* Horizontal track of chambers */}
        <motion.div
          style={{ x, willChange: "transform" }}
          className="flex gap-8 pl-[10vw]"
        >
          {chambers.map((chamber, i) => (
            <ChamberCard
              key={chamber.number}
              chamber={chamber}
              index={i}
              x={x}
              scrollProgress={scrollProgress}
              layout={layout}
              totalChambers={chambers.length}
            />
          ))}
        </motion.div>

        {/* Global progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-[#3b82f6] via-[#00d4ff] to-[#34d399]"
            style={{ width: progressWidth }}
          />
        </div>

        {/* Scroll hint with pulse */}
        <motion.div
          className="absolute bottom-8 right-8 text-xs text-gray-500 flex items-center gap-2"
          style={{ opacity: scrollHintOpacity }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <span>Scroll to explore</span>
          <motion.div
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowDown className="w-3 h-3" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
