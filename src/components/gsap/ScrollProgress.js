"use client";

import { useScrollProgress } from "@/hooks/useScrollProgress";

export default function ScrollProgress() {
  const progress = useScrollProgress();

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "3px",
        width: `${progress * 100}%`,
        background: "linear-gradient(90deg, #3b82f6, #00d4ff)",
        zIndex: 9997,
        boxShadow: "0 0 10px rgba(59, 130, 246, 0.5)",
        transition: "width 0.1s ease-out",
      }}
    />
  );
}
