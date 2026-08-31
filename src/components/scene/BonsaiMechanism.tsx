import { Billboard, Line, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useAtlasStore, currentStoryNode } from "../../store/useAtlasStore";
import type { DistrictId, KnowledgeNode } from "../../types";

const TRUNK = "#34271f";
const TRUNK_LIGHT = "#594131";
const FOLIAGE = ["#315d47", "#457357", "#5b8662", "#719870"];
const CLAY = "#9a6042";
const YELLOW = "#ffcc01";
const STONE = "#d3d0c3";

function useSceneTime() {
  return () => {
    const state = useAtlasStore.getState();
    return state.reducedMotion ? 0 : state.simulationTime;
  };
}

function Branch({ points, radius = 0.16, color = TRUNK }: { points: [number, number, number][]; radius?: number; color?: string }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    return new THREE.TubeGeometry(curve, 20, radius, 7, false);
  }, [points, radius]);
  return <mesh geometry={geometry} castShadow><meshStandardMaterial color={color} roughness={0.76} /></mesh>;
}

function FoliagePad({ position, scale = [1, 1, 1], shade = 0, rotation = [0, 0, 0] }: {
  position: [number, number, number]; scale?: [number, number, number]; shade?: number; rotation?: [number, number, number];
}) {
  return (
    <group position={position} scale={scale} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <dodecahedronGeometry args={[0.82, 1]} />
        <meshStandardMaterial color={FOLIAGE[shade % FOLIAGE.length]} roughness={0.88} />
      </mesh>
      <mesh position={[0.62, -0.08, 0.12]} scale={0.66}>
        <dodecahedronGeometry args={[0.72, 1]} />
        <meshStandardMaterial color={FOLIAGE[(shade + 1) % FOLIAGE.length]} roughness={0.9} />
      </mesh>
      <mesh position={[-0.55, 0.03, -0.12]} scale={0.58}>
        <icosahedronGeometry args={[0.76, 1]} />
        <meshStandardMaterial color={FOLIAGE[(shade + 2) % FOLIAGE.length]} roughness={0.9} />
      </mesh>
    </group>
  );
}

function BonsaiPot({ accent }: { accent: string }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.72, 1.42, 0.72, 24]} />
        <meshStandardMaterial color={CLAY} roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.58, 0]} receiveShadow>
        <cylinderGeometry args={[1.69, 1.69, 0.08, 24]} />
        <meshStandardMaterial color="#332a22" roughness={1} />
      </mesh>
      <mesh position={[0, -0.19, 0]} scale={[1.1, 0.2, 1.1]}>
        <cylinderGeometry args={[1.18, 1.28, 0.42, 20]} />
        <meshStandardMaterial color={accent} roughness={0.68} />
      </mesh>
    </group>
  );
}

function IngestionTree() {
  return (
    <group>
      <Branch points={[[0, 0.55, 0], [-0.2, 1.9, 0.1], [0.15, 3.3, 0], [0.8, 4.6, -0.1], [1.6, 5.4, 0]]} radius={0.27} />
      <Branch points={[[0, 2.3, 0], [-1.1, 3.1, 0.1], [-2.15, 3.35, 0.35]]} />
      <Branch points={[[0.25, 3.8, 0], [1.7, 4.1, -0.2], [2.45, 4.45, -0.1]]} radius={0.14} />
      <FoliagePad position={[-2.1, 3.55, 0.3]} scale={[1.25, 0.65, 0.88]} shade={1} />
      <FoliagePad position={[2.25, 4.65, -0.1]} scale={[1.25, 0.63, 0.86]} shade={0} />
      <FoliagePad position={[1.45, 5.55, 0]} scale={[1.15, 0.78, 0.9]} shade={2} />
      <SeedStream />
      <Beetle />
    </group>
  );
}

function SeedStream() {
  const ref = useRef<THREE.Group>(null);
  const getTime = useSceneTime();
  const seeds = useMemo(() => Array.from({ length: 14 }, (_, index) => ({
    x: -3.1 + (index % 3) * 0.28,
    y: 1.2 + (index * 0.53) % 5,
    z: -0.7 + (index % 4) * 0.38,
    phase: index * 0.47,
  })), []);
  useFrame(() => {
    if (!ref.current) return;
    const time = getTime();
    ref.current.children.forEach((child, index) => {
      const seed = seeds[index];
      child.position.y = 0.8 + ((seed.y - time * 1.15 + 8) % 6);
      child.position.x = seed.x + Math.sin(time * 1.8 + seed.phase) * 0.12;
    });
  });
  return (
    <group ref={ref}>
      {seeds.map((seed, index) => (
        <mesh key={index} position={[seed.x, seed.y, seed.z]} castShadow>
          <sphereGeometry args={[0.075, 8, 8]} />
          <meshStandardMaterial color={index % 3 === 0 ? YELLOW : "#e8a74a"} emissive={YELLOW} emissiveIntensity={0.28} />
        </mesh>
      ))}
    </group>
  );
}

function Beetle() {
  const ref = useRef<THREE.Group>(null);
  const getTime = useSceneTime();
  useFrame(() => {
    if (!ref.current) return;
    const t = getTime() * 0.7;
    ref.current.position.set(Math.cos(t) * 2.2, 0.83, Math.sin(t) * 1.45);
    ref.current.rotation.y = -t + Math.PI / 2;
  });
  return (
    <group ref={ref} scale={0.42}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><capsuleGeometry args={[0.35, 0.65, 6, 10]} /><meshStandardMaterial color="#171717" roughness={0.55} /></mesh>
      <mesh position={[0, 0.08, -0.46]}><sphereGeometry args={[0.28, 10, 8]} /><meshStandardMaterial color={YELLOW} /></mesh>
      {[-1, 1].map((side) => [0.25, -0.08, -0.35].map((z, i) => (
        <mesh key={`${side}-${i}`} position={[side * 0.38, -0.12, z]} rotation={[0, 0, side * 0.75]}>
          <cylinderGeometry args={[0.035, 0.035, 0.58, 6]} /><meshStandardMaterial color="#171717" />
        </mesh>
      )))}
    </group>
  );
}

function MergeTree() {
  const terraces = [
    [-0.75, 0.75, -0.2, 0.62, 0.24], [0.15, 0.78, 0.2, 0.8, 0.3], [0.9, 0.76, -0.15, 0.48, 0.22],
  ] as const;
  return (
    <group>
      <Branch points={[[0, 0.55, 0], [-0.45, 1.8, 0], [-0.2, 3.25, 0.15], [-0.8, 4.6, 0]]} radius={0.34} />
      <Branch points={[[0, 1.8, 0], [0.9, 2.65, 0.1], [1.55, 3.65, 0]]} radius={0.2} />
      <Branch points={[[0, 3.15, 0], [-1.3, 3.65, -0.1], [-2.05, 3.7, -0.1]]} radius={0.16} />
      <FoliagePad position={[-1.85, 3.95, 0]} scale={[1.38, 0.58, 0.9]} shade={0} />
      <FoliagePad position={[1.5, 3.88, 0]} scale={[1.15, 0.7, 0.86]} shade={1} />
      <FoliagePad position={[-0.75, 4.85, 0]} scale={[1.1, 0.72, 0.85]} shade={2} />
      {terraces.map(([x, y, z, sx, sy], index) => (
        <mesh key={index} position={[x, y, z]} scale={[sx, sy, 0.75]} castShadow>
          <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={index === 1 ? YELLOW : STONE} roughness={0.8} />
        </mesh>
      ))}
      <MergeRoots />
    </group>
  );
}

function MergeRoots() {
  const ref = useRef<THREE.Group>(null);
  const getTime = useSceneTime();
  useFrame(() => {
    if (!ref.current) return;
    const pulse = 0.35 + (Math.sin(getTime() * 1.35) + 1) * 0.22;
    ref.current.children.forEach((child) => {
      const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = pulse;
    });
  });
  return (
    <group ref={ref} position={[0, 0.65, 0]}>
      <Branch points={[[-1.25, 0, 0.4], [-0.65, 0.2, 0.1], [0, 0.05, 0]]} radius={0.055} color={YELLOW} />
      <Branch points={[[1.25, 0, -0.35], [0.55, 0.18, -0.1], [0, 0.05, 0]]} radius={0.055} color={YELLOW} />
    </group>
  );
}

function ReadTree() {
  return (
    <group>
      <Branch points={[[0, 0.55, 0], [0.15, 2, 0], [-0.1, 3.4, 0], [0.25, 5.2, 0]]} radius={0.28} />
      {[-1, 1].flatMap((side) => [2.25, 3.25, 4.2].map((y, index) => (
        <group key={`${side}-${y}`}>
          <Branch points={[[0, y, 0], [side * 1.05, y + 0.22, 0], [side * (1.95 + index * 0.15), y + 0.12, 0]]} radius={0.12 - index * 0.015} />
          <FoliagePad position={[side * (1.75 + index * 0.12), y + 0.28, 0]} scale={[1.32, 0.42, 0.76]} shade={index + (side > 0 ? 1 : 0)} />
        </group>
      )))}
      <FoliagePad position={[0.15, 5.35, 0]} scale={[0.92, 0.7, 0.78]} shade={2} />
      <Fireflies />
    </group>
  );
}

function Fireflies() {
  const ref = useRef<THREE.Group>(null);
  const getTime = useSceneTime();
  useFrame(() => {
    if (!ref.current) return;
    const time = getTime();
    ref.current.children.forEach((child, index) => {
      const direction = index % 2 === 0 ? 1 : -1;
      const lane = 2.25 + (index % 3) * 0.95;
      child.position.x = direction * (-2.3 + ((time * (1.5 + index * 0.08) + index) % 4.6));
      child.position.y = lane + Math.sin(time * 3 + index) * 0.1;
      const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.8 + Math.sin(time * 5 + index) * 0.35;
    });
  });
  return <group ref={ref}>{Array.from({ length: 11 }, (_, index) => <mesh key={index}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color={YELLOW} emissive={YELLOW} emissiveIntensity={1} /></mesh>)}</group>;
}

function AggregationTree() {
  return (
    <group>
      <Branch points={[[0, 0.55, 0], [0.3, 2.1, 0], [-0.1, 3.55, 0], [0.35, 5.1, 0]]} radius={0.3} />
      <Branch points={[[0.1, 2.25, 0], [-1.15, 2.85, 0], [-2, 3.05, 0]]} radius={0.15} />
      <Branch points={[[0, 3.4, 0], [1.2, 3.75, 0], [2.05, 3.7, 0]]} radius={0.14} />
      <FoliagePad position={[-1.95, 3.25, 0]} scale={[1.35, 0.5, 0.86]} shade={0} />
      <FoliagePad position={[1.95, 3.92, 0]} scale={[1.35, 0.52, 0.84]} shade={1} />
      <FoliagePad position={[0.3, 5.22, 0]} scale={[1.05, 0.76, 0.8]} shade={2} />
      {[[-1.65, 3.08, 0.65], [1.55, 3.78, 0.72], [0.35, 4.9, 0.7]].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]} castShadow>
          <sphereGeometry args={[0.19 + index * 0.03, 12, 10]} /><meshStandardMaterial color={YELLOW} emissive={YELLOW} emissiveIntensity={0.22} roughness={0.45} />
        </mesh>
      ))}
      <Hummingbird />
    </group>
  );
}

function Hummingbird() {
  const ref = useRef<THREE.Group>(null);
  const wingA = useRef<THREE.Mesh>(null);
  const wingB = useRef<THREE.Mesh>(null);
  const getTime = useSceneTime();
  useFrame(() => {
    const time = getTime();
    if (!ref.current || !wingA.current || !wingB.current) return;
    ref.current.position.set(Math.cos(time * 1.45) * 2.25, 4.1 + Math.sin(time * 2.1) * 0.28, Math.sin(time * 1.45) * 1.2 + 1.1);
    ref.current.rotation.y = -time * 1.45;
    wingA.current.rotation.z = Math.sin(time * 20) * 0.8 + 0.5;
    wingB.current.rotation.z = -Math.sin(time * 20) * 0.8 - 0.5;
  });
  return (
    <group ref={ref} scale={0.36}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.16, 0.55, 5, 8]} /><meshStandardMaterial color="#2f6f70" metalness={0.12} /></mesh>
      <mesh position={[0, 0, -0.53]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.06, 0.7, 6]} /><meshStandardMaterial color="#171717" /></mesh>
      <mesh ref={wingA} position={[0.25, 0.08, 0]} rotation={[0.2, 0, 0.5]}><planeGeometry args={[0.8, 0.28]} /><meshStandardMaterial color="#d9e7df" transparent opacity={0.72} side={THREE.DoubleSide} /></mesh>
      <mesh ref={wingB} position={[-0.25, 0.08, 0]} rotation={[0.2, 0, -0.5]}><planeGeometry args={[0.8, 0.28]} /><meshStandardMaterial color="#d9e7df" transparent opacity={0.72} side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

function ArchitectureTree() {
  return (
    <group>
      {[-1.1, 0, 1.1].map((x, index) => (
        <group key={x} position={[x, 0, index === 1 ? -0.2 : 0.15]} scale={index === 1 ? 1 : 0.78}>
          <Branch points={[[0, 0.55, 0], [index % 2 ? 0.22 : -0.18, 2, 0], [0.12, 3.8, 0]]} radius={0.22} />
          <FoliagePad position={[0.1, 3.65, 0]} scale={[0.82, 0.72, 0.76]} shade={index} />
          <FoliagePad position={[index % 2 ? -0.68 : 0.68, 2.6, 0]} scale={[0.75, 0.42, 0.62]} shade={index + 1} />
        </group>
      ))}
      <ReplicaPulse />
      <mesh position={[0, 0.95, 1.25]} castShadow>
        <octahedronGeometry args={[0.32, 0]} /><meshStandardMaterial color={YELLOW} emissive={YELLOW} emissiveIntensity={0.45} metalness={0.15} />
      </mesh>
    </group>
  );
}

function ReplicaPulse() {
  const ref = useRef<THREE.Group>(null);
  const getTime = useSceneTime();
  useFrame(() => {
    if (!ref.current) return;
    const time = getTime();
    ref.current.children.forEach((child, index) => {
      const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.22 + ((Math.sin(time * 2 - index * 1.5) + 1) / 2) * 0.8;
    });
  });
  return (
    <group ref={ref}>
      <Branch points={[[0, 0.65, 0], [-1.1, 0.68, 0.15]]} radius={0.045} color={YELLOW} />
      <Branch points={[[0, 0.65, 0], [1.1, 0.68, 0.15]]} radius={0.045} color={YELLOW} />
    </group>
  );
}

function RetentionTree() {
  return (
    <group>
      <Branch points={[[0, 0.55, 0], [-0.35, 2.25, 0], [0.15, 3.9, 0], [-0.3, 5.25, 0]]} radius={0.29} />
      <Branch points={[[0, 2.3, 0], [1.2, 3, 0], [2.15, 3.05, 0]]} radius={0.14} />
      <Branch points={[[0, 3.55, 0], [-1.2, 4.1, 0], [-1.9, 4.05, 0]]} radius={0.13} />
      <FoliagePad position={[2, 3.25, 0]} scale={[1.22, 0.54, 0.82]} shade={1} />
      <FoliagePad position={[-1.8, 4.25, 0]} scale={[1.12, 0.56, 0.78]} shade={2} />
      <FoliagePad position={[-0.25, 5.35, 0]} scale={[0.9, 0.72, 0.72]} shade={0} />
      <FallingLeaves />
      <Snail />
    </group>
  );
}

function FallingLeaves() {
  const ref = useRef<THREE.Group>(null);
  const getTime = useSceneTime();
  const leaves = useMemo(() => Array.from({ length: 15 }, (_, index) => ({ x: -2 + (index % 5), y: 1 + (index * 0.71) % 5, z: -0.8 + (index % 4) * 0.5, phase: index * 0.8 })), []);
  useFrame(() => {
    if (!ref.current) return;
    const time = getTime();
    ref.current.children.forEach((child, index) => {
      const leaf = leaves[index];
      child.position.y = 0.7 + ((leaf.y - time * 0.38 + 7) % 5.5);
      child.position.x = leaf.x + Math.sin(time + leaf.phase) * 0.32;
      child.rotation.z = time * 1.5 + leaf.phase;
    });
  });
  return <group ref={ref}>{leaves.map((leaf, index) => <mesh key={index} position={[leaf.x, leaf.y, leaf.z]} scale={[0.15, 0.26, 0.08]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color={index % 2 ? "#a75e45" : "#d59445"} roughness={0.8} /></mesh>)}</group>;
}

function Snail() {
  const ref = useRef<THREE.Group>(null);
  const getTime = useSceneTime();
  useFrame(() => {
    if (!ref.current) return;
    const t = getTime() * 0.12;
    ref.current.position.set(-2.2 + ((t % 1) * 4.4), 0.74, 1.45);
  });
  return (
    <group ref={ref} scale={0.4}>
      <mesh rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.18, 0.9, 5, 8]} /><meshStandardMaterial color="#6f875d" /></mesh>
      <mesh position={[-0.15, 0.36, 0]} rotation={[0, Math.PI / 2, 0]} castShadow><torusGeometry args={[0.38, 0.15, 8, 18]} /><meshStandardMaterial color={CLAY} roughness={0.72} /></mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[0.48, 0.34, side * 0.13]} rotation={[0, 0, -0.35]}><cylinderGeometry args={[0.025, 0.025, 0.45, 5]} /><meshStandardMaterial color="#171717" /></mesh>)}
    </group>
  );
}

function TreeForNode({ id }: { id: DistrictId }) {
  if (id === "ingestion") return <IngestionTree />;
  if (id === "mergetree") return <MergeTree />;
  if (id === "read-path") return <ReadTree />;
  if (id === "aggregation") return <AggregationTree />;
  if (id === "architecture") return <ArchitectureTree />;
  return <RetentionTree />;
}

export function BonsaiMechanism({ node }: { node: KnowledgeNode }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const selected = useAtlasStore((state) => state.selectedNodeId === node.id);
  const hovered = useAtlasStore((state) => state.hoveredNodeId === node.id);
  const storyActive = useAtlasStore((state) => currentStoryNode(state) === node.id);
  const storyMode = useAtlasStore((state) => state.storyMode);
  const selectNode = useAtlasStore((state) => state.selectNode);
  const hoverNode = useAtlasStore((state) => state.hoverNode);
  const active = selected || hovered || storyActive;

  useFrame((_, delta) => {
    if (!group.current || !ring.current) return;
    const targetScale = active ? 1.085 : 1;
    group.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.exp(-delta * 7));
    group.current.position.y = active ? Math.sin(useAtlasStore.getState().simulationTime * 1.5) * 0.05 : 0;
    const material = ring.current.material as THREE.MeshStandardMaterial;
    material.opacity = THREE.MathUtils.lerp(material.opacity, active ? 0.9 : 0.18, 1 - Math.exp(-delta * 8));
  });

  return (
    <group position={node.position as [number, number, number]}>
      <group
        ref={group}
        onClick={(event) => { event.stopPropagation(); selectNode(node.id); }}
        onPointerOver={(event) => { event.stopPropagation(); hoverNode(node.id); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { hoverNode(null); document.body.style.cursor = "default"; }}
      >
        <BonsaiPot accent={node.accent} />
        <TreeForNode id={node.id} />
        <mesh ref={ring} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.15, 0.055, 10, 48]} />
          <meshStandardMaterial color={active ? YELLOW : node.accent} emissive={YELLOW} emissiveIntensity={active ? 0.75 : 0.1} transparent opacity={0.18} />
        </mesh>
        <mesh position={[0, 2.7, 0]} visible={false}>
          <cylinderGeometry args={[2.8, 2.8, 6, 12]} /><meshBasicMaterial transparent opacity={0} />
        </mesh>
      </group>
      <Billboard position={[0, 7.15, 0]} follow lockX={false} lockY={false} lockZ={false}>
        <Text
          font="/fonts/Strawn-Variable.ttf"
          fontSize={0.58}
          color={active ? "#171717" : storyMode && !storyActive ? "#81877f" : "#303a32"}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.035}
          outlineColor="#f5f3ec"
          outlineOpacity={0.92}
        >{node.shortTitle}</Text>
        <Text position={[0, -0.52, 0]} fontSize={0.16} color="#5e675f" anchorX="center" anchorY="middle" letterSpacing={0.08}>{node.district.toUpperCase()}</Text>
      </Billboard>
    </group>
  );
}

export function RootConnection({ from, to, active = false }: { from: readonly [number, number, number]; to: readonly [number, number, number]; active?: boolean }) {
  const points = useMemo(() => {
    const a = new THREE.Vector3(from[0], -0.35, from[2]);
    const b = new THREE.Vector3(to[0], -0.35, to[2]);
    const mid = a.clone().lerp(b, 0.5);
    mid.x += Math.sin(a.x + b.z) * 1.1;
    mid.z += Math.cos(a.z + b.x) * 1.1;
    return [a, mid, b];
  }, [from, to]);
  return <Line points={points} color={active ? YELLOW : "#6b7567"} lineWidth={active ? 2.4 : 1.15} transparent opacity={active ? 0.85 : 0.24} />;
}
