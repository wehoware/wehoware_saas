"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export default function ParticleField({ count = 8000, color = "#3b82f6", size = 0.015, radius = 8 }) {
  const pointsRef = useRef();

  const positions = useMemo(() => {
    const rand = seededRandom(42);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = radius * Math.cbrt(rand());
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count, radius]);

  const originalPositions = useMemo(() => positions.slice(), [positions]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const time = state.clock.elapsedTime;
    const positions = pointsRef.current.geometry.attributes.position.array;
    const mouse = state.mouse;

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      const ox = originalPositions[ix];
      const oy = originalPositions[iy];
      const oz = originalPositions[iz];

      const dx = ox - mouse.x * 5;
      const dy = oy - mouse.y * 5;
      const dist = Math.hypot(dx, dy);
      const repel = Math.max(0, 1.5 - dist) * 0.5;

      positions[ix] = ox + Math.sin(time * 0.3 + i * 0.01) * 0.1 + dx * repel * 0.3;
      positions[iy] = oy + Math.cos(time * 0.2 + i * 0.01) * 0.1 + dy * repel * 0.3;
      positions[iz] = oz + Math.sin(time * 0.4 + i * 0.02) * 0.05;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.rotation.y = time * 0.03;
    pointsRef.current.rotation.x = time * 0.01;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        color={color}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
