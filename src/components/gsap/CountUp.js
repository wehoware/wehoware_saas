"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function CountUp({
  end = 0,
  duration = 2,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obj = { v: 0 };
    const ctx = gsap.context(() => {
      gsap.to(obj, {
        v: end,
        duration,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
        onUpdate: () => setVal(obj.v),
      });
    }, ref);

    return () => ctx.revert();
  }, [end, duration]);

  const formatted = val >= 1000
    ? Math.floor(val).toLocaleString()
    : val.toFixed(decimals);

  return (
    <span ref={ref} className={className}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
