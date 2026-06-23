"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

export default function SeamlessSection({
  children,
  className = "",
  id = "",
}) {
  const ref = useRef(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Very subtle scale and opacity for connected sections without hurting readability
  const scale = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.99, 1, 1, 0.99]);
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0.85, 1, 1, 0.85]);

  // Very subtle Y parallax for depth
  const y = useTransform(scrollYProgress, [0, 1], [20, -20]);

  const smoothScale = useSpring(scale, { stiffness: 120, damping: 30 });
  const smoothOpacity = useSpring(opacity, { stiffness: 120, damping: 30 });
  const smoothY = useSpring(y, { stiffness: 80, damping: 25 });

  return (
    <motion.section
      ref={ref}
      id={id}
      className={`seamless-section ${className}`}
      style={{
        scale: smoothScale,
        opacity: smoothOpacity,
        y: smoothY,
      }}
    >
      {children}
    </motion.section>
  );
}
