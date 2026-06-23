"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

export default function ScrollBackground() {
  const containerRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Orb 1 - large blue, moves diagonally
  const orb1X = useTransform(smoothProgress, [0, 0.25, 0.5, 0.75, 1], ["0%", "15%", "-10%", "20%", "5%"]);
  const orb1Y = useTransform(smoothProgress, [0, 0.25, 0.5, 0.75, 1], ["0%", "20%", "10%", "30%", "15%"]);
  const orb1Scale = useTransform(smoothProgress, [0, 0.5, 1], [1, 1.3, 1.1]);
  const orb1Opacity = useTransform(smoothProgress, [0, 0.3, 0.6, 1], [0.4, 0.6, 0.3, 0.5]);

  // Orb 2 - cyan, moves opposite
  const orb2X = useTransform(smoothProgress, [0, 0.25, 0.5, 0.75, 1], ["10%", "-15%", "5%", "-20%", "10%"]);
  const orb2Y = useTransform(smoothProgress, [0, 0.25, 0.5, 0.75, 1], ["20%", "10%", "30%", "5%", "25%"]);
  const orb2Scale = useTransform(smoothProgress, [0, 0.5, 1], [1.2, 0.9, 1.3]);
  const orb2Opacity = useTransform(smoothProgress, [0, 0.3, 0.6, 1], [0.3, 0.5, 0.6, 0.3]);

  // Orb 3 - purple, vertical sweep
  const orb3X = useTransform(smoothProgress, [0, 0.25, 0.5, 0.75, 1], ["-10%", "5%", "20%", "-5%", "15%"]);
  const orb3Y = useTransform(smoothProgress, [0, 0.25, 0.5, 0.75, 1], ["30%", "5%", "20%", "40%", "10%"]);
  const orb3Scale = useTransform(smoothProgress, [0, 0.5, 1], [0.9, 1.4, 1]);
  const orb3Opacity = useTransform(smoothProgress, [0, 0.3, 0.6, 1], [0.2, 0.4, 0.5, 0.6]);

  // Overall gradient shift
  const gradientAngle = useTransform(smoothProgress, [0, 1], [0, 360]);
  const gradientRotate = useTransform(gradientAngle, (v) => `${v}deg`);

  return (
    <div ref={containerRef} className="scroll-bg-container">
      <motion.div
        className="scroll-bg-orb scroll-bg-orb-1"
        style={{
          x: orb1X,
          y: orb1Y,
          scale: orb1Scale,
          opacity: orb1Opacity,
        }}
      />
      <motion.div
        className="scroll-bg-orb scroll-bg-orb-2"
        style={{
          x: orb2X,
          y: orb2Y,
          scale: orb2Scale,
          opacity: orb2Opacity,
        }}
      />
      <motion.div
        className="scroll-bg-orb scroll-bg-orb-3"
        style={{
          x: orb3X,
          y: orb3Y,
          scale: orb3Scale,
          opacity: orb3Opacity,
        }}
      />
      <motion.div
        className="scroll-bg-gradient"
        style={{ rotate: gradientRotate }}
      />
      <div className="scroll-bg-noise" />
      <div className="scroll-bg-vignette" />
    </div>
  );
}
