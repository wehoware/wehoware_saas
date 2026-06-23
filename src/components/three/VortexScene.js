"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import WormholeVortex from "./WormholeVortex";
import ScrollCameraRig from "./ScrollCameraRig";

export default function VortexScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 60 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={0.3} />
      <Suspense fallback={null}>
        <WormholeVortex count={4000} color="#3b82f6" />
      </Suspense>
      <ScrollCameraRig
        positions={[
          { x: 0, y: 0, z: 5 },
          { x: 0.5, y: 0.3, z: 3.5 },
          { x: -0.3, y: -0.2, z: 6 },
        ]}
        lookAt={[0, 0, 0]}
      />
    </Canvas>
  );
}
