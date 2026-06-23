"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import ParticleField from "./ParticleField";
import FloatingGeometry from "./FloatingGeometry";
import ScrollCameraRig from "./ScrollCameraRig";

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 60 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#3b82f6" />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#00d4ff" />
      <Suspense fallback={null}>
        <ParticleField count={6000} color="#3b82f6" size={0.015} radius={8} />
        <FloatingGeometry />
      </Suspense>
      <ScrollCameraRig
        positions={[
          { x: 0, y: 0, z: 8 },
          { x: -1, y: 0.5, z: 6 },
          { x: 0.5, y: -0.3, z: 4 },
          { x: 0, y: 0, z: 7 },
        ]}
        lookAt={[0, 0, 0]}
      />
    </Canvas>
  );
}
