"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import TechGraph from "./TechGraph";
import ScrollCameraRig from "./ScrollCameraRig";

export default function TechScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 60 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <Suspense fallback={null}>
        <TechGraph />
      </Suspense>
      <ScrollCameraRig
        positions={[
          { x: 0, y: 0, z: 7 },
          { x: 1, y: 0.5, z: 5 },
          { x: -0.5, y: -0.3, z: 8 },
        ]}
        lookAt={[0, 0, 0]}
      />
    </Canvas>
  );
}
