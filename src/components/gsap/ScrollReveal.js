"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function ScrollReveal({
  children,
  className = "",
  y = 60,
  x = 0,
  opacity = 0,
  duration = 0.8,
  delay = 0,
  stagger = 0,
  scale = 1,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  once = false,
  scrub = false,
  start = "top 85%",
  end = "bottom 20%",
  ease = "power3.out",
  perspective = 1000,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets = stagger > 0 ? el.children : el;

    const ctx = gsap.context(() => {
      if (scrub) {
        gsap.fromTo(
          targets,
          { y, x, opacity, scale, rotateX, rotateY, rotateZ },
          {
            y: 0,
            x: 0,
            opacity: 1,
            scale: 1,
            rotateX: 0,
            rotateY: 0,
            rotateZ: 0,
            ease: "none",
            stagger: stagger > 0 ? stagger : 0,
            scrollTrigger: {
              trigger: el,
              start,
              end,
              scrub: 0.8,
            },
          }
        );
      } else {
        gsap.fromTo(
          targets,
          { y, x, opacity, scale, rotateX, rotateY, rotateZ },
          {
            y: 0,
            x: 0,
            opacity: 1,
            scale: 1,
            rotateX: 0,
            rotateY: 0,
            rotateZ: 0,
            duration,
            delay,
            stagger: stagger > 0 ? stagger : 0,
            ease,
            scrollTrigger: {
              trigger: el,
              start,
              toggleActions: once
                ? "play none none none"
                : "play reverse play reverse",
            },
          }
        );
      }
    }, ref);

    return () => ctx.revert();
  }, [y, x, opacity, duration, delay, stagger, scale, rotateX, rotateY, rotateZ, once, scrub, start, end, ease]);

  const style = perspective !== 0 ? { perspective: `${perspective}px` } : undefined;

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
