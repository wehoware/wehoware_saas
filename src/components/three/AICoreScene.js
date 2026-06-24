"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import * as THREE from "three";

/* ── Core icosahedron with distort-like wobble ── */
function AICore() {
  const meshRef = useRef();
  const innerRef = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (meshRef.current) {
      meshRef.current.rotation.x = t * 0.15;
      meshRef.current.rotation.y = t * 0.2;
      // subtle wobble
      const scale = 1 + Math.sin(t * 0.8) * 0.03;
      meshRef.current.scale.setScalar(scale);
    }
    if (innerRef.current) {
      innerRef.current.rotation.x = -t * 0.3;
      innerRef.current.rotation.z = t * 0.25;
    }
  });

  return (
    <group>
      {/* Outer wireframe icosahedron */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[2.2, 1]} />
        <meshStandardMaterial
          color="#3b82f6"
          wireframe
          transparent
          opacity={0.4}
          emissive="#3b82f6"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Inner solid core */}
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[1.4, 0]} />
        <meshStandardMaterial
          color="#00d4ff"
          transparent
          opacity={0.15}
          emissive="#00d4ff"
          emissiveIntensity={0.8}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* Central glow sphere */}
      <mesh>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

/* ── Orbiting product nodes ── */
function OrbitingNodes() {
  const groupRef = useRef();
  const nodes = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const radius = 4.5;
        return {
          position: [
            Math.cos(angle) * radius,
            Math.sin(angle * 2) * 0.8,
            Math.sin(angle) * radius,
          ],
          color: i % 2 === 0 ? "#00d4ff" : "#818cf8",
          speed: 0.5 + i * 0.1,
        };
      }),
    []
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {nodes.map((node, i) => (
        <OrbitingNode key={i} {...node} index={i} />
      ))}
    </group>
  );
}

function OrbitingNode({ position, color, index }) {
  const ref = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(t * 0.8 + index) * 0.3;
      ref.current.rotation.x = t * 0.5;
      ref.current.rotation.y = t * 0.7;
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1}>
      <mesh ref={ref} position={position}>
        <octahedronGeometry args={[0.35, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          transparent
          opacity={0.7}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      {/* Glow halo */}
      <mesh position={position} scale={1.8}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.05} />
      </mesh>
    </Float>
  );
}

/* ── Neural connection lines ── */
function NeuralConnections() {
  const linesRef = useRef();
  const lineGeo = useMemo(() => {
    const points = [];
    const segments = 6;
    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;
      const radius = 4.5;
      points.push(
        new THREE.Vector3(Math.cos(angle1) * radius, 0, Math.sin(angle1) * radius),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(angle2) * radius, 0, Math.sin(angle2) * radius),
        new THREE.Vector3(0, 0, 0)
      );
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);

  useFrame((state) => {
    if (linesRef.current) {
      linesRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <line ref={linesRef} geometry={lineGeo}>
      <lineBasicMaterial color="#3b82f6" transparent opacity={0.15} />
    </line>
  );
}

/* ── Particle field around core ── */
function CoreParticles({ count = 800 }) {
  const ref = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 5 + Math.random() * 8;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(ph) * Math.cos(th);
      arr[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      arr[i * 3 + 2] = r * Math.cos(ph);
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.03;
      ref.current.rotation.x = state.clock.elapsedTime * 0.01;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#00d4ff"
        transparent
        opacity={0.5}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/* ── Mouse-reactive camera ── */
function MouseCamera() {
  const { camera, pointer } = useThree();
  const targetRef = useRef(new THREE.Vector3(0, 0, 12));

  useFrame(() => {
    targetRef.current.x = pointer.x * 2;
    targetRef.current.y = pointer.y * 1.5;
    targetRef.current.z = 12;
    camera.position.lerp(targetRef.current, 0.03);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* ── Main scene ── */
export default function AICoreScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.8} color="#3b82f6" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#00d4ff" />
      <pointLight position={[0, 0, 5]} intensity={0.4} color="#818cf8" />

      <fog attach="fog" args={["#030308", 15, 30]} />

      <AICore />
      <OrbitingNodes />
      <NeuralConnections />
      <CoreParticles />

      <Sparkles
        count={100}
        scale={12}
        size={2}
        speed={0.3}
        color="#60a5fa"
        opacity={0.4}
      />

      <MouseCamera />
    </Canvas>
  );
}
