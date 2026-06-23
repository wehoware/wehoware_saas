"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

const ScrollCtx = createContext({
  scrollY: 0,
  direction: "down",
  velocity: 0,
  progress: 0,
});

export function useScrollCtx() {
  return useContext(ScrollCtx);
}

export function ScrollProvider({ children }) {
  const [state, setState] = useState({
    scrollY: 0,
    direction: "down",
    velocity: 0,
    progress: 0,
  });
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? scrollY / docHeight : 0;
        const direction = scrollY > lastY.current ? "down" : "up";
        const velocity = Math.abs(scrollY - lastY.current);
        lastY.current = scrollY;
        setState({ scrollY, direction, velocity, progress });
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return <ScrollCtx.Provider value={state}>{children}</ScrollCtx.Provider>;
}
