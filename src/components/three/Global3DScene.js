"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import ParticleField from "./ParticleField";
import FloatingGeometry from "./FloatingGeometry";
import ScrollCameraRig from "./ScrollCameraRig";

export default function Global3DScene() {
  return (
    <div className="global-3d-bg">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.8} color="#3b82f6" />
        <pointLight position={[-10, -10, -5]} intensity={0.4} color="#00d4ff" />
        <pointLight position={[0, 5, 5]} intensity={0.3} color="#818cf8" />
        <fog attach="fog" args={["#050505", 5, 20]} />
        <Suspense fallback={null}>
          <ParticleField count={4000} color="#3b82f6" size={0.012} radius={10} />
          <FloatingGeometry />
        </Suspense>
        <ScrollCameraRig
          positions={[
            { x: 0, y: 0, z: 10 },
            { x: -1.5, y: 1, z: 7 },
            { x: 1, y: -1, z: 5 },
            { x: -0.5, y: 0.5, z: 8 },
            { x: 1.5, y: -0.5, z: 6 },
            { x: 0, y: 1, z: 9 },
            { x: -1, y: -1, z: 7 },
            { x: 0.5, y: 0.5, z: 10 },
          ]}
          lookAt={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
