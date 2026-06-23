"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export default function Preloader() {
  const containerRef = useRef(null);
  const barRef = useRef(null);
  const numRef = useRef(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const bar = barRef.current;
    const num = numRef.current;
    if (!container || !bar || !num) return;

    const obj = { p: 0 };
    const tl = gsap.timeline();

    tl.to(obj, {
      p: 100,
      duration: 1.8,
      ease: "power2.inOut",
      onUpdate: () => {
        const v = Math.floor(obj.p);
        if (bar) bar.style.width = `${v}%`;
        if (num) num.textContent = v;
      },
    });

    tl.to(container, {
      yPercent: -100,
      duration: 0.8,
      ease: "power3.inOut",
      delay: 0.2,
      onComplete: () => setDone(true),
    });

    return () => {
      tl.kill();
    };
  }, []);

  if (done) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "#050505",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontSize: "clamp(2rem, 8vw, 5rem)",
          fontWeight: 800,
          background: "linear-gradient(135deg, #3b82f6, #00d4ff)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: "2rem",
          letterSpacing: "-0.04em",
        }}
      >
        Wehoware
      </div>
      <div
        style={{
          width: "min(300px, 80vw)",
          height: "2px",
          background: "rgba(255,255,255,0.08)",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <div
          ref={barRef}
          style={{
            width: "0%",
            height: "100%",
            background: "linear-gradient(90deg, #3b82f6, #00d4ff)",
            boxShadow: "0 0 12px rgba(59,130,246,0.6)",
          }}
        />
      </div>
      <div
        ref={numRef}
        style={{
          marginTop: "1rem",
          fontVariantNumeric: "tabular-nums",
          color: "#64748b",
          fontSize: "0.875rem",
        }}
      >
        0
      </div>
    </div>
  );
}
