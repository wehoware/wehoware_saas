"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";

export default function FloatingGeometry() {
  const groupRef = useRef();

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.03;
  });

  return (
    <group ref={groupRef}>
      {/* Central distorted sphere */}
      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={1.5}>
        <mesh position={[0, 0, 0]}>
          <icosahedronGeometry args={[1.5, 4]} />
          <MeshDistortMaterial
            color="#3b82f6"
            distort={0.3}
            speed={2}
            roughness={0.1}
            metalness={0.9}
            transparent
            opacity={0.15}
          />
        </mesh>
      </Float>

      {/* Aurora-like ribbon 1 */}
      <Float speed={0.8} rotationIntensity={0.3} floatIntensity={0.8}>
        <mesh position={[4, 2, -3]} rotation={[0.5, 0.3, 0.2]}>
          <torusGeometry args={[1.5, 0.08, 16, 100]} />
          <meshStandardMaterial
            color="#00d4ff"
            transparent
            opacity={0.2}
            roughness={0.2}
            metalness={0.8}
            emissive="#00d4ff"
            emissiveIntensity={0.4}
          />
        </mesh>
      </Float>

      {/* Aurora-like ribbon 2 */}
      <Float speed={1.2} rotationIntensity={0.4} floatIntensity={1}>
        <mesh position={[-4, -2, -2]} rotation={[-0.3, 0.5, -0.2]}>
          <torusGeometry args={[1.2, 0.06, 16, 100]} />
          <meshStandardMaterial
            color="#818cf8"
            transparent
            opacity={0.15}
            roughness={0.2}
            metalness={0.8}
            emissive="#818cf8"
            emissiveIntensity={0.3}
          />
        </mesh>
      </Float>

      {/* Orbiting cubes */}
      <Float speed={2} rotationIntensity={1} floatIntensity={2}>
        <mesh position={[3, 1, -2]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial
            color="#60a5fa"
            wireframe
            transparent
            opacity={0.25}
          />
        </mesh>
      </Float>

      <Float speed={1.8} rotationIntensity={1.2} floatIntensity={1.8}>
        <mesh position={[-3, -1, -1]}>
          <octahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial
            color="#00d4ff"
            wireframe
            transparent
            opacity={0.25}
          />
        </mesh>
      </Float>

      <Float speed={2.5} rotationIntensity={0.8} floatIntensity={2.5}>
        <mesh position={[2, -2, 1]}>
          <torusGeometry args={[0.4, 0.15, 16, 32]} />
          <meshStandardMaterial
            color="#3b82f6"
            wireframe
            transparent
            opacity={0.3}
          />
        </mesh>
      </Float>

      <Float speed={1.2} rotationIntensity={1.5} floatIntensity={1.2}>
        <mesh position={[-2.5, 2, 0.5]}>
          <dodecahedronGeometry args={[0.45, 0]} />
          <meshStandardMaterial
            color="#60a5fa"
            wireframe
            transparent
            opacity={0.2}
          />
        </mesh>
      </Float>

      {/* Deep background shapes - visible at different scroll depths */}
      <Float speed={0.6} rotationIntensity={0.5} floatIntensity={1}>
        <mesh position={[5, 3, -5]}>
          <icosahedronGeometry args={[0.8, 1]} />
          <meshStandardMaterial
            color="#818cf8"
            transparent
            opacity={0.12}
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>
      </Float>

      <Float speed={0.9} rotationIntensity={0.8} floatIntensity={1.2}>
        <mesh position={[-5, -3, -4]}>
          <icosahedronGeometry args={[0.7, 1]} />
          <meshStandardMaterial
            color="#00d4ff"
            transparent
            opacity={0.12}
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>
      </Float>

      <Float speed={0.7} rotationIntensity={0.6} floatIntensity={0.9}>
        <mesh position={[3, -3, -3]}>
          <dodecahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial
            color="#3b82f6"
            transparent
            opacity={0.15}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
      </Float>

      <Float speed={1.1} rotationIntensity={0.9} floatIntensity={1.4}>
        <mesh position={[-3, 3, -3]}>
          <octahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial
            color="#60a5fa"
            transparent
            opacity={0.15}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
      </Float>

      {/* Large faint sphere - atmospheric depth */}
      <Float speed={0.4} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh position={[0, 0, -6]}>
          <sphereGeometry args={[3, 32, 32]} />
          <meshStandardMaterial
            color="#1a1a2e"
            transparent
            opacity={0.08}
            roughness={1}
            metalness={0}
          />
        </mesh>
      </Float>

      {/* Grid floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]}>
        <planeGeometry args={[30, 30, 30, 30]} />
        <meshBasicMaterial
          color="#1a1a2e"
          wireframe
          transparent
          opacity={0.15}
        />
      </mesh>
    </group>
  );
}
