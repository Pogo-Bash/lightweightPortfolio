import { useRef, useState, useCallback, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text3D, Center, Float } from "@react-three/drei";
import * as THREE from "three";

interface SwapTextProps {
  visitorCount: number;
  hovered: boolean;
}

function SwapText({ visitorCount, hovered }: SwapTextProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const targetColor = useRef(new THREE.Color("#00ff88"));
  const currentColor = useRef(new THREE.Color("#e0e0e0"));

  useFrame((state, delta) => {
    if (!meshRef.current || !materialRef.current) return;

    // Rotate on hover
    const targetRotY = hovered ? Math.sin(state.clock.elapsedTime * 2) * 0.15 : 0;
    const targetRotX = hovered ? Math.cos(state.clock.elapsedTime * 1.5) * 0.08 : 0;
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotY, delta * 3);
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotX, delta * 3);

    // Scale pulse on hover
    const targetScale = hovered ? 1.08 + Math.sin(state.clock.elapsedTime * 3) * 0.03 : 1;
    meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, delta * 4));

    // Color transition
    targetColor.current.set(hovered ? "#00ff88" : "#e0e0e0");
    currentColor.current.lerp(targetColor.current, delta * 4);
    materialRef.current.color.copy(currentColor.current);
    materialRef.current.emissive.copy(currentColor.current).multiplyScalar(hovered ? 0.3 : 0.05);
  });

  return (
    <Center>
      <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3} floatingRange={[-0.05, 0.05]}>
        <mesh ref={meshRef}>
          <Text3D
            font="/fonts/helvetiker_bold.typeface.json"
            size={1.2}
            height={0.3}
            curveSegments={12}
            bevelEnabled
            bevelThickness={0.03}
            bevelSize={0.02}
            bevelOffset={0}
            bevelSegments={5}
          >
            {`Swap`}
            <meshStandardMaterial
              ref={materialRef}
              color="#e0e0e0"
              metalness={0.4}
              roughness={0.3}
            />
          </Text3D>
        </mesh>
      </Float>
    </Center>
  );
}

interface ParticleFieldProps {
  active: boolean;
}

function ParticleField({ active }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 200;

  const positions = useRef(new Float32Array(particleCount * 3));
  const velocities = useRef(new Float32Array(particleCount * 3));

  useEffect(() => {
    for (let i = 0; i < particleCount; i++) {
      positions.current[i * 3] = (Math.random() - 0.5) * 10;
      positions.current[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions.current[i * 3 + 2] = (Math.random() - 0.5) * 4;
      velocities.current[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities.current[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      velocities.current[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const pos = geo.attributes.position;
    if (!pos) return;

    const speed = active ? 3 : 1;
    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      pos.array[idx] += velocities.current[idx] * speed;
      pos.array[idx + 1] += velocities.current[idx + 1] * speed;
      pos.array[idx + 2] += velocities.current[idx + 2] * speed;

      // Wrap around
      if (Math.abs(pos.array[idx]) > 5) velocities.current[idx] *= -1;
      if (Math.abs(pos.array[idx + 1]) > 3) velocities.current[idx + 1] *= -1;
      if (Math.abs(pos.array[idx + 2]) > 2) velocities.current[idx + 2] *= -1;
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions.current}
          count={particleCount}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color={active ? "#00ff88" : "#333333"}
        transparent
        opacity={active ? 0.8 : 0.3}
        sizeAttenuation
      />
    </points>
  );
}

interface SwapNameProps {
  visitorCount: number;
}

export default function SwapName({ visitorCount }: SwapNameProps) {
  const [hovered, setHovered] = useState(false);

  const onPointerOver = useCallback(() => setHovered(true), []);
  const onPointerOut = useCallback(() => setHovered(false), []);

  return (
    <div className="relative w-full" style={{ height: "280px" }}>
      <div
        className="w-full h-full"
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <pointLight position={[-3, -3, 2]} intensity={0.5} color="#00ff88" />
          <SwapText visitorCount={visitorCount} hovered={hovered} />
          <ParticleField active={hovered} />
        </Canvas>
      </div>

      {/* Visitor counter overlay */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
        <div
          className={`font-mono text-sm tracking-widest transition-all duration-500 ${
            hovered ? "text-swap-accent scale-110" : "text-swap-dim"
          }`}
        >
          <span className="opacity-60">visitors: </span>
          <span className="font-bold text-lg tabular-nums">
            {visitorCount.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
