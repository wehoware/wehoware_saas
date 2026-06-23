"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, Text } from "@react-three/drei";

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const TECH_ITEMS = [
  { label: "React", position: [2, 1, 0], color: "#61dafb" },
  { label: "Next.js", position: [-2, 1.5, 1], color: "#ffffff" },
  { label: "Node", position: [0, 2, -1], color: "#68a063" },
  { label: "Python", position: [-2.5, -0.5, 0.5], color: "#3776ab" },
  { label: "AWS", position: [2.5, -1, -0.5], color: "#ff9900" },
  { label: "Docker", position: [1, -2, 1], color: "#2496ed" },
  { label: "MySQL", position: [-1, -1.5, -1], color: "#00758f" },
  { label: "GSAP", position: [0, 0, 2], color: "#88ce02" },
];

export default function TechGraph() {
  const groupRef = useRef();

  const lines = useMemo(() => {
    const pts = [];
    const rand = seededRandom(99);
    for (let i = 0; i < TECH_ITEMS.length; i++) {
      for (let j = i + 1; j < TECH_ITEMS.length; j++) {
        if (rand() > 0.6) {
          pts.push(...TECH_ITEMS[i].position);
          pts.push(...TECH_ITEMS[j].position);
        }
      }
    }
    return new Float32Array(pts);
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.08;
  });

  return (
    <group ref={groupRef}>
      {TECH_ITEMS.map((tech, i) => (
        <Float key={i} speed={1 + i * 0.1} rotationIntensity={0.5} floatIntensity={1}>
          <group position={tech.position}>
            <mesh>
              <sphereGeometry args={[0.15, 16, 16]} />
              <meshStandardMaterial
                color={tech.color}
                emissive={tech.color}
                emissiveIntensity={0.5}
                transparent
                opacity={0.8}
              />
            </mesh>
            <Text
              position={[0, 0.35, 0]}
              fontSize={0.22}
              color={tech.color}
              anchorX="center"
              anchorY="middle"
            >
              {tech.label}
            </Text>
          </group>
        </Float>
      ))}

      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={lines.length / 3}
            array={lines}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#3b82f6" transparent opacity={0.2} />
      </lineSegments>
    </group>
  );
}
