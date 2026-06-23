"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function TextStagger({ text, className = "", tag = "h2", stagger = 0.03, y = 40, duration = 0.6, scrub = false }) {
  const ref = useRef(null);
  const Tag = tag;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const chars = el.querySelectorAll(".ts-char");
    if (chars.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        chars,
        { y, opacity: 0, rotateX: -90, scale: 0.8 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          scale: 1,
          duration,
          stagger,
          ease: "back.out(1.7)",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            toggleActions: "play reverse play reverse",
            scrub: scrub ? 1 : undefined,
          },
        }
      );
    }, ref);

    return () => ctx.revert();
  }, [stagger, y, duration, scrub]);

  const words = text.split(" ");

  return (
    <Tag ref={ref} className={className} style={{ perspective: "1000px" }}>
      {words.map((word, wi) => (
        <span key={wi} style={{ display: "inline-block", marginRight: "0.25em" }}>
          {word.split("").map((char, ci) => (
            <span
              key={ci}
              className="ts-char"
              style={{ display: "inline-block" }}
            >
              {char}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}
