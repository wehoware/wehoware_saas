"use client";

import { useRef, useMemo, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  useGLTF,
  Sparkles,
  ContactShadows,
  Html,
  useAnimations,
} from "@react-three/drei";
import * as THREE from "three";

useGLTF.preload("/bot_mecha_warrior_3d_by_oscar_creativo.glb");

/* ── Mecha Warrior model that follows the mouse ── */
function MechaWarrior({ mouseTracker }) {
  const groupRef = useRef();
  const innerRef = useRef();
  const { scene, animations } = useGLTF("/bot_mecha_warrior_3d_by_oscar_creativo.glb");
  const { actions, names } = useAnimations(animations, groupRef);
  const targetPos = useRef(new THREE.Vector3(0, 0, 0));
  const activeActionRef = useRef(null);

  useEffect(() => {
    if (scene && names && names.length > 0) {
      const walkAnim = names.find((n) => n.toLowerCase().includes("walk")) || names[0];
      const action = actions[walkAnim];
      if (action) {
        action.reset().fadeIn(0.5).play();
        activeActionRef.current = action;
      }
    }

    // Preserve the model's original colors — disable any environment map influence
    if (scene) {
      scene.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              mat.envMapIntensity = 0;
            });
          } else {
            child.material.envMapIntensity = 0;
          }
        }
      });
    }
  }, [scene, actions, names]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const t = state.clock.elapsedTime;

    // Read mouse position from tracker (normalized -1 to 1)
    const mx = mouseTracker.current.x;
    const my = mouseTracker.current.y;

    // Map mouse to world coordinates on the ground plane
    // Clamp to a reasonable range so the bot stays on screen
    targetPos.current.x = THREE.MathUtils.clamp(mx * 5, -5, 5);
    targetPos.current.z = THREE.MathUtils.clamp(-my * 3, -3, 3);
    targetPos.current.y = 0;

    // Smooth movement using lerp with velocity-based speed
    const dist = groupRef.current.position.distanceTo(targetPos.current);
    const isMoving = dist > 0.05;

    // Faster lerp when far, slower when close — feels like walking
    const lerpFactor = isMoving ? 0.025 : 0.05;
    groupRef.current.position.lerp(targetPos.current, lerpFactor);

    // Rotate to face movement direction
    if (isMoving && innerRef.current) {
      const direction = new THREE.Vector3();
      direction.subVectors(targetPos.current, groupRef.current.position);
      const targetAngle = Math.atan2(direction.x, direction.z);
      // Smooth rotation
      const currentAngle = innerRef.current.rotation.y;
      let diff = targetAngle - currentAngle;
      // Normalize to -PI to PI
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      innerRef.current.rotation.y += diff * 0.08;
    }

    // Walking bob — subtle vertical oscillation when moving
    if (innerRef.current) {
      const bobAmount = isMoving ? 0.08 : 0.03;
      const bobSpeed = isMoving ? 8 : 2;
      innerRef.current.position.y = Math.sin(t * bobSpeed) * bobAmount;

      // Slight lean forward when walking
      const targetLean = isMoving ? 0.12 : 0;
      innerRef.current.rotation.x = THREE.MathUtils.lerp(
        innerRef.current.rotation.x,
        targetLean,
        0.05
      );
    }

    // Adjust animation speed based on movement
    const action = activeActionRef.current;
    if (action) {
      const targetSpeed = isMoving ? 1.5 : 0.4;
      action.timeScale = THREE.MathUtils.lerp(action.timeScale, targetSpeed, 0.05);
    }
  });

  // Auto-scale the model — GLB models vary in size
  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <group ref={innerRef} scale={1.2}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

/* ── Ground grid that reacts to mouse ── */
function ReactiveGrid({ mouseTracker }) {
  const gridRef = useRef();

  useFrame((state) => {
    if (gridRef.current) {
      const t = state.clock.elapsedTime;
      gridRef.current.position.z = (t * 0.5) % 2;
    }
  });

  return (
    <>
      <gridHelper
        ref={gridRef}
        args={[40, 40, "#1e3a6a", "#0d1a2e"]}
        position={[0, -1.5, 0]}
      />
      {/* Finer overlay grid for depth */}
      <gridHelper args={[40, 80, "#0a1525", "#050a14"]} position={[0, -1.49, 0]} />
    </>
  );
}

/* ── Energy trail particles that follow the bot ── */
function EnergyTrail({ mouseTracker }) {
  const ref = useRef();
  const count = 60;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = 0;
      arr[i * 3 + 1] = -1;
      arr[i * 3 + 2] = 0;
    }
    return arr;
  }, []);

  const trailPositions = useRef(
    Array.from({ length: count }, () => new THREE.Vector3(0, -1, 0))
  );

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;

    // Shift trail positions
    for (let i = count - 1; i > 0; i--) {
      trailPositions.current[i].copy(trailPositions.current[i - 1]);
    }
    // New head position based on mouse
    const mx = mouseTracker.current.x * 5;
    const mz = -mouseTracker.current.y * 3;
    trailPositions.current[0].set(mx, -0.8 + Math.sin(t * 10) * 0.1, mz);

    // Update buffer
    const posAttr = ref.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      posAttr.array[i * 3] = trailPositions.current[i].x;
      posAttr.array[i * 3 + 1] = trailPositions.current[i].y - i * 0.01;
      posAttr.array[i * 3 + 2] = trailPositions.current[i].z;
    }
    posAttr.needsUpdate = true;
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
        size={0.15}
        color="#00d4ff"
        transparent
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/* ── Mouse tracker — bridges DOM mouse events to R3F ── */
function useMouseTracker() {
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      // Normalize to -1..1
      targetRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      targetRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        targetRef.current.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
        targetRef.current.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  // Smooth interpolation in a frame loop
  useFrame(() => {
    mouseRef.current.x = THREE.MathUtils.lerp(
      mouseRef.current.x,
      targetRef.current.x,
      0.06
    );
    mouseRef.current.y = THREE.MathUtils.lerp(
      mouseRef.current.y,
      targetRef.current.y,
      0.06
    );
  });

  return mouseRef;
}

/* ── Scene wrapper that provides the mouse tracker ── */
function SceneContent() {
  const mouseTracker = useMouseTracker();

  return (
    <>
      {/* Neutral white lighting to preserve the model's original colors */}
      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.0}
        color="#ffffff"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight
        position={[-5, 3, -5]}
        intensity={0.4}
        color="#ffffff"
      />
      <directionalLight
        position={[0, 5, 5]}
        intensity={0.3}
        color="#ffffff"
      />

      <MechaWarrior mouseTracker={mouseTracker} />
      <ReactiveGrid mouseTracker={mouseTracker} />
      <EnergyTrail mouseTracker={mouseTracker} />

      <ContactShadows
        position={[0, -1.5, 0]}
        opacity={0.3}
        scale={20}
        blur={2}
        far={4}
        color="#000000"
      />

      <Sparkles
        count={120}
        scale={14}
        size={2}
        speed={0.15}
        color="#60a5fa"
        opacity={0.25}
      />
      <Sparkles
        count={60}
        scale={8}
        size={1}
        speed={0.3}
        color="#00d4ff"
        opacity={0.15}
      />
    </>
  );
}

/* ── Loading fallback ── */
function Loader() {
  return (
    <Html center>
      <style>{`
        @keyframes mecha-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
      }}>
        <div style={{
          width: "40px",
          height: "40px",
          border: "3px solid rgba(0, 212, 255, 0.2)",
          borderTopColor: "#00d4ff",
          borderRadius: "50%",
          animation: "mecha-spin 1s linear infinite",
        }} />
        <div style={{
          color: "#60a5fa",
          fontSize: "12px",
          letterSpacing: "2px",
          textTransform: "uppercase",
        }}>
          Initializing Mecha Warrior...
        </div>
      </div>
    </Html>
  );
}

/* ── Main exported scene ── */
export default function MechaWarriorScene() {
  return (
    <Canvas
      camera={{ position: [0, 2, 8], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      shadows
      style={{ width: "100%", height: "100%", transform: "translateY(20%)" }}
    >
      <Suspense fallback={<Loader />}>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}
