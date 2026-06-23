"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function ScrollParallax({
  children,
  className = "",
  speed = 0.3,
  direction = "vertical",
  start = "top bottom",
  end = "bottom top",
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const distance = speed * 200;

    const ctx = gsap.context(() => {
      const fromVars =
        direction === "horizontal"
          ? { x: -distance }
          : direction === "z"
            ? { z: distance, scale: 1.2 }
            : { y: -distance };

      const toVars =
        direction === "horizontal"
          ? { x: distance, ease: "none" }
          : direction === "z"
            ? { z: -distance, scale: 1, ease: "none" }
            : { y: distance, ease: "none" };

      gsap.fromTo(el, fromVars, {
        ...toVars,
        scrollTrigger: {
          trigger: el,
          start,
          end,
          scrub: 1,
        },
      });
    }, ref);

    return () => ctx.revert();
  }, [speed, direction, start, end]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
