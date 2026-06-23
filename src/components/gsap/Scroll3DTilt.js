"use client";

import { useRef } from "react";
import gsap from "gsap";

export default function Scroll3DTilt({
  children,
  className = "",
  max = 15,
  scale = 1.02,
  glare = true,
}) {
  const ref = useRef(null);
  const glareRef = useRef(null);

  const handleMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);

    gsap.to(el, {
      rotateY: dx * max,
      rotateX: -dy * max,
      scale,
      transformPerspective: 800,
      transformOrigin: "center",
      duration: 0.3,
      ease: "power2.out",
    });

    if (glare && glareRef.current) {
      gsap.to(glareRef.current, {
        opacity: 0.15,
        background: `radial-gradient(circle at ${(dx + 1) * 50}% ${(dy + 1) * 50}%, rgba(0,212,255,0.4), transparent 60%)`,
        duration: 0.3,
      });
    }
  };

  const handleMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    gsap.to(el, {
      rotateY: 0,
      rotateX: 0,
      scale: 1,
      duration: 0.6,
      ease: "elastic.out(1, 0.4)",
    });
    if (glareRef.current) {
      gsap.to(glareRef.current, { opacity: 0, duration: 0.4 });
    }
  };

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transformStyle: "preserve-3d", position: "relative" }}
    >
      {children}
      {glare && (
        <div
          ref={glareRef}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            opacity: 0,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}
    </div>
  );
}
