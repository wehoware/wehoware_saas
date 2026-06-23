"use client";

import { useEffect, useRef, useState } from "react";

export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const trailRef = useRef(null);
  const [isPointer, setIsPointer] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    const trail = trailRef.current;
    if (!dot || !ring || !trail) return;

    let mouseX = 0, mouseY = 0;
    let ringX = 0, ringY = 0;
    let trailX = 0, trailY = 0;
    const trailPoints = [];
    const MAX_TRAIL = 12;

    const handleMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      setHidden(false);
      dot.style.transform = `translate(${mouseX - 4}px, ${mouseY - 4}px)`;

      trailPoints.unshift({ x: mouseX, y: mouseY });
      if (trailPoints.length > MAX_TRAIL) trailPoints.pop();

      const target = e.target;
      const isClickable =
        target.closest("a, button, [role='button'], input, .cursor-pointer") !== null;
      setIsPointer(isClickable);
    };

    const handleLeave = () => setHidden(true);

    const animate = () => {
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;
      ring.style.transform = `translate(${ringX - 16}px, ${ringY - 16}px)`;

      trailX += (mouseX - trailX) * 0.08;
      trailY += (mouseY - trailY) * 0.08;
      trail.style.transform = `translate(${trailX - 24}px, ${trailY - 24}px)`;

      requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseleave", handleLeave);
    const raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  const opacity = hidden ? 0 : 1;

  return (
    <>
      <div
        ref={trailRef}
        style={{
          position: "fixed",
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%)",
          pointerEvents: "none",
          zIndex: 9997,
          top: 0,
          left: 0,
          opacity: isPointer ? opacity : opacity * 0.6,
          transition: "opacity 0.3s",
        }}
      />
      <div
        ref={dotRef}
        style={{
          position: "fixed",
          width: isPointer ? "12px" : "8px",
          height: isPointer ? "12px" : "8px",
          borderRadius: "50%",
          background: isPointer ? "#00d4ff" : "#60a5fa",
          boxShadow: isPointer ? "0 0 12px rgba(0,212,255,0.6)" : "0 0 8px rgba(96,165,250,0.4)",
          pointerEvents: "none",
          zIndex: 9999,
          top: 0,
          left: 0,
          opacity,
          transition: "width 0.2s, height 0.2s, background 0.2s, box-shadow 0.2s, opacity 0.3s",
        }}
      />
      <div
        ref={ringRef}
        style={{
          position: "fixed",
          width: isPointer ? "48px" : "32px",
          height: isPointer ? "48px" : "32px",
          borderRadius: "50%",
          border: `1.5px solid ${isPointer ? "#00d4ff" : "#3b82f6"}`,
          pointerEvents: "none",
          zIndex: 9998,
          top: 0,
          left: 0,
          opacity: isPointer ? opacity : opacity * 0.5,
          transition: "width 0.2s, height 0.2s, border-color 0.2s, opacity 0.3s",
        }}
      />
    </>
  );
}
