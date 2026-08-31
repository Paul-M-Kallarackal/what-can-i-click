import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { KNOWLEDGE_NODES } from "../../data/knowledge";
import { useAtlasStore } from "../../store/useAtlasStore";
import { BonsaiMechanism, RootConnection } from "./BonsaiMechanism";

function Island({ position, accent, index }: { position: readonly [number, number, number]; accent: string; index: number }) {
  const stones = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const radius = 3.1 + Math.sin(index * 1.7 + i * 2.2) * 0.45;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius, 0.16 + (i % 3) * 0.04] as const;
  }), [index]);
  return (
    <group position={position as [number, number, number]}>
      <mesh position={[0, -0.58, 0]} scale={[1.08 + (index % 2) * 0.08, 1, 0.93 + (index % 3) * 0.04]} receiveShadow castShadow>
        <cylinderGeometry args={[3.7, 3.95, 0.72, 32]} />
        <meshStandardMaterial color="#c5c6ba" roughness={0.91} />
      </mesh>
      <mesh position={[0, -0.2, 0]} scale={[1.08 + (index % 2) * 0.08, 1, 0.93 + (index % 3) * 0.04]} receiveShadow>
        <cylinderGeometry args={[3.72, 3.72, 0.08, 32]} />
        <meshStandardMaterial color="#e4e2d7" roughness={0.94} />
      </mesh>
      {stones.map(([x, z, scale], i) => (
        <mesh key={i} position={[x, -0.04, z]} scale={[scale * 1.3, scale * 0.55, scale]} rotation={[0, i * 0.8, 0]} castShadow>
          <dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={i % 4 === 0 ? accent : "#a9aaa0"} roughness={0.96} />
        </mesh>
      ))}
    </group>
  );
}

function FloatingSpores() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const data = new Float32Array(120 * 3);
    for (let i = 0; i < 120; i += 1) {
      data[i * 3] = ((i * 37) % 61) - 30;
      data[i * 3 + 1] = 1 + ((i * 17) % 9);
      data[i * 3 + 2] = ((i * 29) % 51) - 25;
    }
    return data;
  }, []);
  useFrame(() => {
    if (!ref.current || useAtlasStore.getState().reducedMotion) return;
    ref.current.rotation.y = useAtlasStore.getState().simulationTime * 0.012;
  });
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial color="#fff5c7" size={0.06} transparent opacity={0.42} sizeAttenuation />
    </points>
  );
}

function SimulationDriver() {
  const accumulator = useRef(0);
  const lastPublish = useRef(0);
  const lastStoryIndex = useRef(-1);
  const lastStoryRevision = useRef(0);
  useFrame((_, delta) => {
    const state = useAtlasStore.getState();
    if (state.storyRevision !== lastStoryRevision.current) {
      accumulator.current = 0;
      lastPublish.current = 0;
      lastStoryIndex.current = -1;
      lastStoryRevision.current = state.storyRevision;
    }
    if (state.playing && !state.reducedMotion) accumulator.current += Math.min(delta, 0.1) * state.speed;
    if (state.reducedMotion && state.playing) accumulator.current += Math.min(delta, 0.1) * 0.5;
    if (accumulator.current - lastPublish.current > 1 / 15 || !state.playing) {
      state.setSimulationTime(accumulator.current);
      lastPublish.current = accumulator.current;
    }
    if (state.storyPath.length > 0) {
      const index = Math.min(state.storyPath.length - 1, Math.floor(accumulator.current / 3.2) % state.storyPath.length);
      if (index !== lastStoryIndex.current) {
        state.setStoryIndex(index);
        state.selectNode(state.storyPath[index]);
        lastStoryIndex.current = index;
      }
    }
  });
  return null;
}

function PerformanceProbe() {
  const samples = useRef<number[]>([]);
  useFrame((_, delta) => {
    if (delta <= 0 || delta > 0.25) return;
    samples.current.push(delta);
    if (samples.current.length < 120) return;
    const average = samples.current.reduce((sum, value) => sum + value, 0) / samples.current.length;
    document.documentElement.dataset.sceneFps = Math.min(60, 1 / average).toFixed(1);
    samples.current.splice(0, 60);
  });
  return null;
}

function World() {
  const storyPath = useAtlasStore((state) => state.storyPath);
  const storyIndex = useAtlasStore((state) => state.storyIndex);
  const mobile = typeof window !== "undefined" && window.innerWidth < 700;
  const activePairs = useMemo(() => storyPath.slice(0, storyIndex + 1), [storyPath, storyIndex]);
  return (
    <>
      <color attach="background" args={["#dfe4dd"]} />
      <fog attach="fog" args={["#dfe4dd", 31, 72]} />
      <hemisphereLight args={["#fff9df", "#4d5d50", 2.15]} />
      <directionalLight position={[-14, 24, 12]} intensity={3.4} color="#fff2c7" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={28} shadow-camera-bottom={-28} />
      <directionalLight position={[16, 9, -12]} intensity={0.9} color="#a7d2c5" />
      <FloatingSpores />
      <group position={[2.2, 0, 0]}>
        {KNOWLEDGE_NODES.map((node, index) => <Island key={node.id} position={node.position} accent={node.accent} index={index} />)}
        {KNOWLEDGE_NODES.slice(0, -1).map((node, index) => {
          const next = KNOWLEDGE_NODES[index + 1];
          const active = activePairs.includes(node.id) && activePairs.includes(next.id);
          return <RootConnection key={`${node.id}-${next.id}`} from={node.position} to={next.position} active={active} />;
        })}
        <RootConnection from={KNOWLEDGE_NODES[1].position} to={KNOWLEDGE_NODES[5].position} active={activePairs.includes("mergetree") && activePairs.includes("retention")} />
        <RootConnection from={KNOWLEDGE_NODES[0].position} to={KNOWLEDGE_NODES[4].position} active={activePairs.includes("ingestion") && activePairs.includes("architecture")} />
        {KNOWLEDGE_NODES.map((node) => <BonsaiMechanism key={node.id} node={node} />)}
      </group>
      <OrbitControls makeDefault target={mobile ? [0, 5.8, 0] : [0, 2, 0]} enableDamping dampingFactor={0.075} minPolarAngle={0.62} maxPolarAngle={1.32} minZoom={10} maxZoom={44} enablePan screenSpacePanning panSpeed={0.58} rotateSpeed={0.5} zoomSpeed={0.72} />
      <SimulationDriver />
      <PerformanceProbe />
    </>
  );
}

export function WorldCanvas() {
  const selectNode = useAtlasStore((state) => state.selectNode);
  const mobile = typeof window !== "undefined" && window.innerWidth < 700;
  useEffect(() => () => { document.body.style.cursor = "default"; }, []);
  return (
    <div className="world-canvas" aria-hidden="true">
      <Canvas
        orthographic
        shadows={!mobile}
        dpr={[1, 1.25]}
        camera={{ position: [24, 23, 28], zoom: mobile ? 11.5 : 21, near: 0.1, far: 180 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onPointerMissed={() => selectNode(null)}
      >
        <color attach="background" args={["#dfe4dd"]} />
        <Suspense fallback={null}><World /></Suspense>
      </Canvas>
    </div>
  );
}
