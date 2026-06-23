"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

export default function ScrollCameraRig({
  positions = [
    { z: 8, y: 0, x: 0 },
    { z: 5, y: 1, x: -1 },
    { z: 3, y: 0, x: 0 },
    { z: 6, y: -1, x: 1 },
  ],
  lookAt = [0, 0, 0],
}) {
  const { camera } = useThree();
  const targetRef = useRef({ x: 0, y: 0, z: 8 });
  const currentRef = useRef({ x: 0, y: 0, z: 8 });

  const lastScrollRef = useRef(0);
  const velocityRef = useRef(0);

  useFrame((state) => {
    if (typeof window === "undefined") return;
    const scrollProgress = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
    const clamped = Math.max(0, Math.min(1, scrollProgress));

    // Track scroll velocity and direction for dynamic camera response
    const rawVelocity = window.scrollY - lastScrollRef.current;
    velocityRef.current += (rawVelocity - velocityRef.current) * 0.1;
    lastScrollRef.current = window.scrollY;

    const segmentCount = positions.length - 1;
    const seg = Math.min(Math.floor(clamped * segmentCount), segmentCount - 1);
    const t = clamped * segmentCount - seg;

    const a = positions[seg];
    const b = positions[seg + 1];

    targetRef.current.x = a.x + (b.x - a.x) * t;
    targetRef.current.y = a.y + (b.y - a.y) * t;
    targetRef.current.z = a.z + (b.z - a.z) * t;

    // Adaptive lerp - faster when scrolling fast, smoother when slow
    const lerpFactor = 0.04 + Math.min(Math.abs(velocityRef.current) * 0.0008, 0.06);

    currentRef.current.x += (targetRef.current.x - currentRef.current.x) * lerpFactor;
    currentRef.current.y += (targetRef.current.y - currentRef.current.y) * lerpFactor;
    currentRef.current.z += (targetRef.current.z - currentRef.current.z) * lerpFactor;

    camera.position.x = currentRef.current.x;
    camera.position.y = currentRef.current.y;
    camera.position.z = currentRef.current.z;
    camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
  });

  return null;
}
