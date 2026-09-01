import { ContactShadows, Html, Instance, Instances, Line, OrbitControls, PerformanceMonitor, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import * as THREE from "three";
import { mechanismById } from "../../data/mechanisms";
import { useCaseJourneyById, type GuidePhase } from "../../data/useCaseJourneys";
import { eventIndexAtTime, storyDuration } from "../../lib/simulation";
import { useAtlasStore } from "../../store/useAtlasStore";
import type { LatestReadStrategy, MechanismId, MergeFamilyId, ScenarioMode } from "../../types";
import {
  aggregatingStateFrame,
  aggregationSpillFrame,
  advanceMachineRenderTime,
  backgroundContentionFrame,
  badOrderingFrame,
  coalescingReadFrame,
  collapsingHistoryFrame,
  clusterTopologyMode,
  COLORS,
  DataBars,
  DataCassette,
  foundryCraneFrame,
  foundryMergeFrame,
  foundryPartLifecycle,
  type FoundryPartLifecycle,
  InstrumentGauge,
  keeperQuorumFrame,
  mergeTreeVisualMode,
  partitionExplosionFrame,
  precomputeSwitchyardFrame,
  type PrecomputeSwitchyardFrame,
  type PrecomputeVisualMode,
  replacingReadFrame,
  recommendationGotchaVisual,
  replicaLagFrame,
  resetMachineRenderTime,
  setComposedMaterialBaseOpacity,
  summingMergeFrame,
  tinyInsertStormFrame,
  useMachineTime,
  versionedCollapseFrame,
} from "./MachinePrimitives";

type GroupRef = React.RefObject<THREE.Group | null>;
type SceneViewport = {
  width: number;
  height: number;
  mobile: boolean;
  compact: boolean;
  narrow: boolean;
};

const JOURNEY_CAMERA_HEIGHT: Record<GuidePhase, number> = {
  ingestion: 2.55,
  storage: 3.72,
  read: 4.48,
  precompute: 4.22,
  architecture: 3.42,
  retention: 2.62,
};

function viewportProfile(width: number, height: number): SceneViewport {
  return {
    width,
    height,
    mobile: width <= 760,
    compact: height <= 740,
    narrow: width <= 1080,
  };
}

const columnColors = ["#FFCC01", "#78D7D2", "#F0A43A", "#8F82CE", "#DDE47A", "#F36F5F"];

function MachinePlate({ position, size, color = "#24272A" }: { position: [number, number, number]; size: [number, number, number]; color?: string }) {
  return <RoundedBox args={size} radius={0.14} smoothness={4} position={position} castShadow receiveShadow><meshStandardMaterial color={color} roughness={0.34} metalness={0.46} /></RoundedBox>;
}

function ColumnFiles({ exploded }: { exploded: boolean }) {
  const group = useRef<THREE.Group>(null);
  const getTime = useMachineTime();
  const helper = useRef(new THREE.Object3D());
  const instanceRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, exploded ? 0.3 : -0.15, 5, delta);
    group.current.scale.setScalar(THREE.MathUtils.damp(group.current.scale.x, exploded ? 1.08 : 1, 5, delta));
    const time = getTime();
    instanceRefs.current.forEach((mesh, column) => {
      if (!mesh) return;
      for (let segment = 0; segment < 5; segment += 1) {
        const height = 0.3 + segment * 0.075;
        helper.current.position.set(0, -0.88 + segment * 0.44 + Math.sin(time * 1.15 + column * 0.62 + segment * 0.2) * 0.055, 0);
        helper.current.rotation.set(0, 0, 0);
        helper.current.scale.set(1, height, 1);
        helper.current.updateMatrix();
        mesh.setMatrixAt(segment, helper.current.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
  });
  return (
    <group ref={group}>
      {columnColors.map((color, column) => (
        <group key={color} position={[-1.48 + column * 0.59, 0, 0]}>
          <instancedMesh ref={(mesh) => { instanceRefs.current[column] = mesh; }} args={[undefined, undefined, 5]}>
            <boxGeometry args={[0.42, 1, 1.4]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.17} roughness={0.42} metalness={0.05} />
          </instancedMesh>
        </group>
      ))}
    </group>
  );
}

function MarksPlate({ groupRef }: { groupRef: GroupRef }) {
  return (
    <group ref={groupRef} position={[0, 0, 0.82]}>
      <RoundedBox args={[3.9, 0.52, 0.12]} radius={0.06} smoothness={3}><meshStandardMaterial color="#E6E3D9" roughness={0.52} metalness={0.12} /></RoundedBox>
      <Instances limit={14} range={14}><boxGeometry args={[0.055, 0.32, 0.06]} /><meshStandardMaterial color={COLORS.cyan} emissive={COLORS.cyan} emissiveIntensity={0.35} />{Array.from({ length: 14 }, (_, index) => <Instance key={index} position={[-1.72 + index * 0.265, 0, 0.085]} scale={[index % 4 === 0 ? 1.75 : 1, 1, 1]} />)}</Instances>
    </group>
  );
}

function SparseIndex({ groupRef }: { groupRef: GroupRef }) {
  return (
    <group ref={groupRef} position={[0, 1.28, 0]}>
      <RoundedBox args={[4.05, 0.24, 0.56]} radius={0.08} smoothness={3}><meshStandardMaterial color="#15171A" roughness={0.27} metalness={0.58} /></RoundedBox>
      <Instances limit={9} range={9}><boxGeometry args={[0.16, 0.32, 0.72]} /><meshStandardMaterial color={COLORS.yellow} emissive={COLORS.yellow} emissiveIntensity={0.44} />{Array.from({ length: 9 }, (_, index) => <Instance key={index} position={[-1.68 + index * 0.42, 0.13, 0]} scale={[index === 3 || index === 7 ? 1.5 : 0.72, 1, 1]} />)}</Instances>
    </group>
  );
}

function ChecksumLedger({ groupRef }: { groupRef: GroupRef }) {
  return (
    <group ref={groupRef} position={[-1.45, 0, -0.9]} rotation={[0, 0.18, 0]}>
      <RoundedBox args={[1.18, 2.45, 0.16]} radius={0.08} smoothness={3}><meshStandardMaterial color="#353A3D" roughness={0.28} metalness={0.48} /></RoundedBox>
      <Instances limit={12} range={12}><boxGeometry args={[0.38, 0.08, 0.035]} /><meshBasicMaterial color="#AAB3AF" />{Array.from({ length: 12 }, (_, index) => <Instance key={index} position={[-0.27 + (index % 2) * 0.54, 0.92 - Math.floor(index / 2) * 0.35, 0.1]} scale={[index % 3 === 0 ? 0.62 : 1, 1, 1]} />)}</Instances>
    </group>
  );
}

function MetadataPlate({ groupRef }: { groupRef: GroupRef }) {
  return (
    <group ref={groupRef} position={[1.48, 0, -0.9]} rotation={[0, -0.18, 0]}>
      <RoundedBox args={[1.22, 2.45, 0.16]} radius={0.08} smoothness={3}><meshStandardMaterial color="#F0EEE5" roughness={0.48} metalness={0.05} /></RoundedBox>
      <Instances limit={10} range={10}><boxGeometry args={[0.76, 0.09, 0.035]} /><meshBasicMaterial color="#59615E" />{Array.from({ length: 10 }, (_, index) => <Instance key={index} position={[0, 0.88 - index * 0.19, 0.1]} scale={[index % 4 === 0 ? 0.58 : 1, 1, 1]} />)}</Instances>
    </group>
  );
}

function PartLabels({ visible }: { visible: boolean }) {
  if (!visible) return null;
  const labels: Array<{ position: [number, number, number]; title: string; subtitle: string; accent: string }> = [
    { position: [-4.35, 0.3, -0.75], title: "checksums.txt", subtitle: "integrity map", accent: "#AAB3AF" },
    { position: [4.2, 0.3, -0.75], title: "metadata", subtitle: "columns + codecs", accent: "#F0EEE5" },
    { position: [0, 3.65, 0], title: "primary.idx", subtitle: "sparse marks", accent: COLORS.yellow },
    { position: [0, -2.7, 2.5], title: "marks", subtitle: "granule offsets", accent: COLORS.cyan },
    { position: [0, 0.35, 0], title: "column files", subtitle: "compressed streams", accent: "#F0A43A" },
  ];
  return labels.map((label) => <Html pointerEvents="none" key={label.title} center position={label.position} distanceFactor={7} zIndexRange={[18, 8]}><div className="part-callout" style={{ "--callout-accent": label.accent } as React.CSSProperties}><strong>{label.title}</strong><small>{label.subtitle}</small></div></Html>);
}

function ImmutablePart({ exploded }: { exploded: boolean }) {
  const shell = useRef<THREE.Mesh>(null);
  const marks = useRef<THREE.Group>(null);
  const index = useRef<THREE.Group>(null);
  const checksums = useRef<THREE.Group>(null);
  const metadata = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (shell.current) {
      const material = shell.current.material as THREE.MeshPhysicalMaterial;
      setComposedMaterialBaseOpacity(
        material,
        THREE.MathUtils.damp(material.userData.composedFade?.baseOpacity ?? material.opacity, exploded ? 0.08 : 0.24, 5, delta),
      );
      shell.current.scale.setScalar(THREE.MathUtils.damp(shell.current.scale.x, exploded ? 1.08 : 1, 5, delta));
    }
    if (marks.current) { marks.current.position.y = THREE.MathUtils.damp(marks.current.position.y, exploded ? -2 : 0, 5, delta); marks.current.position.z = THREE.MathUtils.damp(marks.current.position.z, exploded ? 2.15 : 0.82, 5, delta); }
    if (index.current) index.current.position.y = THREE.MathUtils.damp(index.current.position.y, exploded ? 3.05 : 1.28, 5, delta);
    if (checksums.current) { checksums.current.position.x = THREE.MathUtils.damp(checksums.current.position.x, exploded ? -3.7 : -1.45, 5, delta); checksums.current.rotation.y = THREE.MathUtils.damp(checksums.current.rotation.y, exploded ? 0.34 : 0.18, 5, delta); }
    if (metadata.current) { metadata.current.position.x = THREE.MathUtils.damp(metadata.current.position.x, exploded ? 3.7 : 1.48, 5, delta); metadata.current.rotation.y = THREE.MathUtils.damp(metadata.current.rotation.y, exploded ? -0.34 : -0.18, 5, delta); }
  });
  return (
    <group>
      <RoundedBox ref={shell} args={[4.65, 3.45, 2.45]} radius={0.22} smoothness={5} castShadow><meshPhysicalMaterial color="#D9E2DF" transparent opacity={0.24} roughness={0.12} metalness={0.05} transmission={0.18} depthWrite={false} side={THREE.DoubleSide} /></RoundedBox>
      <ColumnFiles exploded={exploded} /><MarksPlate groupRef={marks} /><SparseIndex groupRef={index} />
      {exploded && <><ChecksumLedger groupRef={checksums} /><MetadataPlate groupRef={metadata} /></>}
      {exploded && <><Line points={[[-2.2, 0, -0.8], [-3.1, 0.2, -0.8]]} color="#77807D" lineWidth={1.2} dashed dashSize={0.12} gapSize={0.08} /><Line points={[[2.2, 0, -0.8], [3.1, 0.2, -0.8]]} color="#77807D" lineWidth={1.2} dashed dashSize={0.12} gapSize={0.08} /><Line points={[[0, 1.55, 0], [0, 2.55, 0]]} color={COLORS.yellow} lineWidth={1.2} dashed dashSize={0.12} gapSize={0.08} /><Line points={[[0, -1.55, 0.7], [0, -1.8, 1.75]]} color={COLORS.cyan} lineWidth={1.2} dashed dashSize={0.12} gapSize={0.08} /></>}
      <PartLabels visible={exploded} />
    </group>
  );
}

function IncomingPart({ position, delay, pressure }: { position: [number, number, number]; delay: number; pressure: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const getTime = useMachineTime();
  useFrame(() => {
    if (!ref.current) return;
    // These are the queue behind the dedicated Part B pickup cassette. Keep
    // them in their own slots: translating each one through the pickup point
    // created duplicate parts underneath the crane.
    const phase = getTime() * (pressure ? 1.2 : 0.7) + delay * Math.PI * 2;
    ref.current.position.x = position[0];
    ref.current.position.y = position[1] + Math.sin(phase) * 0.025;
    ref.current.rotation.y = -0.035 + Math.sin(phase * 0.6) * 0.025;
  });
  return <group ref={ref} position={position}><FoundryPartArtifact accent={pressure ? COLORS.pressure : COLORS.cyan} /></group>;
}

/**
 * One immutable MergeTree part. The ceramic shell and visible column files are
 * deliberately stable across arrival, crane transport, merge, and commit so a
 * part never looks like it transforms into the black merge machinery.
 */
function FoundryPartArtifact({ accent, secondaryAccent, muted = false }: { accent: string; secondaryAccent?: string; muted?: boolean }) {
  const colors = muted ? ["#858B88", "#A0A5A2", "#747A77", "#969B98", "#7E8481"] : columnColors.slice(0, 5);
  return (
    <group>
      <RoundedBox args={[1.32, 0.68, 1]} radius={0.12} smoothness={4} castShadow>
        <meshStandardMaterial color={muted ? "#B8BCB9" : "#E2E7E4"} roughness={0.38} metalness={0.12} />
      </RoundedBox>
      {colors.map((color, index) => (
        <RoundedBox key={color + index} args={[0.18, 0.4, 0.055]} radius={0.025} smoothness={2} position={[-0.44 + index * 0.22, -0.04, 0.515]}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={muted ? 0 : 0.12} roughness={0.38} />
        </RoundedBox>
      ))}
      {secondaryAccent && !muted ? <>
        <mesh position={[-0.225, 0.36, 0]}>
          <boxGeometry args={[0.41, 0.055, 0.72]} />
          <meshBasicMaterial color={accent} />
        </mesh>
        <mesh position={[0.225, 0.36, 0]}>
          <boxGeometry args={[0.41, 0.055, 0.72]} />
          <meshBasicMaterial color={secondaryAccent} />
        </mesh>
      </> : <mesh position={[0, 0.36, 0]}>
        <boxGeometry args={[0.86, 0.055, 0.72]} />
        <meshBasicMaterial color={muted ? "#767C79" : accent} />
      </mesh>}
      <mesh position={[0, -0.1, -0.505]}>
        <boxGeometry args={[0.72, 0.18, 0.04]} />
        <meshStandardMaterial color={muted ? "#666C69" : "#353A38"} roughness={0.48} />
      </mesh>
    </group>
  );
}

function FoundryCrane({ pressure }: { pressure: boolean }) {
  const carriage = useRef<THREE.Group>(null);
  const hoist = useRef<THREE.Group>(null);
  const cable = useRef<THREE.Mesh>(null);
  const leftClaw = useRef<THREE.Group>(null);
  const rightClaw = useRef<THREE.Group>(null);
  const payload = useRef<THREE.Group>(null);
  const payloadLabel = useRef<HTMLSpanElement>(null);
  const status = useRef<HTMLSpanElement>(null);
  const previousStage = useRef("");
  const getTime = useMachineTime();
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  useFrame(() => {
    const frame = foundryCraneFrame(getTime(), pressure, reducedMotion);
    if (carriage.current) carriage.current.position.x = frame.carriageX;
    if (hoist.current) hoist.current.position.y = frame.hookY;
    if (cable.current) {
      const length = Math.max(0.18, -frame.hookY);
      cable.current.position.y = frame.hookY / 2;
      cable.current.scale.y = length;
    }
    if (leftClaw.current) leftClaw.current.rotation.z = -frame.clawAngle;
    if (rightClaw.current) rightClaw.current.rotation.z = frame.clawAngle;
    if (payload.current) {
      payload.current.visible = frame.payloadVisible;
      payload.current.position.set(...frame.payloadPosition);
      payload.current.scale.setScalar(frame.payloadScale);
    }
    if (payloadLabel.current) payloadLabel.current.style.display = frame.payloadVisible ? "inline-flex" : "none";
    if (previousStage.current !== frame.stage) {
      previousStage.current = frame.stage;
      document.documentElement.dataset.craneStage = frame.stage;
      if (status.current) status.current.textContent = ({
        ready: "PART B READY",
        lower: "ALIGN WITH PART B",
        grip: "GRIP PART B",
        lift: "LIFT PART B",
        carry: "MOVE PART B TO MERGE",
        place: "PLACE PART B",
        release: "RELEASE PART B",
        retract: "CLEAR MERGE FEED",
        return: "RETURN FOR NEXT PART",
      } as const)[frame.stage];
    }
  });
  return (
    <group position={[-0.75, 5.15, 0]}>
      <MachinePlate position={[0, 0, 0]} size={[8.2, 0.28, 0.34]} />
      <MachinePlate position={[-4, -2.25, 0]} size={[0.32, 4.7, 0.42]} />
      <MachinePlate position={[4, -2.25, 0]} size={[0.32, 4.7, 0.42]} />
      <group ref={carriage}>
        <RoundedBox args={[1.15, 0.55, 0.78]} radius={0.1} smoothness={3}>
          <meshStandardMaterial color={pressure ? COLORS.pressure : COLORS.yellow} emissive={pressure ? COLORS.pressure : COLORS.yellow} emissiveIntensity={0.25} roughness={0.3} metalness={0.35} />
        </RoundedBox>
        <mesh ref={cable} position={[0, -0.5, 0]} scale={[1, 1, 1]}>
          <boxGeometry args={[0.055, 1, 0.055]} />
          <meshStandardMaterial color="#25282B" metalness={0.58} roughness={0.24} />
        </mesh>
        <group ref={hoist}>
          <RoundedBox args={[0.72, 0.25, 0.5]} radius={0.07} smoothness={3} castShadow>
            <meshStandardMaterial color="#25282B" metalness={0.54} roughness={0.28} />
          </RoundedBox>
          <group ref={leftClaw} position={[-0.79, -0.06, 0]} rotation={[0, 0, -0.42]}>
            <mesh position={[0, -0.51, 0]}><boxGeometry args={[0.11, 1.02, 0.16]} /><meshStandardMaterial color="#25282B" metalness={0.54} roughness={0.28} /></mesh>
            <mesh position={[0.07, -0.98, 0]}><boxGeometry args={[0.18, 0.13, 0.34]} /><meshStandardMaterial color="#25282B" metalness={0.54} roughness={0.28} /></mesh>
          </group>
          <group ref={rightClaw} position={[0.79, -0.06, 0]} rotation={[0, 0, 0.42]}>
            <mesh position={[0, -0.51, 0]}><boxGeometry args={[0.11, 1.02, 0.16]} /><meshStandardMaterial color="#25282B" metalness={0.54} roughness={0.28} /></mesh>
            <mesh position={[-0.07, -0.98, 0]}><boxGeometry args={[0.18, 0.13, 0.34]} /><meshStandardMaterial color="#25282B" metalness={0.54} roughness={0.28} /></mesh>
          </group>
        </group>
      </group>
      <group ref={payload} position={[-1.15, -4.2, 0]}>
        <FoundryPartArtifact accent={pressure ? COLORS.pressure : COLORS.yellow} />
        <Html pointerEvents="none" center position={[0, -0.72, 0]} distanceFactor={9}><span ref={payloadLabel} className="crane-payload-label">PART B · IMMUTABLE</span></Html>
      </group>
      <group position={[2.28, -4.2, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.68, 0.8, 24]} /><meshBasicMaterial color={pressure ? COLORS.pressure : COLORS.yellow} /></mesh>
        <Html pointerEvents="none" center position={[1.38, 0.14, 1.15]} distanceFactor={9}><span className="crane-feed-label">PART B DROP ZONE</span></Html>
      </group>
      <Html pointerEvents="none" center position={[0, -0.15, 0]} distanceFactor={10}>
        <span ref={status} className="crane-status">PART B READY</span>
      </Html>
    </group>
  );
}

// Keep retired source parts at the far rear service edge. Depth does most of
// the separation here; a small x offset keeps the bin readable without letting
// it project over the merge worker from the default camera.
const RETIREMENT_BIN_POSITION = { x: 1.05, y: 0.08, z: -5.65 } as const;

function PartRetirementBin({ pressure }: { pressure: boolean }) {
  const rimColor = pressure ? COLORS.pressure : COLORS.yellow;
  return (
    <group position={[RETIREMENT_BIN_POSITION.x, RETIREMENT_BIN_POSITION.y, RETIREMENT_BIN_POSITION.z]}>
      <RoundedBox args={[1.62, 0.14, 1.3]} radius={0.06} smoothness={3} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#323633" roughness={0.58} metalness={0.22} />
      </RoundedBox>
      <RoundedBox args={[1.62, 0.7, 0.14]} radius={0.045} smoothness={3} position={[0, 0.4, -0.58]} castShadow>
        <meshStandardMaterial color="#252927" roughness={0.42} metalness={0.38} />
      </RoundedBox>
      <RoundedBox args={[1.62, 0.54, 0.14]} radius={0.045} smoothness={3} position={[0, 0.32, 0.58]} castShadow>
        <meshStandardMaterial color="#252927" roughness={0.42} metalness={0.38} />
      </RoundedBox>
      {[-0.74, 0.74].map((x) => <RoundedBox key={x} args={[0.14, 0.7, 1.04]} radius={0.045} smoothness={3} position={[x, 0.4, 0]} castShadow>
        <meshStandardMaterial color="#252927" roughness={0.42} metalness={0.38} />
      </RoundedBox>)}
      <Line points={[[ -0.8, 0.78, -0.65], [0.8, 0.78, -0.65], [0.8, 0.78, 0.65], [-0.8, 0.78, 0.65], [-0.8, 0.78, -0.65]]} color={rimColor} lineWidth={3} />
      <Html pointerEvents="none" center position={[0, 1, -0.18]} distanceFactor={9}><span className="retirement-bin-label">A + B · OLD PARTS BIN</span></Html>
    </group>
  );
}

function SortedMergeLoom({ pressure }: { pressure: boolean }) {
  const streamA = useRef<THREE.InstancedMesh>(null);
  const streamB = useRef<THREE.InstancedMesh>(null);
  const outputA = useRef<THREE.InstancedMesh>(null);
  const outputB = useRef<THREE.InstancedMesh>(null);
  const gate = useRef<THREE.Group>(null);
  const sourcePartA = useRef<THREE.Group>(null);
  const sourcePartB = useRef<THREE.Group>(null);
  const committedPart = useRef<THREE.Group>(null);
  const committedPartLabel = useRef<HTMLSpanElement>(null);
  const retiredSourceA = useRef<THREE.Group>(null);
  const retiredSourceB = useRef<THREE.Group>(null);
  const sourcePartALabel = useRef<HTMLSpanElement>(null);
  const sourcePartBLabel = useRef<HTMLSpanElement>(null);
  const streamLabel = useRef<HTMLSpanElement>(null);
  const status = useRef<HTMLSpanElement>(null);
  const lifecycleStatus = useRef<HTMLSpanElement>(null);
  const previousStage = useRef("");
  const previousLifecycle = useRef<FoundryPartLifecycle | "">("");
  const getTime = useMachineTime();
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  const helper = useRef(new THREE.Object3D());
  useEffect(() => () => {
    delete document.documentElement.dataset.partLifecycle;
    delete document.documentElement.dataset.partRetirementProgress;
  }, []);
  useFrame(() => {
    const frame = foundryMergeFrame(getTime(), pressure, reducedMotion);
    document.documentElement.dataset.partRetirementProgress = frame.removalProgress.toFixed(3);
    const object = helper.current;
    const updateInput = (mesh: THREE.InstancedMesh | null, lane: -1 | 1) => {
      if (!mesh) return;
      for (let index = 0; index < 9; index += 1) {
        const parked = index / 9 * 0.82;
        const progress = THREE.MathUtils.lerp(parked, 1, frame.inputProgress);
        object.position.set(-2.2 + progress * 2.05, 0.38 + Math.sin(progress * Math.PI) * 0.16, lane * (0.88 - progress * 0.66));
        object.rotation.set(0, 0, lane * (0.13 - progress * 0.12));
        object.scale.set(1, 1, 1);
        object.updateMatrix();
        mesh.setMatrixAt(index, object.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.opacity = frame.inputOpacity;
    };
    const updateOutput = (mesh: THREE.InstancedMesh | null, offset: number, lane: number) => {
      if (!mesh) return;
      for (let index = 0; index < 8; index += 1) {
        const progress = THREE.MathUtils.clamp(frame.outputProgress * 1.42 - index / 8 * 0.42 + offset, 0, 1);
        object.position.set(0.35 + progress * 2.15, 0.38, lane);
        object.rotation.set(0, 0, 0);
        object.scale.setScalar(frame.outputProgress > index / 11 ? 1 : 0.001);
        object.updateMatrix();
        mesh.setMatrixAt(index, object.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.opacity = frame.outputProgress > 0.01 ? 1 : 0;
    };
    updateInput(streamA.current, -1);
    updateInput(streamB.current, 1);
    updateOutput(outputA.current, 0, -0.13);
    updateOutput(outputB.current, 0.04, 0.13);
    if (gate.current) gate.current.position.y = 0.86 + Math.sin(frame.gatePulse * Math.PI * 3) * 0.055;
    const sourcePartAVisible = frame.inactiveSourceOpacity < 0.05 && frame.stage !== "retire";
    const sourcePartBVisible = frame.stage !== "waiting" && frame.inactiveSourceOpacity < 0.05 && frame.stage !== "retire";
    if (sourcePartA.current) sourcePartA.current.visible = sourcePartAVisible;
    if (sourcePartB.current) sourcePartB.current.visible = sourcePartBVisible;
    if (sourcePartALabel.current) sourcePartALabel.current.style.display = sourcePartAVisible ? "inline-flex" : "none";
    if (sourcePartBLabel.current) sourcePartBLabel.current.style.display = sourcePartBVisible ? "inline-flex" : "none";
    if (committedPart.current) {
      committedPart.current.visible = frame.committedPartVisible;
      // Anchor the left edge of Part C while its case fills from left to right.
      // This makes the output rows visibly become the contents of a new part,
      // rather than making a completed yellow object appear at commit time.
      const build = THREE.MathUtils.clamp(frame.outputProgress, 0.06, 1);
      committedPart.current.scale.set(build, 1, 1);
      committedPart.current.position.x = 2.42 + build * 0.63;
    }
    if (committedPartLabel.current) committedPartLabel.current.style.display = frame.committedPartVisible ? "inline-flex" : "none";
    const updateRetiredPart = (part: THREE.Group | null, sourceZ: number, delay: number) => {
      if (!part) return;
      const visible = frame.inactiveSourceOpacity > 0.01 || frame.removalProgress > 0.01;
      const progress = THREE.MathUtils.clamp((frame.removalProgress - delay) / (1 - delay), 0, 1);
      const insertProgress = THREE.MathUtils.smoothstep(progress, 0.76, 1);
      part.visible = visible && progress < 0.995;
      part.position.set(
        THREE.MathUtils.lerp(-2.32, RETIREMENT_BIN_POSITION.x, progress),
        THREE.MathUtils.lerp(0.66, 0.78, progress) + Math.sin(progress * Math.PI) * 1.22,
        THREE.MathUtils.lerp(sourceZ, RETIREMENT_BIN_POSITION.z, progress),
      );
      part.rotation.set(progress * 0.16, progress * (sourceZ < 0 ? -0.42 : 0.42), progress * (sourceZ < 0 ? 0.2 : -0.2));
      part.scale.setScalar(THREE.MathUtils.lerp(1, 0.46, insertProgress));
    };
    updateRetiredPart(retiredSourceA.current, -1.03, 0);
    updateRetiredPart(retiredSourceB.current, 1.03, 0.12);
    const lifecycle = foundryPartLifecycle(frame, previousLifecycle.current);
    if (previousLifecycle.current !== lifecycle || lifecycleStatus.current?.dataset.state !== lifecycle) {
      previousLifecycle.current = lifecycle;
      document.documentElement.dataset.partLifecycle = lifecycle;
      if (lifecycleStatus.current) {
        lifecycleStatus.current.dataset.state = lifecycle;
        lifecycleStatus.current.style.display = lifecycle === "active" ? "none" : "inline-flex";
        lifecycleStatus.current.textContent = ({
          active: "",
          inactive: "PARTS A + B · INACTIVE",
          removed: "PARTS A + B · REMOVED",
        } as const)[lifecycle];
      }
    }
    if (previousStage.current !== frame.stage) {
      previousStage.current = frame.stage;
      document.documentElement.dataset.mergePhase = frame.stage;
      if (streamLabel.current) streamLabel.current.textContent = ({
        waiting: "PART A WAITS FOR PART B",
        feed: "READ ROWS FROM PARTS A + B",
        interleave: "CYAN + YELLOW ROWS INTERLEAVE",
        commit: "PART C IS NOW ACTIVE",
        retire: "PARTS A + B RETIRE",
      } as const)[frame.stage];
      if (status.current) status.current.textContent = ({
        waiting: "WAITING FOR PART B",
        feed: "OPEN PARTS A + B",
        interleave: "MERGE SORTED ROWS",
        commit: "WRITE + COMMIT PART C",
        retire: "PARTS A + B BECOME INACTIVE",
      } as const)[frame.stage];
      if (committedPartLabel.current) committedPartLabel.current.textContent = frame.stage === "interleave"
        ? "PART C · WRITING"
        : "PART C · ACTIVE";
    }
  });
  return (
    <group position={[3.85, 0.29, -1.03]}>
      <Line points={[[-2.45, 0.19, -1.05], [-0.05, 0.19, -0.22]]} color="#34383A" lineWidth={4} />
      <Line points={[[-2.45, 0.19, 1.05], [-0.05, 0.19, 0.22]]} color="#34383A" lineWidth={4} />
      <Line points={[[0.28, 0.19, 0], [2.8, 0.19, 0]]} color="#34383A" lineWidth={5} />
      <group ref={sourcePartA} position={[-2.32, 0.66, -1.03]}>
        <FoundryPartArtifact accent={pressure ? COLORS.pressure : COLORS.cyan} />
        <Html pointerEvents="none" center position={[0, 0.86, 0]} distanceFactor={9}><span ref={sourcePartALabel} className="source-part-label" data-source="a">PART A · IMMUTABLE</span></Html>
      </group>
      <group ref={sourcePartB} position={[-2.32, 0.66, 1.03]} visible={false}>
        <FoundryPartArtifact accent={pressure ? COLORS.pressure : COLORS.yellow} />
        <Html pointerEvents="none" center position={[0, 0.86, 0]} distanceFactor={9}><span ref={sourcePartBLabel} className="source-part-label" data-source="b">PART B · IMMUTABLE</span></Html>
      </group>
      <instancedMesh ref={streamA} args={[undefined, undefined, 9]}><boxGeometry args={[0.32, 0.18, 0.3]} /><meshStandardMaterial transparent color={pressure ? "#F07465" : COLORS.cyan} emissive={pressure ? COLORS.pressure : COLORS.cyan} emissiveIntensity={0.32} roughness={0.32} /></instancedMesh>
      <instancedMesh ref={streamB} args={[undefined, undefined, 9]}><boxGeometry args={[0.32, 0.18, 0.3]} /><meshStandardMaterial transparent color={pressure ? "#F6A08F" : COLORS.yellow} emissive={pressure ? COLORS.pressure : COLORS.yellow} emissiveIntensity={0.28} roughness={0.32} /></instancedMesh>
      <instancedMesh ref={outputA} args={[undefined, undefined, 8]}><boxGeometry args={[0.26, 0.19, 0.42]} /><meshStandardMaterial transparent color={COLORS.cyan} emissive={COLORS.cyan} emissiveIntensity={0.3} roughness={0.32} /></instancedMesh>
      <instancedMesh ref={outputB} args={[undefined, undefined, 8]}><boxGeometry args={[0.26, 0.19, 0.42]} /><meshStandardMaterial transparent color={pressure ? COLORS.pressure : COLORS.yellow} emissive={pressure ? COLORS.pressure : COLORS.yellow} emissiveIntensity={0.3} roughness={0.32} /></instancedMesh>
      <group ref={gate} position={[0, 0.86, 0]}>
        <RoundedBox args={[0.58, 1.82, 1.58]} radius={0.11} smoothness={3} castShadow><meshStandardMaterial color="#24282A" roughness={0.24} metalness={0.55} /></RoundedBox>
        <mesh position={[0.33, 0, 0]}><boxGeometry args={[0.12, 1.36, 0.72]} /><meshStandardMaterial color={pressure ? COLORS.pressure : COLORS.cyan} emissive={pressure ? COLORS.pressure : COLORS.cyan} emissiveIntensity={0.34} roughness={0.28} /></mesh>
        <Html pointerEvents="none" center position={[0, 1.26, 0]} distanceFactor={8}><span className="merge-worker-label">MERGE WORKER</span></Html>
      </group>
      <group ref={committedPart} position={[3.05, 0.72, 0]} visible={false}>
        <FoundryPartArtifact accent={pressure ? COLORS.pressure : COLORS.cyan} secondaryAccent={pressure ? undefined : COLORS.yellow} />
        <Html pointerEvents="none" center position={[0, 0.82, 0]} distanceFactor={9}><span ref={committedPartLabel} className="merge-output-label" style={{ display: "none" }}>PART C · WRITING</span></Html>
      </group>
      <group position={[3.05, 0.16, 0]}>
        <RoundedBox args={[1.7, 0.1, 1.3]} radius={0.05} smoothness={2}>
          <meshStandardMaterial color="#EEEFEA" roughness={0.58} metalness={0.08} />
        </RoundedBox>
        <Line points={[[ -0.72, 0.08, -0.48], [0.72, 0.08, -0.48], [0.72, 0.08, 0.48], [-0.72, 0.08, 0.48], [-0.72, 0.08, -0.48]]} color={COLORS.yellow} lineWidth={2.5} />
        <Html pointerEvents="none" center position={[0, 0.22, 0.84]} distanceFactor={9}><span className="part-c-destination-label">PART C OUTPUT</span></Html>
      </group>
      <MachinePlate position={[RETIREMENT_BIN_POSITION.x, 0.05, RETIREMENT_BIN_POSITION.z]} size={[2.25, 0.1, 1.62]} color="#E4E4DF" />
      <PartRetirementBin pressure={pressure} />
      <group ref={retiredSourceA} position={[-2.32, 0.66, -1.03]} visible={false}><FoundryPartArtifact accent="#777D7A" muted /></group>
      <group ref={retiredSourceB} position={[-2.32, 0.66, 1.03]} visible={false}><FoundryPartArtifact accent="#777D7A" muted /></group>
      <Html pointerEvents="none" center position={[RETIREMENT_BIN_POSITION.x, 1.58, RETIREMENT_BIN_POSITION.z - 0.18]} distanceFactor={10}><span ref={lifecycleStatus} className="part-lifecycle-status" data-state="active" style={{ display: "none" }} /></Html>
      <Html pointerEvents="none" center position={[-0.25, -1.15, 2.45]} distanceFactor={10}><span ref={status} className="foundry-label">WAITING FOR PART B</span></Html>
      <Html pointerEvents="none" center position={[-1.5, 1.12, 0]} distanceFactor={10}><span ref={streamLabel} className="merge-stream-label" style={{ display: "none" }}>PART A + PART B</span></Html>
    </group>
  );
}

function VersionCandidate({ position, version, winner, muted = false }: {
  position: [number, number, number];
  version: string;
  winner: boolean;
  muted?: boolean;
}) {
  return (
    <group position={position}>
      <DataCassette color={winner ? COLORS.yellow : muted ? "#B7BAB7" : COLORS.cyan} opacity={muted ? 0.48 : 1} scale={[1.1, 1.05, 1]} />
      <DataBars count={8} spread={[0.78, 0.3, 0.44]} scale={[0.05, 0.15, 0.05]} offset={[0, -0.12, 0]} color={winner ? "#15171A" : "#FFFFFF"} />
      <Html pointerEvents="none" center position={[0, 0.72, 0]} distanceFactor={8}>
        <span className="version-row-label" data-winner={winner}>{version}</span>
      </Html>
    </group>
  );
}

function ArgMaxWinnerCrane({ pressure }: { pressure: boolean }) {
  const carriage = useRef<THREE.Group>(null);
  const winner = useRef<THREE.Group>(null);
  const status = useRef<HTMLElement>(null);
  const previousStage = useRef("");
  const getTime = useMachineTime();
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  useFrame(() => {
    const frame = replacingReadFrame(getTime(), "argmax", reducedMotion);
    if (carriage.current) carriage.current.position.x = THREE.MathUtils.lerp(-2.1, 2.1, frame.decisionProgress);
    if (winner.current) {
      winner.current.visible = frame.winnerProgress > 0.01;
      winner.current.position.set(2.1 + frame.resultProgress * 1.25, 0.8 + frame.winnerProgress * 0.78, -0.72);
      winner.current.scale.setScalar(0.78 + frame.winnerProgress * 0.22);
    }
    if (previousStage.current !== frame.stage) {
      previousStage.current = frame.stage;
      document.documentElement.dataset.replacingPhase = frame.stage;
      if (status.current) status.current.textContent = ({
        observe: "Read three candidates",
        evaluate: "Compare (version, tie)",
        resolve: "v3 · tie 9 is greatest",
        emit: "Return exactly one row",
      } as const)[frame.stage];
    }
  });
  return (
    <group position={[0.4, 1.3, 0]}>
      <MachinePlate position={[0, 3.45, 0]} size={[7.3, 0.24, 0.34]} />
      <MachinePlate position={[-3.5, 1.72, 0]} size={[0.28, 3.7, 0.4]} />
      <MachinePlate position={[3.5, 1.72, 0]} size={[0.28, 3.7, 0.4]} />
      <group ref={carriage}>
        <RoundedBox args={[1.35, 0.52, 0.8]} radius={0.1} smoothness={3} position={[0, 3.08, 0]} castShadow>
          <meshStandardMaterial color={pressure ? COLORS.pressure : COLORS.yellow} emissive={pressure ? COLORS.pressure : COLORS.yellow} emissiveIntensity={0.25} roughness={0.28} metalness={0.38} />
        </RoundedBox>
        <Line points={[[0, 2.86, 0], [0, 1.4, 0]]} color="#15171A" lineWidth={3} />
      </group>
      <VersionCandidate position={[-2.1, 0.72, 0.72]} version="key A · v1 · tie 2" winner={false} muted />
      <VersionCandidate position={[0, 0.72, 0.72]} version="key A · v2 · tie 7" winner={false} />
      <VersionCandidate position={[2.1, 0.72, 0.72]} version="key A · v3 · tie 9" winner={false} muted />
      <group ref={winner} position={[2.1, 0.8, -0.72]} visible={false}>
        <VersionCandidate position={[0, 0, 0]} version="key A · v3 · tie 9" winner />
      </group>
      <InstrumentGauge position={[3.1, 1.1, -1.4]} value={0.58} color={pressure ? COLORS.pressure : COLORS.cyan} label="READ WORK" />
      <Html pointerEvents="none" center position={[0, 4.25, 0]} distanceFactor={9}>
        <div className="family-machine-label"><span>ARGMAX WINNER CRANE</span><strong ref={status}>Read three candidates</strong></div>
      </Html>
    </group>
  );
}

function FinalReconciliationPress({ pressure }: { pressure: boolean }) {
  const press = useRef<THREE.Group>(null);
  const output = useRef<THREE.Group>(null);
  const status = useRef<HTMLElement>(null);
  const previousStage = useRef("");
  const getTime = useMachineTime();
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  useFrame(() => {
    const frame = replacingReadFrame(getTime(), "final", reducedMotion);
    if (press.current) press.current.position.y = 3.25 - frame.decisionProgress * 0.68 + frame.resultProgress * 0.48;
    if (output.current) {
      output.current.visible = frame.resultProgress > 0.01;
      output.current.position.x = 2.3 + frame.resultProgress * 1.45;
      output.current.scale.setScalar(0.76 + frame.resultProgress * 0.24);
    }
    if (previousStage.current !== frame.stage) {
      previousStage.current = frame.stage;
      document.documentElement.dataset.replacingPhase = frame.stage;
      if (status.current) status.current.textContent = ({
        observe: "Collect every matching key",
        evaluate: "Apply replacement rules now",
        resolve: "Drop the older v2 row",
        emit: "Return reconciled v3",
      } as const)[frame.stage];
    }
  });
  return (
    <group position={[0.35, 0.55, 0]}>
      <MachinePlate position={[-1.1, 0.28, 0]} size={[6.4, 0.24, 3.1]} color="#D2D3D0" />
      <MachinePlate position={[-3.85, 2.25, 0]} size={[0.35, 4.1, 3.45]} />
      <MachinePlate position={[1.65, 2.25, 0]} size={[0.35, 4.1, 3.45]} />
      <group ref={press} position={[-1.1, 3.25, 0]}>
        <RoundedBox args={[4.7, 0.72, 2.55]} radius={0.13} smoothness={3} castShadow>
          <meshStandardMaterial color={pressure ? COLORS.pressure : "#15171A"} emissive={pressure ? COLORS.pressure : "#15171A"} emissiveIntensity={0.12} roughness={0.3} metalness={0.55} />
        </RoundedBox>
        {Array.from({ length: 7 }, (_, index) => <mesh key={index} position={[-1.8 + index * 0.6, -0.42, 0]}><boxGeometry args={[0.15, 0.42, 2.1]} /><meshStandardMaterial color={COLORS.yellow} emissive={COLORS.yellow} emissiveIntensity={0.28} /></mesh>)}
      </group>
      <group position={[-2.25, 0.85, -0.68]}><VersionCandidate position={[0, 0, 0]} version="part 17 · key A · v2" winner={false} /></group>
      <group position={[-0.15, 0.85, 0.7]}><VersionCandidate position={[0, 0, 0]} version="part 21 · key A · v3" winner /></group>
      <group ref={output} position={[2.55, 0.82, 0]} visible={false}><VersionCandidate position={[0, 0, 0]} version="reconciled v3" winner /></group>
      <Line points={[[1.75, 0.42, 0], [4.15, 0.42, 0]]} color="#15171A" lineWidth={5} />
      <InstrumentGauge position={[3.45, 1.15, -1.35]} value={0.94} color={pressure ? COLORS.pressure : COLORS.yellow} label="READ WORK" />
      <Html pointerEvents="none" center position={[-1.1, 4.75, 0]} distanceFactor={9}>
        <div className="family-machine-label"><span>SELECT FINAL PRESS</span><strong ref={status}>Collect every matching key</strong></div>
      </Html>
    </group>
  );
}

function BackgroundReplacementGate({ pressure }: { pressure: boolean }) {
  const scan = useRef<THREE.Mesh>(null);
  const winner = useRef<THREE.Group>(null);
  const status = useRef<HTMLElement>(null);
  const previousStage = useRef("");
  const getTime = useMachineTime();
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  useFrame(() => {
    const frame = replacingReadFrame(getTime(), "background", reducedMotion);
    if (scan.current) scan.current.position.x = THREE.MathUtils.lerp(-2.15, 2.15, frame.decisionProgress);
    if (winner.current) {
      winner.current.visible = frame.resultProgress > 0.01;
      winner.current.position.set(2.15 + frame.resultProgress * 1.25, 0.78 + frame.winnerProgress * 0.32, 0.72);
      winner.current.scale.setScalar(0.8 + frame.resultProgress * 0.2);
    }
    if (previousStage.current !== frame.stage) {
      previousStage.current = frame.stage;
      document.documentElement.dataset.replacingPhase = frame.stage;
      if (status.current) status.current.textContent = ({
        observe: "Three versions still coexist",
        evaluate: "Eligible parts merge later",
        resolve: "Keep the greatest version",
        emit: "Storage converges to v3",
      } as const)[frame.stage];
    }
  });
  return (
    <group position={[0.2, 1, 0]}>
      <MachinePlate position={[0, 0.2, 0]} size={[7.3, 0.22, 3.25]} color="#D2D3D0" />
      <Line points={[[0, 0.34, -1.1], [0, 0.34, 1.1]]} color="#A3A6A3" lineWidth={2} />
      <VersionCandidate position={[-2.15, 0.78, -0.72]} version="key A · v1" winner={false} muted />
      <VersionCandidate position={[0, 0.78, 0.72]} version="key A · v2" winner={false} />
      <VersionCandidate position={[2.15, 0.78, -0.72]} version="key A · v3" winner={false} />
      <group ref={winner} position={[2.15, 0.78, 0.72]} visible={false}><VersionCandidate position={[0, 0, 0]} version="merged winner · v3" winner /></group>
      <RoundedBox args={[5.8, 2.45, 0.22]} radius={0.1} smoothness={3} position={[0, 1.5, -1.55]}>
        <meshStandardMaterial color="#15171A" roughness={0.28} metalness={0.5} />
      </RoundedBox>
      <mesh ref={scan} position={[-2.15, 1.5, -1.38]}>
        <boxGeometry args={[0.15, 1.8, 0.08]} />
        <meshStandardMaterial color={pressure ? COLORS.pressure : COLORS.yellow} emissive={pressure ? COLORS.pressure : COLORS.yellow} emissiveIntensity={0.5} />
      </mesh>
      <InstrumentGauge position={[3.05, 1.05, 1.34]} value={0.28} color={pressure ? COLORS.pressure : COLORS.cyan} label="READ WORK" />
      <Html pointerEvents="none" center position={[0, 3.5, 0]} distanceFactor={9}>
        <div className="family-machine-label"><span>BACKGROUND VERSION SORTER</span><strong ref={status}>Three versions still coexist</strong></div>
      </Html>
    </group>
  );
}

function CompactVersionToken({ position, label, winner = false, muted = false }: {
  position: [number, number, number];
  label: string;
  winner?: boolean;
  muted?: boolean;
}) {
  return (
    <group position={position}>
      <DataCassette color={winner ? COLORS.yellow : muted ? "#AEB3B0" : COLORS.cyan} opacity={muted ? 0.62 : 1} scale={[0.72, 0.78, 0.82]} />
      <Html pointerEvents="none" center position={[0, 0.52, 0]} distanceFactor={9}>
        <span className="family-compare-token-label" data-winner={winner}>{label}</span>
      </Html>
    </group>
  );
}

/**
 * Agent-only comparison view. Both lanes consume the same three logical-row
 * candidates and return v3, but the cyan lane computes an explicit total-order
 * winner while the yellow lane reconciles the engine contract during the read.
 */
function LatestStateComparisonMachine({ pressure }: { pressure: boolean }) {
  const argmaxGate = useRef<THREE.Group>(null);
  const finalPress = useRef<THREE.Group>(null);
  const argmaxOutput = useRef<THREE.Group>(null);
  const finalOutput = useRef<THREE.Group>(null);
  const status = useRef<HTMLElement>(null);
  const previousStage = useRef("");
  const getTime = useMachineTime();
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  useFrame(() => {
    const time = getTime();
    // Normalize both strategy-specific cycles to the same comparison clock so
    // viewers compare work performed, not two unrelated animation phases.
    const argmax = replacingReadFrame(time * (0.08 / 0.095), "argmax", reducedMotion);
    const final = replacingReadFrame(time * (0.08 / 0.082), "final", reducedMotion);
    if (argmaxGate.current) argmaxGate.current.position.x = THREE.MathUtils.lerp(-0.95, 0.3, argmax.decisionProgress);
    if (finalPress.current) finalPress.current.position.y = 1.18 - final.decisionProgress * 0.45 + final.resultProgress * 0.3;
    const updateOutput = (output: THREE.Group | null, progress: number, lane: number) => {
      if (!output) return;
      output.visible = progress > 0.01;
      output.position.set(2.85 + progress * 0.55, 0.76, lane);
      output.scale.setScalar(0.76 + progress * 0.24);
    };
    updateOutput(argmaxOutput.current, argmax.resultProgress, -1.15);
    updateOutput(finalOutput.current, final.resultProgress, 1.15);
    if (previousStage.current !== argmax.stage) {
      previousStage.current = argmax.stage;
      document.documentElement.dataset.replacingPhase = argmax.stage;
      if (status.current) status.current.textContent = ({
        observe: "Both read the same three candidates",
        evaluate: "Each applies a different contract",
        resolve: "Both select logical row v3",
        emit: "Compare work—not the answer",
      } as const)[argmax.stage];
    }
  });
  return (
    <group position={[0.15, 0.72, 0]}>
      <MachinePlate position={[0, 0.12, 0]} size={[9.2, 0.22, 4.45]} color="#D2D3D0" />
      <Line points={[[ -2.6, 0.3, 0], [3.75, 0.3, 0]]} color="#A9ADAA" lineWidth={2} />

      <group position={[-3.55, 0, 0]}>
        <CompactVersionToken position={[0, 0.75, -1.12]} label="key A · v1" muted />
        <CompactVersionToken position={[0, 0.75, 0]} label="key A · v2" />
        <CompactVersionToken position={[0, 0.75, 1.12]} label="key A · v3" />
        <Html pointerEvents="none" center position={[0, 2.18, 0]} distanceFactor={9}>
          <div className="family-compare-source-label"><span>Same logical key</span><strong>3 candidate rows</strong></div>
        </Html>
      </group>

      <Line points={[[ -2.9, 0.66, -1.1], [-1.1, 0.66, -1.15], [2.5, 0.66, -1.15]]} color={COLORS.cyan} lineWidth={4} />
      <Line points={[[ -2.9, 0.66, 1.1], [-1.1, 0.66, 1.15], [2.5, 0.66, 1.15]]} color={COLORS.yellow} lineWidth={4} />

      <group ref={argmaxGate} position={[-0.95, 1.05, -1.15]}>
        <RoundedBox args={[1.32, 1.42, 1.02]} radius={0.11} smoothness={3} castShadow>
          <meshStandardMaterial color="#15171A" roughness={0.26} metalness={0.54} />
        </RoundedBox>
        {[-0.32, 0, 0.32].map((y, index) => <mesh key={y} position={[0.72, y, 0]}><boxGeometry args={[0.16, 0.16, 0.72]} /><meshStandardMaterial color={index === 2 ? COLORS.yellow : COLORS.cyan} emissive={index === 2 ? COLORS.yellow : COLORS.cyan} emissiveIntensity={0.3} /></mesh>)}
      </group>
      <Html pointerEvents="none" center position={[-0.2, 2.42, -1.15]} distanceFactor={9}>
        <div className="family-compare-track-label" data-method="argmax"><span>argMax</span><strong>max(version, tie)</strong><small>explicit query logic</small></div>
      </Html>
      <InstrumentGauge position={[1.72, 1.05, -1.15]} value={0.58} color={pressure ? COLORS.pressure : COLORS.cyan} label="READ WORK" />
      <group ref={argmaxOutput} position={[2.85, 0.76, -1.15]} visible={false}><CompactVersionToken position={[0, 0, 0]} label="winner · v3" winner /></group>

      <group ref={finalPress} position={[0.15, 1.18, 1.15]}>
        <RoundedBox args={[2.05, 0.72, 1.02]} radius={0.11} smoothness={3} castShadow>
          <meshStandardMaterial color={pressure ? COLORS.pressure : "#15171A"} emissive={pressure ? COLORS.pressure : "#15171A"} emissiveIntensity={0.12} roughness={0.27} metalness={0.54} />
        </RoundedBox>
        {Array.from({ length: 5 }, (_, index) => <mesh key={index} position={[-0.72 + index * 0.36, -0.45, 0]}><boxGeometry args={[0.12, 0.36, 0.74]} /><meshStandardMaterial color={COLORS.yellow} emissive={COLORS.yellow} emissiveIntensity={0.28} /></mesh>)}
      </group>
      <Html pointerEvents="none" center position={[0.15, 2.42, 1.15]} distanceFactor={9}>
        <div className="family-compare-track-label" data-method="final"><span>SELECT FINAL</span><strong>engine rules now</strong><small>query-time reconciliation</small></div>
      </Html>
      <InstrumentGauge position={[1.72, 1.05, 1.15]} value={0.94} color={pressure ? COLORS.pressure : COLORS.yellow} label="READ WORK" />
      <group ref={finalOutput} position={[2.85, 0.76, 1.15]} visible={false}><CompactVersionToken position={[0, 0, 0]} label="reconciled · v3" winner /></group>

      <Html pointerEvents="none" center position={[0, 4.05, 0]} distanceFactor={9}>
        <div className="family-machine-label family-machine-label--comparison"><span>ARGMAX vs SELECT FINAL</span><strong ref={status}>Both read the same three candidates</strong></div>
      </Html>
    </group>
  );
}

function ReplacingMachine({ strategy, pressure }: { strategy: LatestReadStrategy; pressure: boolean }) {
  const latestReadComparison = useAtlasStore((state) => state.latestReadComparison);
  useEffect(() => {
    document.documentElement.dataset.replacingStrategy = latestReadComparison ?? strategy;
    return () => {
      delete document.documentElement.dataset.replacingStrategy;
      delete document.documentElement.dataset.replacingPhase;
    };
  }, [latestReadComparison, strategy]);
  return (
    <group>
      {latestReadComparison ? <LatestStateComparisonMachine pressure={pressure} /> : <>
        {strategy === "background" && <BackgroundReplacementGate pressure={pressure} />}
        {strategy === "argmax" && <ArgMaxWinnerCrane pressure={pressure} />}
        {strategy === "final" && <FinalReconciliationPress pressure={pressure} />}
      </>}
    </group>
  );
}

function MachineValue({ position, value, color = COLORS.yellow, detail }: {
  position: [number, number, number];
  value: string;
  color?: string;
  detail?: string;
}) {
  return (
    <group position={position}>
      <DataCassette color={color} scale={[1.18, 1.2, 1.08]} />
      <Html pointerEvents="none" center position={[0, 0.7, 0]} distanceFactor={8}>
        <span className="machine-value-label"><b>{value}</b>{detail && <small>{detail}</small>}</span>
      </Html>
    </group>
  );
}

function CoalescingBackgroundAssembler({ pressure }: { pressure: boolean }) {
  const output = useRef<THREE.Group>(null);
  const kiln = useRef<THREE.Group>(null);
  const status = useRef<HTMLElement>(null);
  const previousStage = useRef("");
  const getTime = useMachineTime();
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  useFrame(() => {
    const frame = coalescingReadFrame(getTime(), "background", reducedMotion);
    if (kiln.current) kiln.current.rotation.x = Math.PI / 2 + frame.assembleProgress * Math.PI * 1.2;
    if (output.current) {
      output.current.visible = frame.assembleProgress > 0.01;
      output.current.position.x = 2.05 + frame.outputProgress * 0.45;
      output.current.scale.setScalar(0.72 + Math.max(frame.assembleProgress, frame.outputProgress) * 0.28);
    }
    if (previousStage.current !== frame.stage) {
      previousStage.current = frame.stage;
      document.documentElement.dataset.coalescingPhase = frame.stage;
      if (status.current) status.current.textContent = ({
        fragments: "Fields still live in separate parts",
        collect: "Background merge collects fragments",
        assemble: "Latest non-null fills each column",
        emit: "Storage now holds an assembled row",
      } as const)[frame.stage];
    }
  });
  const fragments = [
    { position: [-3.1, 0.9, -1.05] as [number, number, number], value: "temp 21°", color: COLORS.cyan },
    { position: [-3.1, 0.9, 0] as [number, number, number], value: "battery 84%", color: COLORS.yellow },
    { position: [-3.1, 0.9, 1.05] as [number, number, number], value: "status OK", color: "#A48AE3" },
  ];
  return (
    <group position={[0.25, 0.72, 0]}>
      <MachinePlate position={[0, 0.18, 0]} size={[8.1, 0.22, 4.25]} color="#D5D6D3" />
      {fragments.map((fragment) => <MachineValue key={fragment.value} {...fragment} detail="latest non-null" />)}
      {fragments.map((fragment, index) => <Line key={fragment.value} points={[[-2.45, 0.72, fragment.position[2]], [0.75, 0.72, (index - 1) * 0.46]]} color={fragment.color} lineWidth={4} />)}
      <group ref={kiln} position={[0.2, 1.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh castShadow><cylinderGeometry args={[1.05, 1.05, 1.25, 18]} /><meshStandardMaterial color="#15171A" roughness={0.25} metalness={0.58} /></mesh>
        {Array.from({ length: 9 }, (_, index) => { const angle = index / 9 * Math.PI * 2; const color = [COLORS.cyan, COLORS.yellow, "#A48AE3"][index % 3]; return <mesh key={index} position={[Math.cos(angle) * 1.08, 0, Math.sin(angle) * 1.08]}><boxGeometry args={[0.17, 1.42, 0.17]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} /></mesh>; })}
      </group>
      <group ref={output} position={[2.25, 1.05, 0]} visible={false}>
        <RoundedBox args={[2.65, 2.65, 1.1]} radius={0.17} smoothness={4} castShadow>
          <meshStandardMaterial color="#15171A" roughness={0.3} metalness={0.42} />
        </RoundedBox>
        {Array.from({ length: 9 }, (_, index) => {
          const colors = [COLORS.cyan, COLORS.yellow, "#A48AE3"];
          return <RoundedBox key={index} args={[0.62, 0.62, 0.18]} radius={0.06} smoothness={2} position={[-0.72 + (index % 3) * 0.72, 0.72 - Math.floor(index / 3) * 0.72, 0.64]}><meshStandardMaterial color={colors[index % 3]} emissive={colors[index % 3]} emissiveIntensity={0.18} roughness={0.4} /></RoundedBox>;
        })}
        <Html pointerEvents="none" center position={[0, -1.85, 0]} distanceFactor={8}><span className="machine-value-label"><b>stored current row</b><small>after an eligible merge</small></span></Html>
      </group>
      <InstrumentGauge position={[1.55, 1.05, 1.45]} value={0.3} color={pressure ? COLORS.pressure : COLORS.cyan} label="STORAGE WORK" />
      <Html pointerEvents="none" center position={[0, 4.4, 0]} distanceFactor={9}>
        <div className="family-machine-label"><span>BACKGROUND MOSAIC KILN</span><strong ref={status}>Fields still live in separate parts</strong></div>
      </Html>
    </group>
  );
}

function CoalescingFinalAssembler({ pressure }: { pressure: boolean }) {
  const scanner = useRef<THREE.Group>(null);
  const output = useRef<THREE.Group>(null);
  const status = useRef<HTMLElement>(null);
  const previousStage = useRef("");
  const getTime = useMachineTime();
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  useFrame(() => {
    const frame = coalescingReadFrame(getTime(), "final", reducedMotion);
    if (scanner.current) scanner.current.position.x = THREE.MathUtils.lerp(-1.7, 1.25, frame.collectProgress);
    if (output.current) {
      output.current.visible = frame.assembleProgress > 0.01;
      output.current.position.x = 2.25 + frame.outputProgress * 0.45;
      output.current.scale.setScalar(0.72 + Math.max(frame.assembleProgress, frame.outputProgress) * 0.28);
    }
    if (previousStage.current !== frame.stage) {
      previousStage.current = frame.stage;
      document.documentElement.dataset.coalescingPhase = frame.stage;
      if (status.current) status.current.textContent = ({
        fragments: "Bound the current-key candidates",
        collect: "This query reads every fragment now",
        assemble: "NULL means no update—not erase",
        emit: "Return the assembled current row",
      } as const)[frame.stage];
    }
  });
  const fragments = [
    { position: [-3.1, 0.9, -1.05] as [number, number, number], value: "temp 21°", color: COLORS.cyan },
    { position: [-3.1, 0.9, 0] as [number, number, number], value: "battery 84%", color: COLORS.yellow },
    { position: [-3.1, 0.9, 1.05] as [number, number, number], value: "status OK", color: "#A48AE3" },
  ];
  return (
    <group position={[0.25, 0.72, 0]}>
      <MachinePlate position={[0, 0.18, 0]} size={[8.7, 0.22, 4.35]} color="#D5D6D3" />
      {fragments.map((fragment) => <MachineValue key={fragment.value} {...fragment} detail="candidate fragment" />)}
      <RoundedBox args={[4.15, 0.18, 2.85]} radius={0.09} smoothness={3} position={[-0.1, 0.5, 0]} receiveShadow>
        <meshStandardMaterial color="#F6F7F3" emissive="#FFFFFF" emissiveIntensity={0.18} roughness={0.46} metalness={0.08} />
      </RoundedBox>
      <Line points={[[ -2.45, 0.66, -1.05], [-1.85, 0.66, -1.05], [1.55, 0.66, -0.55]]} color={COLORS.cyan} lineWidth={4} />
      <Line points={[[ -2.45, 0.66, 0], [-1.85, 0.66, 0], [1.55, 0.66, 0]]} color={COLORS.yellow} lineWidth={4} />
      <Line points={[[ -2.45, 0.66, 1.05], [-1.85, 0.66, 1.05], [1.55, 0.66, 0.55]]} color="#A48AE3" lineWidth={4} />
      <group ref={scanner} position={[-1.7, 1.3, 0]}>
        <RoundedBox args={[0.34, 1.45, 3.2]} radius={0.08} smoothness={3} castShadow>
          <meshStandardMaterial color={pressure ? COLORS.pressure : "#15171A"} emissive={pressure ? COLORS.pressure : "#15171A"} emissiveIntensity={0.12} roughness={0.26} metalness={0.58} />
        </RoundedBox>
        {[COLORS.cyan, COLORS.yellow, "#A48AE3"].map((color, index) => <mesh key={color} position={[0.2, 0, -0.82 + index * 0.82]}><boxGeometry args={[0.12, 1.05, 0.16]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.34} /></mesh>)}
      </group>
      <group ref={output} position={[2.25, 1.05, 0]} visible={false}>
        <RoundedBox args={[2.65, 2.65, 1.1]} radius={0.17} smoothness={4} castShadow><meshStandardMaterial color="#15171A" roughness={0.3} metalness={0.42} /></RoundedBox>
        {Array.from({ length: 9 }, (_, index) => { const colors = [COLORS.cyan, COLORS.yellow, "#A48AE3"]; return <RoundedBox key={index} args={[0.62, 0.62, 0.18]} radius={0.06} smoothness={2} position={[-0.72 + (index % 3) * 0.72, 0.72 - Math.floor(index / 3) * 0.72, 0.64]}><meshStandardMaterial color={colors[index % 3]} emissive={colors[index % 3]} emissiveIntensity={0.18} roughness={0.4} /></RoundedBox>; })}
        <Html pointerEvents="none" center position={[0, -1.85, 0]} distanceFactor={8}><span className="machine-value-label"><b>current row for this query</b><small>assembled by SELECT FINAL</small></span></Html>
      </group>
      <InstrumentGauge position={[1.45, 1.05, 1.5]} value={0.9} color={pressure ? COLORS.pressure : COLORS.yellow} label="READ WORK" />
      <Html pointerEvents="none" center position={[0, 4.4, 0]} distanceFactor={9}>
        <div className="family-machine-label"><span>SELECT FINAL MOSAIC LIGHT TABLE</span><strong ref={status}>Bound the current-key candidates</strong></div>
      </Html>
    </group>
  );
}

function CoalescingMosaicMachine({ pressure, strategy }: { pressure: boolean; strategy: LatestReadStrategy }) {
  const mode = strategy === "final" ? "final" : "background";
  useEffect(() => {
    document.documentElement.dataset.coalescingStrategy = mode;
    return () => {
      delete document.documentElement.dataset.coalescingStrategy;
      delete document.documentElement.dataset.coalescingPhase;
    };
  }, [mode]);
  return mode === "final" ? <CoalescingFinalAssembler pressure={pressure} /> : <CoalescingBackgroundAssembler pressure={pressure} />;
}

function CounterStack({ value, label, color, compact = false, showLabel = true }: { value: number; label: string; color: string; compact?: boolean; showLabel?: boolean }) {
  const visibleCoins = value;
  const step = compact ? 0.052 : 0.09;
  return (
    <group>
      <RoundedBox args={[0.92, 0.12, 0.92]} radius={0.06} smoothness={3} position={[0, 0.05, 0]} castShadow>
        <meshStandardMaterial color="#E8E9E4" roughness={0.5} metalness={0.08} />
      </RoundedBox>
      <Instances limit={visibleCoins} range={visibleCoins} castShadow>
        <cylinderGeometry args={[0.34, 0.34, 0.08, 18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} roughness={0.38} metalness={0.18} />
        {Array.from({ length: visibleCoins }, (_, index) => <Instance key={index} position={[0, 0.15 + index * step, 0]} />)}
      </Instances>
      {showLabel && <Html pointerEvents="none" center position={[0, 0.72 + visibleCoins * step, 0]} distanceFactor={8}>
        <span className="machine-value-label"><b>{value}</b><small>{label}</small></span>
      </Html>}
    </group>
  );
}

function SummingCounterPress({ pressure }: { pressure: boolean }) {
  const sourceA = useRef<THREE.Group>(null);
  const sourceB = useRef<THREE.Group>(null);
  const partial = useRef<THREE.Group>(null);
  const queryPartial = useRef<THREE.Group>(null);
  const queryRecent = useRef<THREE.Group>(null);
  const result = useRef<THREE.Group>(null);
  const press = useRef<THREE.Group>(null);
  const readGate = useRef<THREE.Group>(null);
  const status = useRef<HTMLElement>(null);
  const previousStage = useRef("");
  const getTime = useMachineTime();
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);

  useEffect(() => {
    document.documentElement.dataset.summingContract = "partial-storage-exact-read";
    return () => {
      delete document.documentElement.dataset.summingContract;
      delete document.documentElement.dataset.summingPhase;
      delete document.documentElement.dataset.summingStoredRows;
      delete document.documentElement.dataset.summingExactTotal;
    };
  }, []);

  useFrame(() => {
    const frame = summingMergeFrame(getTime(), reducedMotion);
    document.documentElement.dataset.summingStoredRows = String(frame.storedRows);
    document.documentElement.dataset.summingExactTotal = "16";

    const moveSource = (source: THREE.Group | null, sourceZ: number) => {
      if (!source) return;
      source.position.set(
        THREE.MathUtils.lerp(-3.35, -1.35, frame.mergeProgress),
        0.72 + Math.sin(frame.mergeProgress * Math.PI) * 0.24,
        THREE.MathUtils.lerp(sourceZ, -0.58, frame.mergeProgress),
      );
      source.scale.setScalar(THREE.MathUtils.lerp(1, 0.72, frame.partialProgress));
      source.visible = frame.sourceOpacity > 0.2;
    };
    moveSource(sourceA.current, -1.25);
    moveSource(sourceB.current, -0.08);

    if (press.current) press.current.position.y = 3.18 - frame.mergeProgress * 1.36 + frame.partialProgress * 1.36;
    if (partial.current) {
      partial.current.visible = frame.partialProgress > 0.01;
      partial.current.scale.setScalar(0.68 + frame.partialProgress * 0.32);
      partial.current.position.x = THREE.MathUtils.lerp(-0.65, 0.2, frame.partialProgress);
    }

    const moveReadToken = (token: THREE.Group | null, from: readonly [number, number, number]) => {
      if (!token) return;
      token.visible = frame.queryProgress > 0.01 && frame.resultProgress < 0.98;
      token.position.set(
        THREE.MathUtils.lerp(from[0], 2.25, frame.queryProgress),
        THREE.MathUtils.lerp(from[1], 0.72, frame.queryProgress) + Math.sin(frame.queryProgress * Math.PI) * 0.28,
        THREE.MathUtils.lerp(from[2], 0.42, frame.queryProgress),
      );
      token.scale.setScalar(0.52 + frame.queryProgress * 0.18);
    };
    moveReadToken(queryPartial.current, [0.2, 0.72, -0.72]);
    moveReadToken(queryRecent.current, [0.2, 0.72, 1.15]);

    if (readGate.current) readGate.current.rotation.y = frame.queryProgress * Math.PI * 1.5;
    if (result.current) {
      result.current.visible = frame.resultProgress > 0.01;
      result.current.position.x = 3.08 + frame.resultProgress * 0.35;
      result.current.scale.setScalar(0.72 + frame.resultProgress * 0.28);
    }

    if (previousStage.current !== frame.stage) {
      previousStage.current = frame.stage;
      document.documentElement.dataset.summingPhase = frame.stage;
      if (status.current) status.current.textContent = ({
        unmerged: "Three equal-key rows exist in separate parts",
        compact: "Background merge combines Part A + Part B",
        partial: "Storage now holds 12 and 4—not one final total",
        aggregate: "Exact read aggregates every visible acct-7 row",
        exact: "SUM + GROUP BY returns 16 before or after more merges",
      } as const)[frame.stage];
    }
  });

  return (
    <group position={[0.15, 0.58, 0]}>
      <MachinePlate position={[0, 0.14, 0]} size={[9.35, 0.22, 4.85]} color="#D5D6D3" />
      <Line points={[[ -4.05, 0.25, -1.7], [0.7, 0.25, -1.7]]} color="#A9AEAB" lineWidth={3} dashed dashSize={0.18} gapSize={0.12} />
      <Line points={[[0.75, 0.25, 1.72], [4.15, 0.25, 1.72]]} color={COLORS.cyan} lineWidth={3} dashed dashSize={0.18} gapSize={0.12} />

      <group ref={sourceA} position={[-3.35, 0.72, -1.25]}><CounterStack value={5} label="PART A · acct-7 · +5" color={COLORS.cyan} /></group>
      <group ref={sourceB} position={[-3.35, 0.72, -0.08]}><CounterStack value={7} label="PART B · acct-7 · +7" color="#F0A43A" /></group>

      <group position={[-1.35, 0.1, -0.58]}>
        <RoundedBox args={[1.65, 0.16, 1.65]} radius={0.08} smoothness={3} position={[0, 0.12, 0]} receiveShadow>
          <meshStandardMaterial color="#ECEDE8" roughness={0.62} metalness={0.08} />
        </RoundedBox>
        <group ref={press} position={[0, 3.18, 0]}>
          <RoundedBox args={[1.5, 0.55, 1.5]} radius={0.12} smoothness={3} castShadow>
            <meshStandardMaterial color={pressure ? COLORS.pressure : "#15171A"} roughness={0.26} metalness={0.55} />
          </RoundedBox>
          <mesh position={[0, 0.7, 0]}><boxGeometry args={[0.18, 1.18, 0.18]} /><meshStandardMaterial color="#15171A" metalness={0.58} roughness={0.22} /></mesh>
        </group>
        <Html pointerEvents="none" center position={[0, 0.5, -1.12]} distanceFactor={9}><span className="machine-stage-label">BACKGROUND MERGE</span></Html>
      </group>

      <group ref={partial} position={[0.2, 0.72, -0.72]} visible={false}><CounterStack value={12} label="STORED PARTIAL · acct-7" color={COLORS.yellow} compact /></group>
      <group position={[0.2, 0.72, 1.15]}><CounterStack value={4} label="RECENT PART · acct-7 · +4" color={COLORS.cyan} /></group>

      <Line points={[[0.55, 0.4, -0.72], [2.25, 0.4, 0.42]]} color={COLORS.yellow} lineWidth={4} />
      <Line points={[[0.55, 0.4, 1.15], [2.25, 0.4, 0.42]]} color={COLORS.cyan} lineWidth={4} />
      <group ref={queryPartial} visible={false}><CounterStack value={12} label="12" color={COLORS.yellow} compact showLabel={false} /></group>
      <group ref={queryRecent} visible={false}><CounterStack value={4} label="+4" color={COLORS.cyan} compact showLabel={false} /></group>

      <group ref={readGate} position={[2.25, 1.03, 0.42]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.67, 0.16, 12, 32]} /><meshStandardMaterial color="#15171A" roughness={0.26} metalness={0.56} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, Math.PI / 2]}><boxGeometry args={[1.32, 0.12, 0.16]} /><meshStandardMaterial color={COLORS.yellow} emissive={COLORS.yellow} emissiveIntensity={0.3} /></mesh>
        <Html pointerEvents="none" center position={[0, 1.18, 0]} distanceFactor={9}><span className="machine-stage-label">SUM + GROUP BY</span></Html>
      </group>
      <group ref={result} position={[3.08, 0.72, 0.42]} visible={false}><CounterStack value={16} label="EXACT TOTAL · acct-7" color={COLORS.yellow} compact /></group>

      <Html pointerEvents="none" center position={[-2.75, 0.45, -2.03]} distanceFactor={9}><span className="summing-lane-label">STORAGE · BACKGROUND</span></Html>
      <Html pointerEvents="none" center position={[2.65, 0.45, 2.03]} distanceFactor={9}><span className="summing-lane-label" data-tone="read">READ · EXACT NOW</span></Html>
      <Html pointerEvents="none" center position={[0, 4.72, 0]} distanceFactor={9}>
        <div className="family-machine-label family-machine-label--summing"><span>SUMMINGMERGETREE · ONE SORTING KEY</span><strong ref={status}>Three equal-key rows exist in separate parts</strong></div>
      </Html>
    </group>
  );
}

function AggregateStateCapsule({ sum, count, label, showLabel = true }: { sum: number; count: number; label: string; showLabel?: boolean }) {
  const sumHeight = 0.24 + sum / 110 * 0.72;
  return (
    <group>
      <RoundedBox args={[1.38, 1.42, 1.02]} radius={0.2} smoothness={5} castShadow>
        <meshPhysicalMaterial color="#E5E0F3" transparent opacity={0.55} transmission={0.18} depthWrite={false} roughness={0.18} metalness={0.04} />
      </RoundedBox>
      <RoundedBox args={[0.34, sumHeight, 0.42]} radius={0.08} smoothness={3} position={[-0.29, -0.5 + sumHeight / 2, 0]}>
        <meshStandardMaterial color="#A48AE3" emissive="#A48AE3" emissiveIntensity={0.28} roughness={0.32} />
      </RoundedBox>
      <Instances limit={count} range={count} castShadow>
        <sphereGeometry args={[0.105, 12, 8]} />
        <meshStandardMaterial color={COLORS.cyan} emissive={COLORS.cyan} emissiveIntensity={0.3} roughness={0.3} />
        {Array.from({ length: count }, (_, index) => <Instance key={index} position={[0.3 + (index % 2) * 0.23 - 0.1, -0.42 + Math.floor(index / 2) * 0.27, 0]} />)}
      </Instances>
      {showLabel && <Html pointerEvents="none" center position={[0, 1.08, 0]} distanceFactor={8}>
        <span className="machine-value-label"><b>Σ{sum} · n{count}</b><small>{label}</small></span>
      </Html>}
    </group>
  );
}

function AggregateStateRefinery({ pressure }: { pressure: boolean }) {
  const sourceA = useRef<THREE.Group>(null);
  const sourceB = useRef<THREE.Group>(null);
  const merged = useRef<THREE.Group>(null);
  const queryState = useRef<THREE.Group>(null);
  const result = useRef<THREE.Group>(null);
  const reactor = useRef<THREE.Group>(null);
  const finalizer = useRef<THREE.Group>(null);
  const status = useRef<HTMLElement>(null);
  const previousStage = useRef("");
  const getTime = useMachineTime();
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);

  useEffect(() => {
    document.documentElement.dataset.aggregatingContract = "state-merge-finalize";
    return () => {
      delete document.documentElement.dataset.aggregatingContract;
      delete document.documentElement.dataset.aggregatingPhase;
      delete document.documentElement.dataset.aggregatingFinalValue;
    };
  }, []);

  useFrame(() => {
    const frame = aggregatingStateFrame(getTime(), reducedMotion);
    document.documentElement.dataset.aggregatingFinalValue = "22";

    const moveSource = (source: THREE.Group | null, sourceZ: number) => {
      if (!source) return;
      source.position.set(
        THREE.MathUtils.lerp(-3.35, -1.25, frame.mergeProgress),
        0.92 + Math.sin(frame.mergeProgress * Math.PI) * 0.3,
        THREE.MathUtils.lerp(sourceZ, 0, frame.mergeProgress),
      );
      source.scale.setScalar(THREE.MathUtils.lerp(1, 0.72, frame.combinedProgress));
      source.visible = frame.sourceOpacity > 0.2;
    };
    moveSource(sourceA.current, -1.05);
    moveSource(sourceB.current, 1.05);

    if (reactor.current) reactor.current.rotation.y = frame.mergeProgress * Math.PI * 2.2;
    if (merged.current) {
      merged.current.visible = frame.combinedProgress > 0.01;
      merged.current.position.x = THREE.MathUtils.lerp(-0.45, 0.65, frame.combinedProgress);
      merged.current.scale.setScalar(0.68 + frame.combinedProgress * 0.32);
    }
    if (queryState.current) {
      queryState.current.visible = frame.finalizeProgress > 0.01 && frame.resultProgress < 0.98;
      queryState.current.position.set(
        THREE.MathUtils.lerp(0.65, 2.28, frame.finalizeProgress),
        0.92 + Math.sin(frame.finalizeProgress * Math.PI) * 0.3,
        0,
      );
      queryState.current.scale.setScalar(0.68);
    }
    if (finalizer.current) finalizer.current.rotation.z = frame.finalizeProgress * Math.PI * 1.6;
    if (result.current) {
      result.current.visible = frame.resultProgress > 0.01;
      result.current.position.x = 3.15 + frame.resultProgress * 0.3;
      result.current.scale.setScalar(0.72 + frame.resultProgress * 0.28);
    }

    if (previousStage.current !== frame.stage) {
      previousStage.current = frame.stage;
      document.documentElement.dataset.aggregatingPhase = frame.stage;
      if (status.current) status.current.textContent = ({
        states: "Two avgState capsules keep sum and count",
        merge: "Background merge combines states—not scalar averages",
        combined: "Storage retains one mergeable state: Σ110 · n5",
        finalize: "avgMerge reads and finalizes the stored state",
        result: "The exact scalar is 110 ÷ 5 = 22",
      } as const)[frame.stage];
    }
  });

  return (
    <group position={[0.2, 0.68, 0]}>
      <MachinePlate position={[0, 0.16, 0]} size={[9.2, 0.22, 4.65]} color="#D5D6D3" />
      <Line points={[[ -4, .42, -1.05], [-1.22, .42, 0]]} color="#A48AE3" lineWidth={4} />
      <Line points={[[ -4, .42, 1.05], [-1.22, .42, 0]]} color={COLORS.cyan} lineWidth={4} />
      <group ref={sourceA} position={[-3.35, 0.92, -1.05]}><AggregateStateCapsule sum={20} count={2} label="PART A · avgState" /></group>
      <group ref={sourceB} position={[-3.35, 0.92, 1.05]}><AggregateStateCapsule sum={90} count={3} label="PART B · avgState" /></group>

      <group ref={reactor} position={[-0.75, 1.2, 0]}>
        <mesh castShadow><cylinderGeometry args={[1.02, 1.02, 1.25, 24]} /><meshStandardMaterial color={pressure ? COLORS.pressure : "#15171A"} roughness={0.24} metalness={0.58} /></mesh>
        {Array.from({ length: 8 }, (_, index) => { const angle = index / 8 * Math.PI * 2; return <mesh key={index} position={[Math.cos(angle) * 1.06, 0, Math.sin(angle) * 1.06]}><boxGeometry args={[0.13, 1.42, 0.13]} /><meshStandardMaterial color={index % 2 ? COLORS.cyan : "#A48AE3"} emissive={index % 2 ? COLORS.cyan : "#A48AE3"} emissiveIntensity={0.24} /></mesh>; })}
        <Html pointerEvents="none" center position={[0, 1.38, 0]} distanceFactor={9}><span className="machine-stage-label">STATE MERGE</span></Html>
      </group>

      <group ref={merged} position={[0.65, 0.92, 0]} visible={false}><AggregateStateCapsule sum={110} count={5} label="MERGED avgState" /></group>
      <Line points={[[0.9, 0.44, 0], [3.72, 0.44, 0]]} color="#15171A" lineWidth={5} />
      <group ref={queryState} visible={false}><AggregateStateCapsule sum={110} count={5} label="avgState" showLabel={false} /></group>

      <group ref={finalizer} position={[2.28, 1.02, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.72, 0.17, 12, 32]} /><meshStandardMaterial color="#15171A" roughness={0.24} metalness={0.58} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.44, 0.075, 10, 28]} /><meshStandardMaterial color={COLORS.yellow} emissive={COLORS.yellow} emissiveIntensity={0.34} /></mesh>
        <Html pointerEvents="none" center position={[0, 1.22, 0]} distanceFactor={9}><span className="machine-stage-label">avgMerge + GROUP BY</span></Html>
      </group>

      <group ref={result} position={[3.15, 0.96, 0]} visible={false}><MachineValue position={[0, 0, 0]} value="22" detail="FINAL SCALAR" color={COLORS.yellow} /></group>
      <Html pointerEvents="none" center position={[-2.6, 0.42, -1.95]} distanceFactor={9}><span className="summing-lane-label" data-tone="state">STORE · MERGEABLE STATE</span></Html>
      <Html pointerEvents="none" center position={[2.8, 0.42, 1.95]} distanceFactor={9}><span className="summing-lane-label" data-tone="read">READ · FINALIZE SCALAR</span></Html>
      <Html pointerEvents="none" center position={[0, 4.72, 0]} distanceFactor={9}>
        <div className="family-machine-label family-machine-label--aggregating"><span>AGGREGATINGMERGETREE · avgState EXAMPLE</span><strong ref={status}>Two avgState capsules keep sum and count</strong></div>
      </Html>
    </group>
  );
}

function CollapsingHistoryRow({ sign, views, duration, label, color, showLabel = true, version }: { sign: 1 | -1; views: number; duration: number; label: string; color: string; showLabel?: boolean; version?: number }) {
  return (
    <group>
      <RoundedBox args={[1.48, 0.78, 1.02]} radius={0.13} smoothness={4} castShadow>
        <meshStandardMaterial color="#E4E8E6" roughness={0.38} metalness={0.12} />
      </RoundedBox>
      <mesh position={[-0.52, 0, 0.52]}><boxGeometry args={[0.16, 0.52, 0.1]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.28} /></mesh>
      <mesh position={[-0.16, -0.05, 0.53]}><boxGeometry args={[0.2, 0.34 + views * 0.025, 0.08]} /><meshStandardMaterial color={COLORS.cyan} roughness={0.34} /></mesh>
      <mesh position={[0.24, -0.05, 0.53]}><boxGeometry args={[0.2, 0.26 + duration / 900, 0.08]} /><meshStandardMaterial color="#A48AE3" roughness={0.34} /></mesh>
      <mesh position={[0.56, 0, 0.53]}><boxGeometry args={[0.14, 0.48, 0.08]} /><meshStandardMaterial color={sign === 1 ? COLORS.yellow : COLORS.pressure} emissive={sign === 1 ? COLORS.yellow : COLORS.pressure} emissiveIntensity={0.28} /></mesh>
      {version !== undefined && <mesh position={[0, -0.34, 0.54]}><boxGeometry args={[1.08, 0.1, 0.07]} /><meshStandardMaterial color={version === 1 ? "#A48AE3" : COLORS.yellow} emissive={version === 1 ? "#A48AE3" : COLORS.yellow} emissiveIntensity={0.28} /></mesh>}
      {showLabel && <Html pointerEvents="none" center position={[0, 0.82, 0]} distanceFactor={8}>
        <span className="machine-value-label"><b>{version !== undefined ? `v${version} · ` : ""}{sign === 1 ? "+1" : "−1"} · {views} views</b><small>{label} · {duration}s</small></span>
      </Html>}
    </group>
  );
}

function CollapsingPolarityGate({ pressure }: { pressure: boolean }) {
  const oldState = useRef<THREE.Group>(null);
  const cancelState = useRef<THREE.Group>(null);
  const replacement = useRef<THREE.Group>(null);
  const readOld = useRef<THREE.Group>(null);
  const readCancel = useRef<THREE.Group>(null);
  const readNew = useRef<THREE.Group>(null);
  const collapseGate = useRef<THREE.Group>(null);
  const readGate = useRef<THREE.Group>(null);
  const result = useRef<THREE.Group>(null);
  const status = useRef<HTMLElement>(null);
  const previousStage = useRef("");
  const getTime = useMachineTime();
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);

  useEffect(() => {
    document.documentElement.dataset.collapsingContract = "matched-pair-sign-aware-read";
    return () => {
      delete document.documentElement.dataset.collapsingContract;
      delete document.documentElement.dataset.collapsingPhase;
      delete document.documentElement.dataset.collapsingSurvivor;
    };
  }, []);

  useFrame(() => {
    const frame = collapsingHistoryFrame(getTime(), reducedMotion);
    document.documentElement.dataset.collapsingSurvivor = "6-views-185-seconds";

    const movePair = (row: THREE.Group | null, sourceZ: number, targetZ: number) => {
      if (!row) return;
      row.position.set(
        THREE.MathUtils.lerp(-3.5, -1.05, frame.pairProgress),
        THREE.MathUtils.lerp(0.82, 0.18, frame.collapseProgress) + Math.sin(frame.pairProgress * Math.PI) * 0.24,
        THREE.MathUtils.lerp(sourceZ, targetZ, frame.pairProgress),
      );
      row.scale.setScalar(THREE.MathUtils.lerp(1, 0.62, frame.collapseProgress));
      row.visible = frame.pairOpacity > 0.2;
    };
    movePair(oldState.current, -1.12, -0.32);
    movePair(cancelState.current, 0, 0.32);

    if (collapseGate.current) collapseGate.current.rotation.y = frame.pairProgress * Math.PI * 1.6;
    if (replacement.current) {
      replacement.current.visible = frame.readProgress <= 0.01;
      replacement.current.position.set(
        THREE.MathUtils.lerp(-3.5, 0.48, frame.survivorProgress),
        0.82 + Math.sin(frame.survivorProgress * Math.PI) * 0.24,
        THREE.MathUtils.lerp(1.12, 0, frame.survivorProgress),
      );
    }

    const moveReadRow = (row: THREE.Group | null, sourceZ: number, delay: number) => {
      if (!row) return;
      const progress = THREE.MathUtils.clamp((frame.readProgress - delay) / (1 - delay), 0, 1);
      row.visible = frame.readProgress > delay && frame.resultProgress < 0.98;
      row.position.set(
        THREE.MathUtils.lerp(0.48, 2.18, progress),
        0.8 + Math.sin(progress * Math.PI) * 0.3,
        THREE.MathUtils.lerp(sourceZ, 0, progress),
      );
      row.scale.setScalar(0.62);
    };
    moveReadRow(readOld.current, -0.9, 0);
    moveReadRow(readCancel.current, 0, 0.08);
    moveReadRow(readNew.current, 0.9, 0.16);

    if (readGate.current) readGate.current.rotation.z = frame.readProgress * Math.PI * 1.4;
    if (result.current) {
      result.current.visible = frame.resultProgress > 0.01;
      result.current.position.x = 3.12 + frame.resultProgress * 0.34;
      result.current.scale.setScalar(0.72 + frame.resultProgress * 0.28);
    }

    if (previousStage.current !== frame.stage) {
      previousStage.current = frame.stage;
      document.documentElement.dataset.collapsingPhase = frame.stage;
      if (status.current) status.current.textContent = ({
        history: "Old state, exact cancel, and replacement coexist",
        pair: "Match equal sorting-key fields with opposite Sign",
        collapse: "A later merge removes the old +1 and its −1 copy",
        survivor: "The replacement +1 remains the current state",
        exact: "Sign-aware aggregation returns 6 views and 185 seconds",
      } as const)[frame.stage];
    }
  });

  return (
    <group position={[0.2, 0.68, 0]}>
      <MachinePlate position={[0, 0.16, 0]} size={[9.45, 0.22, 4.85]} color="#D5D6D3" />
      <Line points={[[ -4.05, .38, -1.12], [-0.82, .38, -0.32]]} color={COLORS.cyan} lineWidth={4} />
      <Line points={[[ -4.05, .38, 0], [-0.82, .38, 0.32]]} color={COLORS.pressure} lineWidth={4} />
      <Line points={[[ -4.05, .38, 1.12], [0.7, .38, 0]]} color={COLORS.yellow} lineWidth={4} />
      <group ref={oldState} position={[-3.5, 0.82, -1.12]}><CollapsingHistoryRow sign={1} views={5} duration={146} label="OLD STATE" color={COLORS.cyan} /></group>
      <group ref={cancelState} position={[-3.5, 0.82, 0]}><CollapsingHistoryRow sign={-1} views={5} duration={146} label="EXACT CANCEL COPY" color={COLORS.pressure} /></group>
      <group ref={replacement} position={[-3.5, 0.82, 1.12]}><CollapsingHistoryRow sign={1} views={6} duration={185} label="REPLACEMENT" color={COLORS.yellow} /></group>

      <group ref={collapseGate} position={[-0.82, 1.08, 0]}>
        <RoundedBox args={[0.58, 2.18, 1.72]} radius={0.12} smoothness={4} castShadow><meshStandardMaterial color="#15171A" roughness={0.25} metalness={0.58} /></RoundedBox>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.54, 0.12, 10, 30]} /><meshStandardMaterial color={pressure ? COLORS.pressure : COLORS.yellow} emissive={pressure ? COLORS.pressure : COLORS.yellow} emissiveIntensity={0.35} /></mesh>
        <Html pointerEvents="none" center position={[0, 1.45, 0]} distanceFactor={9}><span className="machine-stage-label">MATCHED PAIR</span></Html>
      </group>
      <RoundedBox args={[1.65, 0.13, 1.52]} radius={0.06} smoothness={3} position={[-0.82, 0.18, 0]}>
        <meshStandardMaterial color="#4B4E4C" roughness={0.48} metalness={0.3} />
      </RoundedBox>
      <Html pointerEvents="none" center position={[-0.82, 0.36, -1.15]} distanceFactor={9}><span className="summing-lane-label" data-tone="cancel">OLD + CANCEL · COLLAPSE LATER</span></Html>

      <Line points={[[0.48, .38, 0], [3.76, .38, 0]]} color="#15171A" lineWidth={5} />
      <group ref={readOld} visible={false}><CollapsingHistoryRow sign={1} views={5} duration={146} label="OLD" color={COLORS.cyan} showLabel={false} /></group>
      <group ref={readCancel} visible={false}><CollapsingHistoryRow sign={-1} views={5} duration={146} label="CANCEL" color={COLORS.pressure} showLabel={false} /></group>
      <group ref={readNew} visible={false}><CollapsingHistoryRow sign={1} views={6} duration={185} label="NEW" color={COLORS.yellow} showLabel={false} /></group>
      <group ref={readGate} position={[2.18, 1.02, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.72, 0.17, 12, 32]} /><meshStandardMaterial color="#15171A" roughness={0.24} metalness={0.58} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.43, 0.075, 10, 28]} /><meshStandardMaterial color={COLORS.cyan} emissive={COLORS.cyan} emissiveIntensity={0.34} /></mesh>
        <Html pointerEvents="none" center position={[0, 1.22, 0]} distanceFactor={9}><span className="machine-stage-label">SUM(metric × Sign)</span></Html>
      </group>
      <group ref={result} position={[3.12, 0.9, 0]} visible={false}><MachineValue position={[0, 0, 0]} value="6 views" detail="185s · CURRENT STATE" color={COLORS.yellow} /></group>

      <Html pointerEvents="none" center position={[2.75, 0.42, 1.95]} distanceFactor={9}><span className="summing-lane-label" data-tone="read">READ NOW · SIGN-AWARE</span></Html>
      <Html pointerEvents="none" center position={[0, 4.72, 0]} distanceFactor={9}>
        <div className="family-machine-label family-machine-label--collapsing"><span>COLLAPSINGMERGETREE · ONE VALID HISTORY</span><strong ref={status}>Old state, exact cancel, and replacement coexist</strong></div>
      </Html>
    </group>
  );
}

function VersionedRailway({ pressure }: { pressure: boolean }) {
  const v2State = useRef<THREE.Group>(null);
  const v1Cancel = useRef<THREE.Group>(null);
  const v1State = useRef<THREE.Group>(null);
  const versionGate = useRef<THREE.Group>(null);
  const status = useRef<HTMLElement>(null);
  const previousStage = useRef("");
  const getTime = useMachineTime();
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);

  useEffect(() => {
    document.documentElement.dataset.versionedCollapsingContract = "same-key-version-opposite-sign";
    return () => {
      delete document.documentElement.dataset.versionedCollapsingContract;
      delete document.documentElement.dataset.versionedCollapsingPhase;
      delete document.documentElement.dataset.versionedCollapsingSurvivor;
    };
  }, []);

  useFrame(() => {
    const frame = versionedCollapseFrame(getTime(), reducedMotion);
    document.documentElement.dataset.versionedCollapsingSurvivor = "v2-sign-plus-one";

    const arrival = (delay: number) => THREE.MathUtils.clamp((frame.arrivalProgress - delay) / (1 - delay), 0, 1);
    const moveV1 = (row: THREE.Group | null, sourceZ: number, laneOffset: number, delay: number) => {
      if (!row) return;
      const queueX = THREE.MathUtils.lerp(-4.18, -2.65, arrival(delay));
      row.position.set(
        THREE.MathUtils.lerp(queueX, -0.35, frame.routeProgress),
        THREE.MathUtils.lerp(0.86, 0.18, frame.collapseProgress) + Math.sin(frame.routeProgress * Math.PI) * 0.28,
        THREE.MathUtils.lerp(sourceZ, THREE.MathUtils.lerp(laneOffset, 0, frame.matchProgress), frame.routeProgress),
      );
      row.scale.setScalar(THREE.MathUtils.lerp(1, 0.62, frame.collapseProgress));
      row.visible = frame.pairOpacity > 0.2;
    };
    moveV1(v1Cancel.current, 0, -0.28, 0.18);
    moveV1(v1State.current, 1.12, 0.28, 0.36);

    if (v2State.current) {
      const queueX = THREE.MathUtils.lerp(-4.18, -2.65, arrival(0));
      const routedX = THREE.MathUtils.lerp(queueX, 0.55, frame.routeProgress);
      v2State.current.position.set(
        THREE.MathUtils.lerp(routedX, 3.22, frame.survivorProgress),
        0.86 + Math.sin(Math.max(frame.routeProgress, frame.survivorProgress) * Math.PI) * 0.26,
        THREE.MathUtils.lerp(-1.12, 0.92, frame.routeProgress),
      );
      v2State.current.scale.setScalar(0.92 + frame.survivorProgress * 0.08);
    }
    if (versionGate.current) versionGate.current.rotation.y = frame.routeProgress * Math.PI * 1.7;

    if (previousStage.current !== frame.stage) {
      previousStage.current = frame.stage;
      document.documentElement.dataset.versionedCollapsingPhase = frame.stage;
      if (status.current) status.current.textContent = ({
        arrive: "v2 arrives before the older v1 pair",
        route: "Version routes rows; arrival order does not choose the pair",
        match: "Only v1 +1 and v1 −1 share key + version",
        collapse: "The matched v1 pair collapses during a later merge",
        survive: "v2 +1 survives as the current state",
      } as const)[frame.stage];
    }
  });
  return (
    <group position={[0.2, 0.68, 0]}>
      <MachinePlate position={[0, 0.16, 0]} size={[9.55, 0.22, 4.85]} color="#D5D6D3" />
      <Line points={[[ -4.15, .38, -0.88], [3.75, .38, -0.88]]} color="#A48AE3" lineWidth={5} />
      <Line points={[[ -4.15, .38, 0.92], [3.75, .38, 0.92]]} color={COLORS.yellow} lineWidth={5} />
      <Html pointerEvents="none" center position={[-2.9, 0.38, -1.55]} distanceFactor={9}><span className="summing-lane-label" data-tone="state">VERSION 1 · PAIR LANE</span></Html>
      <Html pointerEvents="none" center position={[2.8, 0.38, 1.58]} distanceFactor={9}><span className="summing-lane-label">VERSION 2 · SURVIVOR LANE</span></Html>

      <group ref={v2State} position={[-4.18, 0.86, -1.12]}><CollapsingHistoryRow sign={1} version={2} views={6} duration={185} label="ARRIVES FIRST" color={COLORS.yellow} /></group>
      <group ref={v1Cancel} position={[-4.18, 0.86, 0]}><CollapsingHistoryRow sign={-1} version={1} views={5} duration={146} label="ARRIVES SECOND" color={COLORS.pressure} /></group>
      <group ref={v1State} position={[-4.18, 0.86, 1.12]}><CollapsingHistoryRow sign={1} version={1} views={5} duration={146} label="ARRIVES LAST" color={COLORS.cyan} /></group>

      <group ref={versionGate} position={[-1.38, 1.1, 0]}>
        <RoundedBox args={[0.62, 2.32, 2.92]} radius={0.12} smoothness={4} castShadow><meshStandardMaterial color={pressure ? COLORS.pressure : "#15171A"} roughness={0.25} metalness={0.58} /></RoundedBox>
        <mesh position={[0.34, 0, -0.76]}><boxGeometry args={[0.12, 1.62, 0.72]} /><meshStandardMaterial color="#A48AE3" emissive="#A48AE3" emissiveIntensity={0.3} /></mesh>
        <mesh position={[0.34, 0, 0.82]}><boxGeometry args={[0.12, 1.62, 0.72]} /><meshStandardMaterial color={COLORS.yellow} emissive={COLORS.yellow} emissiveIntensity={0.3} /></mesh>
        <Html pointerEvents="none" center position={[0, 1.55, 0]} distanceFactor={9}><span className="machine-stage-label">ROUTE BY VERSION</span></Html>
      </group>

      <group position={[-0.35, 0.18, -0.88]}>
        <RoundedBox args={[1.72, 0.13, 1.42]} radius={0.06} smoothness={3}><meshStandardMaterial color="#4B4E4C" roughness={0.48} metalness={0.3} /></RoundedBox>
        <Html pointerEvents="none" center position={[0, 0.28, -0.95]} distanceFactor={9}><span className="summing-lane-label" data-tone="cancel">v1 +1 / −1 · COLLAPSE</span></Html>
      </group>
      <Html pointerEvents="none" center position={[3.22, 2.28, 0.92]} distanceFactor={9}><span className="machine-stage-label">CURRENT · v2 +1</span></Html>

      <Html pointerEvents="none" center position={[0, 4.72, 0]} distanceFactor={9}>
        <div className="family-machine-label family-machine-label--versioned"><span>VERSIONEDCOLLAPSINGMERGETREE · OUT-OF-ORDER INPUT</span><strong ref={status}>v2 arrives before the older v1 pair</strong></div>
      </Html>
    </group>
  );
}

function MergeFamilyMachine({ family, strategy, pressure, mobile, exploded, scenario }: {
  family: MergeFamilyId;
  strategy: LatestReadStrategy;
  pressure: boolean;
  mobile: boolean;
  exploded: boolean;
  scenario: ScenarioMode;
}) {
  if (exploded || family === "merge") return <BlockFoundryMachine exploded={exploded} mobile={mobile} pressure={pressure} scenario={scenario} />;
  if (family === "replacing") return <ReplacingMachine strategy={strategy} pressure={pressure} />;
  if (family === "coalescing") return <CoalescingMosaicMachine pressure={pressure} strategy={strategy} />;
  if (family === "summing") return <SummingCounterPress pressure={pressure} />;
  if (family === "aggregating") return <AggregateStateRefinery pressure={pressure} />;
  if (family === "collapsing") return <CollapsingPolarityGate pressure={pressure} />;
  return <VersionedRailway pressure={pressure} />;
}

function MechanismTitle({ id, eyebrow }: { id: MechanismId; eyebrow: string }) {
  const mechanism = mechanismById(id)!;
  return (
    <Html pointerEvents="none" center position={[0, 5.05, 0]} distanceFactor={9}>
      <div className="mechanism-machine-title"><span>{eyebrow}</span><strong>{mechanism.title}</strong><small>{mechanism.tagline}</small></div>
    </Html>
  );
}

function IngestionManifold({ id, pressure }: { id: MechanismId; pressure: boolean }) {
  const packets = useRef<THREE.InstancedMesh>(null);
  const flushGate = useRef<THREE.Group>(null);
  const helper = useRef(new THREE.Object3D());
  const getTime = useMachineTime();
  useFrame(() => {
    const time = getTime() * (pressure ? 1.6 : 0.78);
    if (packets.current) {
      for (let index = 0; index < 18; index += 1) {
        const progress = ((time + index / 18) % 1 + 1) % 1;
        helper.current.position.set(-4.1 + progress * 7.6, 0.62 + Math.sin(progress * Math.PI) * 0.18, index % 2 ? -0.32 : 0.32);
        helper.current.rotation.set(0, 0, 0);
        helper.current.scale.setScalar(0.8 + (index % 4) * 0.07);
        helper.current.updateMatrix();
        packets.current.setMatrixAt(index, helper.current.matrix);
      }
      packets.current.instanceMatrix.needsUpdate = true;
    }
    if (flushGate.current) flushGate.current.rotation.z = Math.sin(time * 0.65) * 0.08;
  });
  const activeColor = (mechanism: MechanismId) => id === mechanism ? COLORS.yellow : "#6C7270";
  return (
    <group position={[0.25, 0.65, 0]}>
      <MachinePlate position={[0, 0.15, 0]} size={[9.1, 0.22, 4.4]} color="#D5D6D3" />
      <mesh position={[-3.55, 2.45, 0]} castShadow><cylinderGeometry args={[1.2, 0.48, 2.65, 20]} /><meshStandardMaterial color={activeColor("ingestion.client-batching")} roughness={0.32} metalness={0.44} /></mesh>
      <Html pointerEvents="none" center position={[-3.55, 4.15, 0]} distanceFactor={9}><span className="machine-stage-label">BATCH HOPPER</span></Html>
      <RoundedBox args={[2.2, 2.45, 2.4]} radius={0.2} smoothness={4} position={[-0.95, 1.55, 0]} castShadow>
        <meshPhysicalMaterial color={activeColor("ingestion.async-buffer")} transparent opacity={0.56} transmission={0.15} roughness={0.2} metalness={0.08} />
      </RoundedBox>
      <DataBars count={28} spread={[1.45, 1.4, 1.5]} offset={[-0.95, 0.55, 0]} color={pressure ? COLORS.pressure : COLORS.cyan} />
      <Html pointerEvents="none" center position={[-0.95, 3.35, 0]} distanceFactor={9}><span className="machine-stage-label">ASYNC BUFFER</span></Html>
      <group ref={flushGate} position={[1.05, 1.25, 0]}>
        <RoundedBox args={[0.58, 2.7, 2.65]} radius={0.1} smoothness={3}><meshStandardMaterial color={activeColor("ingestion.backpressure")} roughness={0.25} metalness={0.58} /></RoundedBox>
        <InstrumentGauge position={[0, 1.65, 0]} value={pressure ? 0.96 : 0.46} color={pressure ? COLORS.pressure : COLORS.yellow} label="FLUSH" />
      </group>
      <group position={[2.65, 1.1, 0]}>
        <MachinePlate position={[0, 0, 0]} size={[2.5, 1.65, 2.7]} color={activeColor("ingestion.clickpipes")} />
        {Array.from({ length: 5 }, (_, index) => <mesh key={index} position={[-0.88 + index * 0.44, 1, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.18, 0.18, 2.1, 16]} /><meshStandardMaterial color={index % 2 ? COLORS.cyan : COLORS.yellow} emissive={index % 2 ? COLORS.cyan : COLORS.yellow} emissiveIntensity={0.18} /></mesh>)}
        <Html pointerEvents="none" center position={[0, 2.25, 0]} distanceFactor={9}><span className="machine-stage-label">KAFKA · CLICKPIPES</span></Html>
      </group>
      <instancedMesh ref={packets} args={[undefined, undefined, 18]} castShadow><boxGeometry args={[0.27, 0.18, 0.22]} /><meshStandardMaterial color={id === "ingestion.cdc" ? "#A48AE3" : COLORS.yellow} emissive={id === "ingestion.cdc" ? "#A48AE3" : COLORS.yellow} emissiveIntensity={0.28} roughness={0.38} /></instancedMesh>
      <MechanismTitle id={id} eyebrow="INGESTION MANIFOLD" />
    </group>
  );
}

function QueryScanner({ id, pressure }: { id: MechanismId; pressure: boolean }) {
  const scan = useRef<THREE.Mesh>(null);
  const getTime = useMachineTime();
  const showAvoidedWork = useAtlasStore((state) => state.showSavedWork);
  useFrame(() => {
    if (!scan.current) return;
    scan.current.position.x = -3.55 + ((getTime() * (pressure ? 0.22 : 0.62)) % 1) * 7.1;
  });
  const activeIndex = id === "read.sparse-index" || id === "read.granules";
  const activeColumns = id === "read.column-pruning";
  const activeSkipping = showAvoidedWork || id === "read.data-skipping" || id === "read.saved-work";
  return (
    <group position={[0.2, 0.68, 0]}>
      <MachinePlate position={[0, 0.14, 0]} size={[9.2, 0.22, 4.5]} color="#D5D6D3" />
      <group position={[0, 0.72, 0]}>
        {Array.from({ length: 24 }, (_, index) => {
          const column = index % 8;
          const row = Math.floor(index / 8);
          const skipped = activeSkipping && (column < 3 || column > 5);
          const pruned = activeColumns && row === 2;
          const color = skipped || pruned ? "#BFC2BF" : row === 0 ? COLORS.yellow : row === 1 ? COLORS.cyan : "#A48AE3";
          return <RoundedBox key={index} args={[0.72, 0.74, 0.78]} radius={0.08} smoothness={2} position={[-3.15 + column * 0.9, 0, -0.9 + row * 0.9]} castShadow><meshStandardMaterial color={color} transparent={skipped || pruned} opacity={skipped || pruned ? 0.26 : 1} emissive={color} emissiveIntensity={skipped || pruned ? 0 : 0.08} roughness={0.45} /></RoundedBox>;
        })}
      </group>
      <group position={[0, 2.15, -1.7]}>
        <MachinePlate position={[0, 0, 0]} size={[7.7, 0.28, 0.42]} color={activeIndex ? "#15171A" : "#737875"} />
        {Array.from({ length: 9 }, (_, index) => <mesh key={index} position={[-3.3 + index * 0.82, 0.24, 0]}><boxGeometry args={[0.12, 0.48, 0.52]} /><meshStandardMaterial color={index === 3 || index === 6 ? COLORS.yellow : COLORS.cyan} emissive={index === 3 || index === 6 ? COLORS.yellow : COLORS.cyan} emissiveIntensity={0.24} /></mesh>)}
      </group>
      <mesh ref={scan} position={[-3.55, 1.15, 0]}><boxGeometry args={[0.13, 2.25, 4]} /><meshStandardMaterial color={pressure ? COLORS.pressure : COLORS.cyan} emissive={pressure ? COLORS.pressure : COLORS.cyan} emissiveIntensity={0.55} transparent opacity={0.58} /></mesh>
      <Html pointerEvents="none" center position={[-2.8, 3.25, -1.7]} distanceFactor={9}><span className="machine-stage-label">SPARSE MARKS</span></Html>
      <Html pointerEvents="none" center position={[2.75, 3.25, -1.7]} distanceFactor={9}><span className="machine-stage-label">SKIPPED VS READ</span></Html>
      <MechanismTitle id={id} eyebrow="QUERY SCANNER" />
    </group>
  );
}

function PrecomputeBlock({ color = COLORS.yellow }: { color?: string }) {
  return (
    <group>
      <DataCassette color={color} scale={[1.12, 1.12, 1.08]} />
      <DataBars count={8} spread={[0.72, 0.24, 0.42]} offset={[0, -0.11, 0]} scale={[0.055, 0.14, 0.055]} color="#15171A" />
    </group>
  );
}

function usePrecomputeAnimation(
  mode: PrecomputeVisualMode,
  applyFrame: (frame: PrecomputeSwitchyardFrame) => void,
) {
  const getTime = useMachineTime();
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  useEffect(() => () => {
    if (document.documentElement.dataset.precomputeMode === mode) {
      delete document.documentElement.dataset.precomputeMode;
      delete document.documentElement.dataset.precomputeStage;
    }
  }, [mode]);
  useFrame(() => {
    const frame = precomputeSwitchyardFrame(getTime(), mode, reducedMotion);
    document.documentElement.dataset.precomputeMode = mode;
    document.documentElement.dataset.precomputeStage = frame.stage;
    applyFrame(frame);
  });
}

const PRECOMPUTE_STAGE_COPY = {
  arrive: "ONE INSERTED BLOCK ARRIVES",
  derive: "DERIVED WORK RUNS",
  commit: "DERIVED DATA COMMITS",
  query: "THE READ USES THE READY PATH",
} as const;

function MaterializedViewMachine({ id, pressure }: { id: MechanismId; pressure: boolean }) {
  const inputBlock = useRef<THREE.Group>(null);
  const basePart = useRef<THREE.Group>(null);
  const transformBlock = useRef<THREE.Group>(null);
  const targetPart = useRef<THREE.Group>(null);
  const query = useRef<THREE.Group>(null);
  const result = useRef<THREE.Group>(null);
  const status = useRef<HTMLElement>(null);
  const previousStage = useRef("");
  const aggregateStates = id === "precompute.aggregate-states";

  usePrecomputeAnimation("materialized-view", (frame) => {
    if (inputBlock.current) inputBlock.current.position.x = THREE.MathUtils.lerp(-4.15, -2.62, frame.sourceProgress);
    if (basePart.current) {
      basePart.current.visible = frame.sourceCommitProgress > 0.01;
      basePart.current.scale.setScalar(THREE.MathUtils.lerp(0.04, 1, frame.sourceCommitProgress));
    }
    if (transformBlock.current) {
      transformBlock.current.visible = frame.mvTransformProgress > 0.01 && frame.mvTargetProgress < 0.98;
      const firstLeg = THREE.MathUtils.clamp(frame.mvTransformProgress / 0.58, 0, 1);
      const secondLeg = THREE.MathUtils.clamp((frame.mvTransformProgress - 0.58) / 0.42, 0, 1);
      transformBlock.current.position.set(
        THREE.MathUtils.lerp(-2.45, -0.2, firstLeg) + secondLeg * 0.28,
        0.92 + Math.sin(frame.mvTransformProgress * Math.PI) * 0.72,
        THREE.MathUtils.lerp(0, -1.35, firstLeg),
      );
      transformBlock.current.scale.setScalar(THREE.MathUtils.lerp(0.92, 0.54, secondLeg));
    }
    if (targetPart.current) {
      targetPart.current.visible = frame.mvTargetProgress > 0.01;
      targetPart.current.position.x = THREE.MathUtils.lerp(0.55, 2.72, frame.mvTargetProgress);
      targetPart.current.scale.setScalar(THREE.MathUtils.lerp(0.08, 1, frame.mvTargetProgress));
    }
    if (query.current) {
      query.current.visible = frame.stage === "query";
      query.current.position.x = THREE.MathUtils.lerp(4.05, 2.95, frame.resultProgress);
    }
    if (result.current) {
      result.current.visible = frame.resultProgress > 0.01;
      result.current.scale.setScalar(THREE.MathUtils.lerp(0.05, 1, frame.resultProgress));
    }
    if (previousStage.current !== frame.stage) {
      previousStage.current = frame.stage;
      if (status.current) status.current.textContent = PRECOMPUTE_STAGE_COPY[frame.stage];
    }
  });

  return (
    <group position={[0, 0.62, 0]}>
      <MachinePlate position={[0, 0.12, 0]} size={[9.6, 0.22, 5.15]} color="#D7D8D5" />
      <Line points={[[ -4.25, 0.54, 0], [-2.3, 0.54, 0]]} color="#15171A" lineWidth={6} />
      <Line points={[[ -2.35, 0.54, 0], [-1.45, 0.54, 1.25]]} color="#777D79" lineWidth={5} />
      <Line points={[[ -2.35, 0.54, 0], [-0.35, 0.82, -1.35], [3.25, 0.82, -1.35]]} color={pressure ? COLORS.pressure : COLORS.yellow} lineWidth={6} />

      <group ref={inputBlock} position={[-4.15, 0.92, 0]}><PrecomputeBlock /></group>
      <Html pointerEvents="none" center position={[-3.65, 1.75, 0]} distanceFactor={9}><span className="precompute-contract-label">INSERTED BLOCK</span></Html>

      <group position={[-1.35, 0.72, 1.25]}>
        <MachinePlate position={[0, 0, 0]} size={[2.45, 0.16, 1.62]} color="#F5F5F1" />
        <group ref={basePart} visible={false} scale={0.04}><FoundryPartArtifact accent="#777D79" /></group>
        <Html pointerEvents="none" center position={[0, 1.2, 0]} distanceFactor={9}><span className="precompute-contract-label" data-tone="neutral">SOURCE TABLE · BASE PART</span></Html>
      </group>

      <group position={[0, 1.45, -1.35]}>
        <RoundedBox args={[1.15, 2.55, 1.58]} radius={0.14} smoothness={4} castShadow>
          <meshStandardMaterial color={pressure ? COLORS.pressure : "#15171A"} roughness={0.24} metalness={0.52} />
        </RoundedBox>
        <DataBars count={12} spread={[0.55, 1.45, 0.74]} offset={[0, -0.45, 0]} color={COLORS.yellow} />
        <Html pointerEvents="none" center position={[0, 1.72, 0]} distanceFactor={9}><span className="precompute-contract-label" data-tone="yellow">MV SELECT · NEW BLOCK ONLY</span></Html>
      </group>
      <group ref={transformBlock} position={[-2.45, 0.92, 0]} visible={false}><PrecomputeBlock color={pressure ? COLORS.pressure : COLORS.yellow} /></group>

      <group position={[2.72, 0.68, -1.35]}>
        <MachinePlate position={[0, 0, 0]} size={[2.8, 0.16, 1.72]} color="#F5F5F1" />
        <group ref={targetPart} position={[0.55, 0.42, 0]} visible={false} scale={0.08}>
          <FoundryPartArtifact accent={pressure ? COLORS.pressure : COLORS.yellow} secondaryAccent={aggregateStates ? COLORS.cyan : undefined} />
        </group>
        <Html pointerEvents="none" center position={[0, 1.38, 0]} distanceFactor={9}><span className="precompute-contract-label" data-tone="yellow">SEPARATE TARGET TABLE</span></Html>
        <Html pointerEvents="none" center position={[0, -0.22, 0]} distanceFactor={9}><span className="precompute-detail-label">{aggregateStates ? "PARTIAL STATES MERGE LATER" : "QUERY THIS TABLE DIRECTLY"}</span></Html>
      </group>

      <group ref={query} position={[4.05, 1.45, -1.35]} visible={false}><PrecomputeBlock color="#15171A" /></group>
      <group ref={result} position={[4.08, 0.88, 0.72]} visible={false} scale={0.05}><MachineValue position={[0, 0, 0]} value="answer" detail="target read" color={COLORS.yellow} /></group>
      <Line points={[[3.95, 1.08, -1.35], [2.95, 1.08, -1.35]]} color="#15171A" lineWidth={3} dashed dashSize={0.12} gapSize={0.08} />

      <Html pointerEvents="none" center position={[0, 4.08, 0]} distanceFactor={9}>
        <div className="precompute-stage-readout" data-contract="materialized-view"><span>INCREMENTAL MATERIALIZED VIEW</span><strong ref={status}>ONE INSERTED BLOCK ARRIVES</strong><small>separate target · explicit reads · explicit backfill</small></div>
      </Html>
    </group>
  );
}

function ProjectionMachine({ pressure }: { id: MechanismId; pressure: boolean }) {
  const inputBlock = useRef<THREE.Group>(null);
  const basePart = useRef<THREE.Group>(null);
  const projectionLayer = useRef<THREE.Group>(null);
  const optimizerArm = useRef<THREE.Group>(null);
  const query = useRef<THREE.Group>(null);
  const result = useRef<THREE.Group>(null);
  const status = useRef<HTMLElement>(null);
  const previousStage = useRef("");

  usePrecomputeAnimation("projection", (frame) => {
    if (inputBlock.current) inputBlock.current.position.x = THREE.MathUtils.lerp(-4.15, -1.95, frame.sourceProgress);
    if (basePart.current) basePart.current.scale.setScalar(THREE.MathUtils.lerp(0.06, 1, frame.sourceCommitProgress));
    if (projectionLayer.current) {
      projectionLayer.current.visible = frame.projectionAttachProgress > 0.01;
      projectionLayer.current.position.y = THREE.MathUtils.lerp(-0.36, 0.28, frame.projectionAttachProgress);
      projectionLayer.current.scale.x = THREE.MathUtils.lerp(0.08, 1, frame.projectionAttachProgress);
    }
    if (optimizerArm.current) optimizerArm.current.rotation.z = THREE.MathUtils.lerp(-0.48, 0.35, frame.optimizerProgress);
    if (query.current) {
      query.current.visible = frame.stage === "query";
      query.current.position.x = THREE.MathUtils.lerp(-4.1, 2.65, frame.optimizerProgress);
      query.current.position.z = THREE.MathUtils.lerp(1.28, 0.3, frame.optimizerProgress);
    }
    if (result.current) {
      result.current.visible = frame.resultProgress > 0.01;
      result.current.scale.setScalar(THREE.MathUtils.lerp(0.05, 1, frame.resultProgress));
    }
    if (previousStage.current !== frame.stage) {
      previousStage.current = frame.stage;
      if (status.current) status.current.textContent = PRECOMPUTE_STAGE_COPY[frame.stage];
    }
  });

  return (
    <group position={[0, 0.62, 0]}>
      <MachinePlate position={[0, 0.12, 0]} size={[9.6, 0.22, 5.15]} color="#D7D8D5" />
      <Line points={[[ -4.3, 0.54, 0], [-1.9, 0.54, 0], [0, 0.54, 0], [3.85, 0.54, 0]]} color="#15171A" lineWidth={6} />
      <group ref={inputBlock} position={[-4.15, 0.92, 0]}><PrecomputeBlock /></group>
      <Html pointerEvents="none" center position={[-3.6, 1.78, 0]} distanceFactor={9}><span className="precompute-contract-label">INSERTED BLOCK</span></Html>

      <group position={[0.25, 1.25, 0]}>
        <RoundedBox args={[4.85, 2.25, 2.35]} radius={0.2} smoothness={5} castShadow>
          <meshStandardMaterial color="#F7F7F3" roughness={0.38} metalness={0.08} />
        </RoundedBox>
        <Line points={[[ -2.18, -0.82, 1.19], [2.18, -0.82, 1.19], [2.18, 0.82, 1.19], [-2.18, 0.82, 1.19], [-2.18, -0.82, 1.19]]} color="#15171A" lineWidth={2.5} />
        <group ref={basePart} position={[0, -0.38, 0]} scale={0.06}>
          <DataBars count={24} spread={[3.55, 0.62, 1.35]} offset={[0, 0, 0]} scale={[0.075, 0.3, 0.075]} color="#777D79" />
        </group>
        <group ref={projectionLayer} position={[0, -0.36, 0]} visible={false}>
          <RoundedBox args={[4.15, 0.34, 1.72]} radius={0.06} smoothness={3} castShadow>
            <meshStandardMaterial color={pressure ? COLORS.pressure : COLORS.cyan} emissive={pressure ? COLORS.pressure : COLORS.cyan} emissiveIntensity={0.24} roughness={0.34} />
          </RoundedBox>
          <DataBars count={18} spread={[3.35, 0.12, 1.15]} offset={[0, 0.04, 0]} scale={[0.06, 0.11, 0.06]} color="#15171A" />
        </group>
        <Html pointerEvents="none" center position={[0, 1.55, 0]} distanceFactor={9}><span className="precompute-contract-label" data-tone="cyan">SAME TABLE · ATTACHED TO EACH PART</span></Html>
        <Html pointerEvents="none" center position={[0, -1.32, 0]} distanceFactor={9}><span className="precompute-detail-label">BASE ORDER + ALTERNATE REPRESENTATION</span></Html>
      </group>

      <group position={[-2.9, 2.55, 1.2]}>
        <RoundedBox args={[1.1, 1.45, 1.15]} radius={0.12} smoothness={3} castShadow><meshStandardMaterial color="#15171A" roughness={0.25} metalness={0.5} /></RoundedBox>
        <group ref={optimizerArm} position={[0.42, -0.06, 0]} rotation={[0, 0, -0.48]}><mesh position={[0.52, 0, 0]}><boxGeometry args={[1.05, 0.12, 0.22]} /><meshStandardMaterial color={COLORS.yellow} emissive={COLORS.yellow} emissiveIntensity={0.3} /></mesh></group>
        <Html pointerEvents="none" center position={[0, 1.12, 0]} distanceFactor={9}><span className="precompute-contract-label">OPTIMIZER CHOOSES</span></Html>
      </group>
      <Line points={[[ -4.25, 1.55, 1.28], [-2.9, 1.55, 1.28], [-1.65, 1.15, 0.62], [2.8, 1.15, 0.3]]} color={pressure ? COLORS.pressure : COLORS.cyan} lineWidth={5} />
      <group ref={query} position={[-4.1, 1.55, 1.28]} visible={false}><PrecomputeBlock color="#15171A" /></group>
      <Html pointerEvents="none" center position={[-3.75, 2.38, 1.28]} distanceFactor={9}><span className="precompute-detail-label">QUERY STILL NAMES BASE TABLE</span></Html>
      <group ref={result} position={[3.72, 1.05, 0.3]} visible={false} scale={0.05}><MachineValue position={[0, 0, 0]} value="answer" detail="chosen layout" color={COLORS.cyan} /></group>

      <Html pointerEvents="none" center position={[0, 4.08, 0]} distanceFactor={9}>
        <div className="precompute-stage-readout" data-contract="projection"><span>PROJECTION</span><strong ref={status}>ONE INSERTED BLOCK ARRIVES</strong><small>same table · attached lifecycle · optimizer selected</small></div>
      </Html>
    </group>
  );
}

function PrecomputeComparisonMachine({ pressure, writeAmplification = false }: { pressure: boolean; writeAmplification?: boolean }) {
  const mode: PrecomputeVisualMode = writeAmplification ? "write-amplification" : "comparison";
  const inputBlock = useRef<THREE.Group>(null);
  const mvBlock = useRef<THREE.Group>(null);
  const mvTarget = useRef<THREE.Group>(null);
  const projectionLayer = useRef<THREE.Group>(null);
  const optimizer = useRef<THREE.Group>(null);
  const status = useRef<HTMLElement>(null);
  const previousStage = useRef("");

  usePrecomputeAnimation(mode, (frame) => {
    if (inputBlock.current) inputBlock.current.position.x = THREE.MathUtils.lerp(-4.25, -2.55, frame.sourceProgress);
    if (mvBlock.current) {
      mvBlock.current.visible = frame.mvTransformProgress > 0.01;
      mvBlock.current.position.x = THREE.MathUtils.lerp(-2.35, 0.35, frame.mvTransformProgress);
      mvBlock.current.position.z = THREE.MathUtils.lerp(0, -1.35, frame.mvTransformProgress);
      mvBlock.current.position.y = 0.88 + Math.sin(frame.mvTransformProgress * Math.PI) * 0.52;
    }
    if (mvTarget.current) {
      mvTarget.current.visible = frame.mvTargetProgress > 0.01;
      mvTarget.current.scale.setScalar(THREE.MathUtils.lerp(0.05, 1, frame.mvTargetProgress));
    }
    if (projectionLayer.current) {
      projectionLayer.current.visible = frame.projectionAttachProgress > 0.01;
      projectionLayer.current.position.y = THREE.MathUtils.lerp(-0.18, 0.38, frame.projectionAttachProgress);
      projectionLayer.current.scale.x = THREE.MathUtils.lerp(0.05, 1, frame.projectionAttachProgress);
    }
    if (optimizer.current) optimizer.current.rotation.z = THREE.MathUtils.lerp(-0.45, 0.36, frame.optimizerProgress);
    if (previousStage.current !== frame.stage) {
      previousStage.current = frame.stage;
      if (status.current) status.current.textContent = writeAmplification
        ? `${Math.round(frame.writeLoad * 3)} WRITE TRACKS COMPETE`
        : PRECOMPUTE_STAGE_COPY[frame.stage];
    }
  });

  const accent = writeAmplification || pressure ? COLORS.pressure : COLORS.yellow;
  return (
    <group position={[0, 0.62, 0]}>
      <MachinePlate position={[0, 0.12, 0]} size={[9.8, 0.22, 5.35]} color="#D7D8D5" />
      <group ref={inputBlock} position={[-4.25, 0.88, 0]}><PrecomputeBlock /></group>
      <Line points={[[ -4.35, 0.52, 0], [-2.35, 0.52, 0]]} color="#15171A" lineWidth={6} />
      <Line points={[[ -2.35, 0.52, 0], [-0.45, 0.82, -1.35], [3.25, 0.82, -1.35]]} color={accent} lineWidth={6} />
      <Line points={[[ -2.35, 0.52, 0], [-0.45, 0.82, 1.35], [3.25, 0.82, 1.35]]} color={writeAmplification ? COLORS.pressure : COLORS.cyan} lineWidth={6} />

      <group position={[0.1, 1.42, -1.35]}>
        <RoundedBox args={[1.05, 2.35, 1.42]} radius={0.13} smoothness={3} castShadow><meshStandardMaterial color={writeAmplification ? COLORS.pressure : "#15171A"} roughness={0.25} metalness={0.5} /></RoundedBox>
        <Html pointerEvents="none" center position={[0, 1.58, 0]} distanceFactor={9}><span className="precompute-contract-label" data-tone="yellow">MV · TRANSFORM</span></Html>
      </group>
      <group ref={mvBlock} position={[-2.35, 0.88, 0]} visible={false}><PrecomputeBlock color={accent} /></group>
      <group position={[2.55, 0.72, -1.35]}>
        <MachinePlate position={[0, 0, 0]} size={[2.45, 0.15, 1.55]} color="#F5F5F1" />
        <group ref={mvTarget} position={[0, 0.42, 0]} visible={false} scale={0.05}><FoundryPartArtifact accent={accent} /></group>
        <Html pointerEvents="none" center position={[0, 1.22, 0]} distanceFactor={9}><span className="precompute-detail-label">SEPARATE TARGET</span></Html>
      </group>

      <group position={[1.15, 0.85, 1.35]}>
        <RoundedBox args={[4.35, 0.78, 1.72]} radius={0.14} smoothness={4} castShadow><meshStandardMaterial color="#F7F7F3" roughness={0.38} /></RoundedBox>
        <DataBars count={18} spread={[3.35, 0.24, 0.9]} offset={[0, -0.12, 0]} scale={[0.075, 0.2, 0.075]} color="#777D79" />
        <group ref={projectionLayer} position={[0, -0.18, 0]} visible={false}>
          <RoundedBox args={[3.75, 0.28, 1.25]} radius={0.05} smoothness={3}><meshStandardMaterial color={writeAmplification ? COLORS.pressure : COLORS.cyan} emissive={writeAmplification ? COLORS.pressure : COLORS.cyan} emissiveIntensity={0.22} /></RoundedBox>
        </group>
        <Html pointerEvents="none" center position={[0, 0.98, 0]} distanceFactor={9}><span className="precompute-contract-label" data-tone="cyan">PROJECTION · ATTACHED</span></Html>
      </group>
      <group position={[-1.55, 2.42, 1.35]}>
        <RoundedBox args={[0.8, 1.15, 0.9]} radius={0.1} smoothness={3}><meshStandardMaterial color="#15171A" /></RoundedBox>
        <group ref={optimizer} position={[0.25, 0, 0]} rotation={[0, 0, -0.45]}><mesh position={[0.38, 0, 0]}><boxGeometry args={[0.76, 0.1, 0.18]} /><meshStandardMaterial color={COLORS.yellow} /></mesh></group>
      </group>

      {writeAmplification && <InstrumentGauge position={[3.78, 1.08, 0]} value={1} color={COLORS.pressure} label="WRITE LOAD" />}
      <Html pointerEvents="none" center position={[0, 4.18, 0]} distanceFactor={9}>
        <div className="precompute-stage-readout precompute-stage-readout--comparison" data-contract={mode}>
          <span>{writeAmplification ? "WRITE AMPLIFICATION" : "SAME INPUT · DIFFERENT CONTRACTS"}</span>
          <strong ref={status}>{writeAmplification ? "3 WRITE TRACKS COMPETE" : "ONE INSERTED BLOCK ARRIVES"}</strong>
          <small>{writeAmplification ? "base + target + attached representation" : "separate target versus attached representation"}</small>
        </div>
      </Html>
    </group>
  );
}

function DerivedSwitchyard({ id, pressure }: { id: MechanismId; pressure: boolean }) {
  const comparison = useAtlasStore((state) => state.comparisonIds);
  const comparingDerivedData = Boolean(
    comparison?.includes("precompute.materialized-view")
    && comparison?.includes("precompute.projection"),
  );
  if (id === "precompute.write-amplification") return <PrecomputeComparisonMachine pressure={pressure} writeAmplification />;
  if (comparingDerivedData) return <PrecomputeComparisonMachine pressure={pressure} />;
  if (id === "precompute.materialized-view" || id === "precompute.aggregate-states") return <MaterializedViewMachine id={id} pressure={pressure} />;
  return <ProjectionMachine id={id} pressure={pressure} />;
}

function ClusterSwitchboard({ id, pressure }: { id: MechanismId; pressure: boolean }) {
  const query = useRef<THREE.Group>(null);
  const getTime = useMachineTime();
  useFrame(() => {
    if (query.current) query.current.position.x = Math.sin(getTime() * 0.55) * 0.35;
  });
  const failure = id === "architecture.failure" || pressure;
  const recovery = id === "architecture.recovery";
  const keeperActive = id === "architecture.keeper";
  const topology = clusterTopologyMode(id);
  const singleShard = topology === "replicated-single-shard";
  const topologyNodes = singleShard
    ? [
        { shardIndex: 0, replicaIndex: 0, x: -0.82, z: -0.72 },
        { shardIndex: 0, replicaIndex: 1, x: 0.82, z: 0.72 },
      ]
    : [-1, 1].flatMap((shardZ, shardIndex) => [-0.65, 0.65].map((replicaX, replicaIndex) => ({
        shardIndex,
        replicaIndex,
        x: replicaX,
        z: shardZ * 1.25,
      })));
  return (
    <group position={[0.2, 0.55, 0]}>
      <MachinePlate position={[0, 0.15, 0]} size={[9.3, 0.22, 4.55]} color="#D5D6D3" />
      <group ref={query} position={[-3.85, 1.05, 0]}><MachineValue position={[0, 0, 0]} value={singleShard ? "row" : "query"} detail={singleShard ? "one shard" : "scatter"} color={COLORS.yellow} /></group>
      {singleShard ? (
        <>
          <Line points={[[ -3.25, .82, 0], [-1.52, 1, -0.72]]} color={COLORS.yellow} lineWidth={5} />
          <Line points={[[ -0.18, 1, -0.72], [0.18, 1, 0.72]]} color={COLORS.cyan} lineWidth={5} dashed dashSize={0.18} gapSize={0.09} />
          <Line points={[[1.38, 1, 0.72], [3.35, .82, 0]]} color={COLORS.cyan} lineWidth={5} />
        </>
      ) : (
        <>
          <Line points={[[ -3.25, .82, 0], [-1.65, 1, -1.2]]} color={COLORS.yellow} lineWidth={5} />
          <Line points={[[ -3.25, .82, 0], [-1.65, 1, 1.2]]} color={COLORS.yellow} lineWidth={5} />
          <Line points={[[1.3, 1, -1.2], [3.35, .82, 0]]} color={COLORS.cyan} lineWidth={5} />
          <Line points={[[1.3, 1, 1.2], [3.35, .82, 0]]} color="#A48AE3" lineWidth={5} />
        </>
      )}
      {topologyNodes.map(({ shardIndex, replicaIndex, x, z }) => {
        const broken = failure && shardIndex === 0 && replicaIndex === 1;
        const color = broken ? COLORS.pressure : recovery && shardIndex === 0 ? COLORS.yellow : shardIndex === 0 ? COLORS.cyan : "#A48AE3";
        return <group key={`${shardIndex}-${replicaIndex}`} position={[x, 1.25, z]}>
          <RoundedBox args={[1.05, 2.3, 1.25]} radius={0.13} smoothness={3} castShadow><meshStandardMaterial color={color} emissive={color} emissiveIntensity={broken ? 0.24 : 0.08} transparent={broken} opacity={broken ? 0.36 : 1} roughness={0.34} metalness={0.28} /></RoundedBox>
          <DataBars count={10} spread={[0.66, 1.15, 0.66]} offset={[0, -0.45, 0]} color="#15171A" />
          <Html pointerEvents="none" center position={[0, 1.6, 0]} distanceFactor={9}><span className="machine-stage-label">S{shardIndex + 1} · R{replicaIndex + 1}</span></Html>
        </group>;
      })}
      <MachineValue position={[3.55, 1.05, 0]} value={singleShard ? "read" : "result"} detail={singleShard ? "either replica" : "gather"} color={COLORS.yellow} />
      <group position={[0, 3.65, 0]}>
        {[-1.25, 0, 1.25].map((x, index) => <group key={x} position={[x, 0, 0]}><mesh castShadow><cylinderGeometry args={[0.48, 0.48, 0.92, 18]} /><meshStandardMaterial color={keeperActive ? "#15171A" : "#737875"} roughness={0.3} metalness={0.52} /></mesh><mesh position={[0, 0.52, 0]}><sphereGeometry args={[0.16, 14, 10]} /><meshStandardMaterial color={index === 1 ? COLORS.yellow : COLORS.cyan} emissive={index === 1 ? COLORS.yellow : COLORS.cyan} emissiveIntensity={0.35} /></mesh></group>)}
        <Line points={[[-1.25, .15, 0], [0, .15, 0], [1.25, .15, 0]]} color={COLORS.cyan} lineWidth={2} dashed dashSize={0.12} gapSize={0.08} />
        <Html pointerEvents="none" center position={[0, 1.18, 0]} distanceFactor={9}><span className="keeper-stage-label">KEEPER QUORUM · METADATA ONLY</span></Html>
      </group>
      <Html pointerEvents="none" center position={[0, 0.62, 2.72]} distanceFactor={10}>
        <div className="cluster-topology-contract" data-topology={topology}>
          <span>{singleShard ? "REPLICATION" : topology === "replicated-shards" ? "SHARDING + REPLICATION" : "DISTRIBUTED TOPOLOGY"}</span>
          <strong>{singleShard ? "One shard · same rows on two replicas" : "Two shards · two replicas each"}</strong>
          <small>{singleShard ? "Availability copies data; it does not split the dataset." : "A shard key splits rows; replicas copy each shard."}</small>
        </div>
      </Html>
      <MechanismTitle id={id} eyebrow="CLUSTER SWITCHBOARD" />
    </group>
  );
}

function RetentionVault({ id, pressure }: { id: MechanismId; pressure: boolean }) {
  const belt = useRef<THREE.Group>(null);
  const getTime = useMachineTime();
  useFrame(() => {
    if (belt.current) belt.current.position.x = -2.4 + ((getTime() * (pressure ? 0.18 : 0.45)) % 1) * 4.8;
  });
  const mutation = id === "retention.mutation";
  const backup = id === "retention.backup" || id === "retention.restore";
  return (
    <group position={[0.15, 0.62, 0]}>
      <MachinePlate position={[0, 0.15, 0]} size={[9.2, 0.22, 4.45]} color="#D5D6D3" />
      <group position={[-3.15, 1.35, 0]}>
        <MachinePlate position={[0, 0, 0]} size={[2, 2.4, 2.8]} color="#15171A" />
        <DataBars count={28} spread={[1.3, 1.35, 1.8]} offset={[0, -0.55, 0]} color={COLORS.yellow} />
        <Html pointerEvents="none" center position={[0, 1.75, 0]} distanceFactor={9}><span className="machine-stage-label">HOT PARTS</span></Html>
      </group>
      <Line points={[[ -2.05, .55, 0], [2.15, .55, 0]]} color="#15171A" lineWidth={6} />
      <group ref={belt} position={[-2.4, 0.95, 0]}><DataCassette color={id === "retention.ttl-delete" ? COLORS.pressure : COLORS.cyan} scale={[1.2, 1.15, 1]} /></group>
      <group position={[3.15, 1.25, 0]}>
        <MachinePlate position={[0, 0, 0]} size={[2, 2.2, 2.8]} color={backup ? "#15171A" : "#767B78"} />
        {backup ? <><RoundedBox args={[1.3, 1.5, 0.18]} radius={0.06} smoothness={2} position={[0, 0, 1.52]}><meshStandardMaterial color="#FFFFFF" /></RoundedBox>{Array.from({ length: 7 }, (_, index) => <mesh key={index} position={[0, 0.5 - index * 0.17, 1.64]}><boxGeometry args={[0.82 - (index % 3) * 0.13, 0.05, 0.03]} /><meshBasicMaterial color="#15171A" /></mesh>)}</> : <DataBars count={18} spread={[1.25, 1.2, 1.7]} offset={[0, -0.48, 0]} color={COLORS.cyan} />}
        <Html pointerEvents="none" center position={[0, 1.7, 0]} distanceFactor={9}><span className="machine-stage-label">{backup ? "BACKUP MANIFEST" : "COLD PARTS"}</span></Html>
      </group>
      <group position={[0, 2.2, -1.55]}>
        <RoundedBox args={[2.25, 2.8, 0.5]} radius={0.11} smoothness={3}><meshStandardMaterial color={mutation || pressure ? COLORS.pressure : "#15171A"} roughness={0.27} metalness={0.55} /></RoundedBox>
        <mesh position={[0, -1.18, 0.34]}><boxGeometry args={[1.55, 0.24, 0.8]} /><meshStandardMaterial color={mutation ? COLORS.pressure : COLORS.yellow} emissive={mutation ? COLORS.pressure : COLORS.yellow} emissiveIntensity={0.3} /></mesh>
        <Html pointerEvents="none" center position={[0, 1.8, 0]} distanceFactor={9}><span className="machine-stage-label">REWRITE PRESS</span></Html>
      </group>
      <MechanismTitle id={id} eyebrow="TIME & REWRITE VAULT" />
    </group>
  );
}

function AggregationRunArtifact({ index }: { index: number }) {
  return (
    <group>
      <RoundedBox args={[0.92, 0.5, 0.84]} radius={0.08} smoothness={3} castShadow>
        <meshStandardMaterial color="#F0F1ED" roughness={0.42} metalness={0.1} />
      </RoundedBox>
      {Array.from({ length: 4 }, (_, stripe) => (
        <mesh key={stripe} position={[-0.3 + stripe * 0.2, 0.28, 0]}>
          <boxGeometry args={[0.11, 0.08, 0.62]} />
          <meshStandardMaterial color={(stripe + index) % 2 ? COLORS.cyan : COLORS.yellow} emissive={(stripe + index) % 2 ? COLORS.cyan : COLORS.yellow} emissiveIntensity={0.22} />
        </mesh>
      ))}
    </group>
  );
}

function AggregationSpillVisualization() {
  const input = useRef<THREE.Group>(null);
  const memoryFill = useRef<THREE.Mesh>(null);
  const threshold = useRef<THREE.MeshStandardMaterial>(null);
  const mergeRotor = useRef<THREE.Group>(null);
  const runRefs = useRef<Array<THREE.Group | null>>([]);
  const stateCellRefs = useRef<Array<THREE.Group | null>>([]);
  const resultRefs = useRef<Array<THREE.Mesh | null>>([]);
  const preventionDeck = useRef<THREE.Group>(null);
  const status = useRef<HTMLSpanElement>(null);
  const memoryStatus = useRef<HTMLSpanElement>(null);
  const previousStage = useRef("");
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  const recommendation = useAtlasStore((state) => state.recommendation);
  const getTime = useMachineTime();
  const spillDecision = recommendation?.decisions.find((entry) => entry.mechanismId === "memory.external-spill");
  const preventionLabel = spillDecision?.title.toUpperCase() ?? "FILTER / PRECOMPUTE BEFORE SPILL";

  useEffect(() => () => {
    delete document.documentElement.dataset.aggregationSpillPhase;
    delete document.documentElement.dataset.aggregationSpilledRuns;
    delete document.documentElement.dataset.aggregationMemoryRatio;
    delete document.documentElement.dataset.aggregationRecommendation;
  }, []);
  useFrame(() => {
    const frame = aggregationSpillFrame(getTime(), reducedMotion);
    document.documentElement.dataset.aggregationSpillPhase = frame.stage;
    document.documentElement.dataset.aggregationSpilledRuns = String(frame.spilledRuns);
    document.documentElement.dataset.aggregationMemoryRatio = frame.memoryRatio.toFixed(2);
    document.documentElement.dataset.aggregationRecommendation = spillDecision ? "personalized" : "generic";
    if (input.current) {
      input.current.position.x = THREE.MathUtils.lerp(-5.15, -3.62, frame.inputProgress);
      input.current.position.y = 0.92 + Math.sin(frame.inputProgress * Math.PI) * 0.12;
    }
    if (memoryFill.current) {
      memoryFill.current.scale.y = Math.max(0.04, frame.memoryRatio);
      memoryFill.current.position.y = 0.24 + frame.memoryRatio * 0.88;
    }
    if (threshold.current) {
      threshold.current.emissiveIntensity = frame.stage === "threshold" ? 0.9 : frame.stage === "spill" ? 0.55 : 0.2;
      threshold.current.opacity = frame.stage === "threshold" ? 1 : 0.78;
    }
    stateCellRefs.current.forEach((cell, index) => {
      if (!cell) return;
      const cellThreshold = 0.18 + (index / Math.max(1, stateCellRefs.current.length - 1)) * 0.7;
      const visibleScale = THREE.MathUtils.smoothstep(frame.memoryRatio, cellThreshold - 0.08, cellThreshold + 0.04);
      cell.scale.setScalar(THREE.MathUtils.lerp(0.12, 1, visibleScale));
      cell.rotation.y = Math.sin(getTime() * 0.5 + index) * 0.08;
    });
    runRefs.current.forEach((run, index) => {
      if (!run) return;
      const spillStart = index * 0.22;
      const spillEnd = 0.52 + index * 0.16;
      const toScratch = THREE.MathUtils.smoothstep(frame.spillProgress, spillStart, spillEnd);
      const toMerge = THREE.MathUtils.smoothstep(frame.mergeProgress, index * 0.17, 0.58 + index * 0.13);
      const scratchX = 1.75 + index * 0.42;
      run.visible = frame.spilledRuns > index || frame.mergeProgress > 0;
      run.position.x = THREE.MathUtils.lerp(0.48, scratchX, toScratch);
      run.position.x = THREE.MathUtils.lerp(run.position.x, 3.2, toMerge);
      run.position.z = THREE.MathUtils.lerp(-0.82 + index * 0.82, 0, toMerge);
      run.position.y = 0.78 + Math.sin(toScratch * Math.PI) * 0.5 + Math.sin(toMerge * Math.PI) * 0.42;
      run.scale.setScalar(THREE.MathUtils.lerp(0.76, 0.36, toMerge));
    });
    if (mergeRotor.current) {
      mergeRotor.current.rotation.x = getTime() * (frame.stage === "external-merge" ? 2.4 : 0.35);
      mergeRotor.current.scale.setScalar(1 + Math.sin(getTime() * 5) * (frame.stage === "external-merge" ? 0.035 : 0));
    }
    resultRefs.current.forEach((bar, index) => {
      if (!bar) return;
      const progress = THREE.MathUtils.smoothstep(frame.resultProgress, index * 0.1, 0.55 + index * 0.08);
      bar.scale.y = Math.max(0.04, progress);
      bar.position.y = 0.42 + progress * (0.24 + index * 0.09);
    });
    if (preventionDeck.current) preventionDeck.current.visible = frame.resultProgress > 0.05;
    if (memoryStatus.current) memoryStatus.current.textContent = `${Math.round(frame.memoryRatio * 100)}% RAM STATE`;
    if (frame.stage !== previousStage.current) {
      previousStage.current = frame.stage;
      if (status.current) status.current.textContent = ({
        read: "READ BLOCKS · EXTRACT GROUP KEYS",
        build: "DISTINCT KEYS GROW PARTIAL STATES IN RAM",
        threshold: "CONFIGURED MEMORY THRESHOLD REACHED",
        spill: "WRITE PARTIAL STATES TO TEMPORARY STORAGE",
        "external-merge": "MERGE TEMPORARY RUNS WITH REMAINING STATE",
        result: "FINALIZE GROUPS · EXTRA I/O ADDED LATENCY",
      } as const)[frame.stage];
    }
  });

  return (
    <group position={[-0.78, 0.62, 0]}>
      <MachinePlate position={[0, 0.12, 0]} size={[12, 0.2, 5.85]} color="#D7D8D4" />

      <Line points={[[ -5.25, 0.3, 0], [-3.08, 0.3, 0]]} color="#15171A" lineWidth={5} />
      <group ref={input} position={[-5.15, 0.92, 0]}>
        <MachineValue position={[0, 0, 0]} value="many keys" detail="GROUP BY user_id" color={COLORS.yellow} />
      </group>

      <group position={[-2.78, 1.05, 0]}>
        {[-0.82, 0, 0.82].map((z, lane) => (
          <group key={z} position={[0, 0, z]}>
            <RoundedBox args={[1.25, 1.08, 0.58]} radius={0.11} smoothness={3} castShadow><meshStandardMaterial color="#15171A" roughness={0.3} metalness={0.48} /></RoundedBox>
            {Array.from({ length: 5 }, (_, keyIndex) => <mesh key={keyIndex} position={[-0.42 + keyIndex * 0.21, 0.56, 0]}><boxGeometry args={[0.12, 0.12 + keyIndex * 0.035, 0.38]} /><meshStandardMaterial color={(keyIndex + lane) % 2 ? COLORS.cyan : COLORS.yellow} emissive={(keyIndex + lane) % 2 ? COLORS.cyan : COLORS.yellow} emissiveIntensity={0.25} /></mesh>)}
          </group>
        ))}
        <Html pointerEvents="none" center position={[0, 1.08, 0]} distanceFactor={10}><span className="aggregation-stage-label">PARALLEL PARTIAL STATES</span></Html>
      </group>

      <Line points={[[ -2.05, 0.46, 0], [-1.28, 0.46, 0]]} color={COLORS.yellow} lineWidth={5} />
      <group position={[-0.38, 1.35, 0]}>
        <RoundedBox args={[2.12, 2.75, 2.58]} radius={0.17} smoothness={4} castShadow>
          <meshPhysicalMaterial color="#E8ECE9" transparent opacity={0.28} roughness={0.14} transmission={0.14} metalness={0.1} />
        </RoundedBox>
        <mesh ref={memoryFill} position={[0, 0.6, 0]} scale={[1, 0.3, 1]}>
          <boxGeometry args={[1.78, 1.76, 2.2]} />
          <meshStandardMaterial color={COLORS.pressure} transparent opacity={0.14} emissive={COLORS.pressure} emissiveIntensity={0.14} />
        </mesh>
        {Array.from({ length: 20 }, (_, index) => {
          const column = index % 4;
          const row = Math.floor(index / 4);
          return <group ref={(node) => { stateCellRefs.current[index] = node; }} key={index} position={[-0.66 + column * 0.44, -0.86 + row * 0.43, -0.64 + (index % 3) * 0.64]}>
            <RoundedBox args={[0.25, 0.24, 0.25]} radius={0.045} smoothness={2}><meshStandardMaterial color={(index + row) % 3 === 0 ? COLORS.yellow : COLORS.cyan} emissive={(index + row) % 3 === 0 ? COLORS.yellow : COLORS.cyan} emissiveIntensity={0.24} roughness={0.32} /></RoundedBox>
          </group>;
        })}
        <mesh position={[0, 0.83, 1.34]}>
          <boxGeometry args={[2.35, 0.055, 0.08]} />
          <meshStandardMaterial ref={threshold} color={COLORS.pressure} emissive={COLORS.pressure} emissiveIntensity={0.2} transparent opacity={0.78} />
        </mesh>
        <Html pointerEvents="none" center position={[0, 1.82, 0]} distanceFactor={10}><span ref={memoryStatus} className="aggregation-memory-label">24% RAM STATE</span></Html>
        <Html pointerEvents="none" center position={[0, 0.92, 1.55]} distanceFactor={9}><span className="aggregation-threshold-label">SPILL THRESHOLD</span></Html>
      </group>

      <Line points={[[0.82, 0.38, 0], [2.72, 0.38, 0]]} color={COLORS.pressure} lineWidth={5} dashed dashSize={0.18} gapSize={0.1} />
      {[0, 1, 2].map((index) => <group ref={(node) => { runRefs.current[index] = node; }} key={index} position={[0.48, 0.78, -0.82 + index * 0.82]} visible={false}><AggregationRunArtifact index={index} /></group>)}
      <group position={[2.18, 0.42, 0]}>
        <MachinePlate position={[0, 0, 0]} size={[2.05, 0.38, 2.72]} color="#555A58" />
        {[0, 1, 2].map((index) => <mesh key={index} position={[-0.42 + index * 0.42, 0.24, 0]}><boxGeometry args={[0.08, 0.18, 2.1]} /><meshStandardMaterial color={COLORS.pressure} emissive={COLORS.pressure} emissiveIntensity={0.2} /></mesh>)}
        <Html pointerEvents="none" center position={[0, 0.88, 0]} distanceFactor={10}><span className="aggregation-run-label">TEMPORARY RUNS · DISK</span></Html>
      </group>

      <group position={[3.22, 1.06, 0]}>
        <RoundedBox args={[0.96, 1.75, 1.95]} radius={0.14} smoothness={4} castShadow><meshStandardMaterial color="#15171A" roughness={0.25} metalness={0.56} /></RoundedBox>
        <group ref={mergeRotor} rotation={[0, 0, Math.PI / 4]}>
          {[0, Math.PI / 2].map((rotation) => <mesh key={rotation} rotation={[rotation, 0, 0]}><torusGeometry args={[0.4, 0.1, 12, 24]} /><meshStandardMaterial color={rotation === 0 ? COLORS.cyan : COLORS.yellow} emissive={rotation === 0 ? COLORS.cyan : COLORS.yellow} emissiveIntensity={0.32} metalness={0.32} /></mesh>)}
        </group>
        <Html pointerEvents="none" center position={[0, 1.34, 0]} distanceFactor={10}><span className="aggregation-stage-label">EXTERNAL MERGE</span></Html>
      </group>

      <Line points={[[3.72, 0.46, 0], [4.18, 0.46, 0]]} color={COLORS.yellow} lineWidth={5} />
      <group position={[4.42, 0.34, 0]}>
        <RoundedBox args={[1.48, 0.18, 1.9]} radius={0.07} smoothness={3}><meshStandardMaterial color="#E6E7E2" roughness={0.55} /></RoundedBox>
        {Array.from({ length: 5 }, (_, index) => <mesh ref={(node) => { resultRefs.current[index] = node; }} key={index} position={[-0.48 + index * 0.24, 0.42, 0]} scale={[1, 0.04, 1]}><boxGeometry args={[0.16, 0.72 + index * 0.16, 0.58]} /><meshStandardMaterial color={index % 2 ? COLORS.cyan : COLORS.yellow} emissive={index % 2 ? COLORS.cyan : COLORS.yellow} emissiveIntensity={0.26} /></mesh>)}
        <Html pointerEvents="none" center position={[0, 1.48, 0]} distanceFactor={10}><span className="aggregation-result-label">FINAL GROUPS</span></Html>
      </group>

      <group ref={preventionDeck} visible={false}>
        <MachinePlate position={[-0.7, 0.2, 2.18]} size={[4.9, 0.14, 0.62]} color="#DDEBE8" />
        <Html pointerEvents="none" center position={[-0.7, 0.92, 2.18]} distanceFactor={10}><span className="aggregation-prevention-label" data-personalized={Boolean(spillDecision)}>{preventionLabel}</span></Html>
        <Html pointerEvents="none" center position={[2.22, 0.42, 2.18]} distanceFactor={9}><span className="aggregation-guardrail-label">SPILL = COMPLETION GUARDRAIL · NOT SPEEDUP</span></Html>
      </group>

      <Html pointerEvents="none" center position={[-2.68, 4.08, -1.6]} distanceFactor={12}>
        <div className="aggregation-cause-callout"><span>THE GOTCHA</span><strong>Distinct group keys grow partial state in RAM.</strong><small>More keys and larger aggregate states consume more memory before the result can finalize.</small></div>
      </Html>
      <Html pointerEvents="none" center position={[2.48, 3.92, -1.55]} distanceFactor={11}>
        <div className="aggregation-cost-callout"><span>SURVIVAL PATH</span><strong>Spill completes with extra I/O</strong><small>Temporary writes and an external merge protect memory, but add latency.</small></div>
      </Html>
      <Html pointerEvents="none" center position={[0, 3.76, -1.5]} distanceFactor={12}>
        <div className="aggregation-mobile-summary"><span>HIGH-CARDINALITY GROUP BY</span><strong>RAM threshold → temporary disk runs</strong><small>Precompute repeated work first; spill is a slower completion guardrail.</small></div>
      </Html>
      <Html pointerEvents="none" center position={[0, -0.68, 0]} distanceFactor={11}><span ref={status} className="foundry-label">READ BLOCKS · EXTRACT GROUP KEYS</span></Html>
    </group>
  );
}

function ReplicaRackFrame({ lagging = false }: { lagging?: boolean }) {
  const frameColor = lagging ? "#5A625E" : "#15171A";
  return (
    <group>
      <RoundedBox args={[2.05, 2.6, 2.45]} radius={0.18} smoothness={4} castShadow>
        <meshPhysicalMaterial color="#E7EAE6" transparent opacity={0.16} roughness={0.16} transmission={0.22} metalness={0.04} depthWrite={false} />
      </RoundedBox>
      {[-0.9, 0.9].flatMap((x) => [-1.08, 1.08].map((z) => <RoundedBox key={`${x}-${z}`} args={[0.11, 2.42, 0.11]} radius={0.035} smoothness={2} position={[x, 0, z]}><meshStandardMaterial color={frameColor} roughness={0.28} metalness={0.5} /></RoundedBox>))}
      {[-1.16, 1.16].flatMap((y) => [-1.08, 1.08].map((z) => <RoundedBox key={`${y}-${z}`} args={[1.92, 0.11, 0.11]} radius={0.035} smoothness={2} position={[0, y, z]}><meshStandardMaterial color={frameColor} roughness={0.28} metalness={0.5} /></RoundedBox>))}
      <mesh position={[0, 0, -1.12]}><boxGeometry args={[1.72, 2.16, 0.035]} /><meshStandardMaterial color={frameColor} transparent opacity={0.12} /></mesh>
    </group>
  );
}

const REPLICA_LAG_STATUS = {
  commit: "REPLICA 1 COMMITS A COMPLETE IMMUTABLE PART",
  enqueue: "KEEPER RECORDS THE OPERATION · NO ROW BYTES",
  transfer: "REPLICA 2 FETCHES COMPRESSED PART BYTES",
  backlog: "ARRIVALS OUTRUN FETCH + STORAGE · QUEUE AGE RISES",
  "catch-up": "DESTINATION CAPACITY RETURNS · QUEUE DRAINS",
  healthy: "CATCH-UP CYCLE COMPLETE · QUEUE RETURNS TO BASELINE",
} as const;

const KEEPER_QUORUM_STATUS = {
  healthy: "3 / 3 KEEPER VOTERS COORDINATE REPLICATION",
  partition: "TWO VOTERS LEAVE THE CONNECTED FAILURE DOMAIN",
  "no-quorum": "1 / 3 CANNOT COMMIT NEW COORDINATION RECORDS",
  "read-only": "REPLICATED WRITES PAUSE · LOCAL PART READS CONTINUE",
  restore: "RESTORE K2 · 2 / 3 REOPENS COORDINATION · QUEUE DRAINS",
  reconciled: "WRITE GATE REOPENS AFTER COORDINATION RECOVERS",
} as const;

function ReplicaLagVisualization() {
  const committedPart = useRef<THREE.Group>(null);
  const logTicket = useRef<THREE.Group>(null);
  const movingPart = useRef<THREE.Group>(null);
  const ticketRefs = useRef<Array<THREE.Group | null>>([]);
  const replicaPartRefs = useRef<Array<THREE.Group | null>>([]);
  const ageNeedle = useRef<THREE.Group>(null);
  const retryLamp = useRef<THREE.MeshStandardMaterial>(null);
  const recoveryDeck = useRef<THREE.Group>(null);
  const status = useRef<HTMLSpanElement>(null);
  const queueStatus = useRef<HTMLSpanElement>(null);
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  const recommendation = useAtlasStore((state) => state.recommendation);
  const getTime = useMachineTime();
  const replicationDecision = recommendation?.decisions.find((entry) => entry.mechanismId === "observability.replication-queue");
  const recoveryLabel = replicationDecision?.title.toUpperCase() ?? "RESTORE FETCH / STORAGE CAPACITY";

  useEffect(() => () => {
    delete document.documentElement.dataset.replicaLagPhase;
    delete document.documentElement.dataset.replicaQueueDepth;
    delete document.documentElement.dataset.replicaOldestTask;
    delete document.documentElement.dataset.replicaRecommendation;
  }, []);
  useFrame(() => {
    const frame = replicaLagFrame(getTime(), reducedMotion);
    document.documentElement.dataset.replicaLagPhase = frame.stage;
    document.documentElement.dataset.replicaQueueDepth = String(frame.queueDepth);
    document.documentElement.dataset.replicaOldestTask = frame.oldestTaskRatio.toFixed(2);
    document.documentElement.dataset.replicaRecommendation = replicationDecision ? "personalized" : "generic";
    if (committedPart.current) {
      committedPart.current.scale.setScalar(THREE.MathUtils.lerp(0.18, 0.72, frame.commitProgress));
      committedPart.current.position.y = 1.7 + Math.sin(frame.commitProgress * Math.PI) * 0.18;
    }
    if (logTicket.current) {
      logTicket.current.position.x = THREE.MathUtils.lerp(-3.55, -0.45, frame.logProgress);
      logTicket.current.position.y = 3.25 + Math.sin(frame.logProgress * Math.PI) * 0.3;
      logTicket.current.scale.setScalar(THREE.MathUtils.lerp(0.3, 1, frame.logProgress));
    }
    if (movingPart.current) {
      movingPart.current.visible = frame.stage !== "commit" && frame.stage !== "enqueue" && frame.stage !== "healthy";
      movingPart.current.position.x = THREE.MathUtils.lerp(-3.08, 3.04, frame.transferProgress);
      movingPart.current.position.y = 0.72 + Math.sin(frame.transferProgress * Math.PI) * 0.22;
      movingPart.current.rotation.y = Math.sin(frame.transferProgress * Math.PI) * 0.12;
    }
    ticketRefs.current.forEach((ticket, index) => {
      if (!ticket) return;
      const visible = index < frame.queueDepth;
      ticket.visible = visible;
      ticket.scale.x = THREE.MathUtils.lerp(ticket.scale.x, visible ? 1 : 0.12, 0.18);
      ticket.position.x = Math.sin(getTime() * 1.15 + index) * (frame.stage === "backlog" ? 0.06 : 0.015);
    });
    replicaPartRefs.current.forEach((part, index) => {
      if (!part) return;
      const threshold = 0.22 + index * 0.13;
      const visibility = THREE.MathUtils.smoothstep(frame.replicaProgress, threshold - 0.08, threshold + 0.06);
      part.scale.setScalar(THREE.MathUtils.lerp(0.05, 0.62, visibility));
      part.position.y = -0.58 + index * 0.42 + visibility * 0.04;
    });
    if (ageNeedle.current) ageNeedle.current.rotation.z = THREE.MathUtils.lerp(-Math.PI * 0.58, Math.PI * 0.58, frame.oldestTaskRatio);
    if (retryLamp.current) retryLamp.current.emissiveIntensity = 0.16 + frame.retryPulse * 0.84;
    if (recoveryDeck.current) recoveryDeck.current.visible = reducedMotion || frame.stage === "catch-up" || frame.stage === "healthy";
    if (queueStatus.current) queueStatus.current.textContent = `${frame.queueDepth} QUEUED · OLDEST ${frame.oldestTaskRatio > 0.72 ? "AGING" : frame.oldestTaskRatio > 0.3 ? "RISING" : "LOW"}`;
    const nextStatus = REPLICA_LAG_STATUS[frame.stage];
    if (status.current && status.current.textContent !== nextStatus) status.current.textContent = nextStatus;
  });

  return (
    <group position={[-0.55, 0.62, 0]}>
      <MachinePlate position={[0, 0.12, 0]} size={[12.2, 0.2, 5.9]} color="#D7D8D4" />

      <group position={[-4.15, 1.28, 0.55]}>
        <ReplicaRackFrame />
        {Array.from({ length: 5 }, (_, index) => <group key={index} position={[0, -0.72 + index * 0.38, 0.05]}><DataCassette color={index % 2 ? COLORS.cyan : COLORS.yellow} scale={[0.66, 0.54, 1.2]} /></group>)}
        <group ref={committedPart} position={[0, 1.7, 0.05]} scale={0.18}><DataCassette color={COLORS.yellow} /></group>
        <Html pointerEvents="none" center position={[0, -1.72, 1.35]} distanceFactor={10}><span className="replica-node-label">REPLICA 1 · CURRENT</span></Html>
      </group>

      <group position={[-0.45, 3.18, -1.72]}>
        <Line points={[[-3.1, 0, 0], [3.25, 0, 0]]} color="#8F82CE" lineWidth={2} dashed dashSize={0.15} gapSize={0.1} />
        {[-1.25, 0, 1.25].map((x, index) => <group key={x} position={[x, 0, 0]}><mesh castShadow><cylinderGeometry args={[0.34, 0.34, 0.62, 16]} /><meshStandardMaterial color="#343837" roughness={0.32} metalness={0.48} /></mesh><mesh position={[0, 0.38, 0]}><sphereGeometry args={[0.1, 12, 8]} /><meshStandardMaterial color={index === 1 ? COLORS.yellow : "#8F82CE"} emissive={index === 1 ? COLORS.yellow : "#8F82CE"} emissiveIntensity={0.4} /></mesh></group>)}
        <Html pointerEvents="none" center position={[0, -0.72, 0.9]} distanceFactor={10}><span className="replica-metadata-label">KEEPER · OPERATION METADATA ONLY</span></Html>
      </group>
      <group ref={logTicket} position={[-3.55, 3.25, -1.72]} scale={0.3}>
        <RoundedBox args={[1.12, 0.34, 0.64]} radius={0.06} smoothness={3}><meshStandardMaterial color="#8F82CE" emissive="#8F82CE" emissiveIntensity={0.3} roughness={0.35} /></RoundedBox>
        <Html pointerEvents="none" center position={[0, 0.42, 0]} distanceFactor={9}><span className="replica-ticket-label">GET_PART</span></Html>
      </group>

      <Line points={[[ -3.12, 0.58, 0.72], [3.08, 0.58, 0.72]]} color={COLORS.yellow} lineWidth={7} />
      <Line points={[[ -3.12, 0.54, 0.83], [3.08, 0.54, 0.83]]} color={COLORS.cyan} lineWidth={3} />
      <Html pointerEvents="none" center position={[-0.15, 0.08, 1.02]} distanceFactor={10}><span className="replica-data-label">PART BYTES · DIRECT DATA PATH</span></Html>
      <group ref={movingPart} position={[-3.08, 0.72, 0.72]} visible={false}><DataCassette color={COLORS.yellow} scale={[0.7, 0.7, 0.7]} /></group>

      <group position={[-0.25, 1.32, -0.55]}>
        <RoundedBox args={[2.12, 2.6, 1.72]} radius={0.16} smoothness={4} castShadow><meshPhysicalMaterial color="#E9EAE6" transparent opacity={0.5} roughness={0.22} transmission={0.08} /></RoundedBox>
        {Array.from({ length: 7 }, (_, index) => <group ref={(node) => { ticketRefs.current[index] = node; }} key={index} position={[0, -0.82 + index * 0.27, 0]} visible={index === 0}>
          <RoundedBox args={[1.58, 0.19, 1.12]} radius={0.035} smoothness={2}><meshStandardMaterial color={index % 3 === 2 ? COLORS.pressure : index % 2 ? "#8F82CE" : "#15171A"} roughness={0.34} metalness={0.18} /></RoundedBox>
          <Html pointerEvents="none" center position={[0, 0, 0.62]} distanceFactor={9}><span className="replica-queue-task">{index % 3 === 2 ? "MERGE_PARTS" : "GET_PART"}</span></Html>
        </group>)}
        <Html pointerEvents="none" center position={[0, 2.0, 0]} distanceFactor={10}><span ref={queueStatus} className="replica-queue-label">1 QUEUED · OLDEST LOW</span></Html>
      </group>

      <group position={[1.55, 1.18, -1.2]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.66, 0.09, 12, 40, Math.PI * 1.55]} /><meshStandardMaterial color="#555A58" roughness={0.4} metalness={0.38} /></mesh>
        <group ref={ageNeedle} rotation={[0, 0, -Math.PI * 0.58]}><mesh position={[0, 0.36, 0]}><boxGeometry args={[0.07, 0.72, 0.06]} /><meshStandardMaterial color={COLORS.pressure} emissive={COLORS.pressure} emissiveIntensity={0.48} /></mesh></group>
        <mesh position={[0.76, 0.46, 0]}><sphereGeometry args={[0.13, 14, 10]} /><meshStandardMaterial ref={retryLamp} color={COLORS.pressure} emissive={COLORS.pressure} emissiveIntensity={0.16} /></mesh>
        <Html pointerEvents="none" center position={[0, -0.98, 0]} distanceFactor={9}><span className="replica-age-label">OLDEST TASK AGE · RETRIES</span></Html>
      </group>

      <group position={[4.15, 1.28, 0.55]}>
        <ReplicaRackFrame lagging />
        {Array.from({ length: 6 }, (_, index) => <group ref={(node) => { replicaPartRefs.current[index] = node; }} key={index} position={[0, -0.58 + index * 0.42, 0.05]} scale={0.05}><DataCassette color={index % 2 ? COLORS.cyan : COLORS.yellow} /></group>)}
        <Html pointerEvents="none" center position={[0, 2.15, 0]} distanceFactor={10}><span className="replica-node-label" data-lagging="true">REPLICA 2 · BEHIND</span></Html>
      </group>

      <group ref={recoveryDeck} visible={false}>
        <MachinePlate position={[1.15, 0.2, 2.28]} size={[5.2, 0.14, 0.58]} color="#DDEBE8" />
        <Html pointerEvents="none" center position={[1.15, 0.92, 2.28]} distanceFactor={10}><span className="replica-recovery-label" data-personalized={Boolean(replicationDecision)}>{recoveryLabel}</span></Html>
        <Html pointerEvents="none" center position={[4.2, 0.42, 2.28]} distanceFactor={9}><span className="replica-baseline-label">VERIFY · DEPTH + OLDEST AGE RETURN TO BASELINE</span></Html>
      </group>

      <Html pointerEvents="none" center position={[-3.35, 4.72, -0.2]} distanceFactor={12}><div className="replica-cause-callout"><span>THE GOTCHA</span><strong>Queue work arrives faster than this replica completes it.</strong><small>Compressed part fetches and local merge work accumulate while the destination path is slow.</small></div></Html>
      <Html pointerEvents="none" center position={[2.72, 4.65, -0.14]} distanceFactor={11}><div className="replica-diagnosis-callout"><span>DIAGNOSE THE BOTTLENECK</span><strong>Read task type, oldest age, retries, and exceptions.</strong><small>Then separate network transfer, local storage, merge capacity, and Keeper/session problems.</small></div></Html>
      <Html pointerEvents="none" center position={[0, 3.88, -0.35]} distanceFactor={12}><div className="replica-mobile-summary"><span>REPLICA CATCH-UP</span><strong>Metadata queues work · part bytes move directly</strong><small>Diagnose task type, depth, oldest age, retries, and exceptions; recovery ends at the tested baseline.</small></div></Html>
      <Html pointerEvents="none" center position={[0, -0.68, 0]} distanceFactor={11}><span ref={status} className="foundry-label">REPLICA 1 COMMITS A COMPLETE IMMUTABLE PART</span></Html>
    </group>
  );
}

function KeeperQuorumVisualization() {
  const keeperNodes = useRef<Array<THREE.Group | null>>([]);
  const keeperMaterials = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const quorumLinks = useRef<Array<THREE.Group | null>>([]);
  const partitionWalls = useRef<Array<THREE.Mesh | null>>([]);
  const writePart = useRef<THREE.Group>(null);
  const readPart = useRef<THREE.Group>(null);
  const writeGate = useRef<THREE.Group>(null);
  const recoveryDeck = useRef<THREE.Group>(null);
  const queuedWriteRefs = useRef<Array<THREE.Group | null>>([]);
  const status = useRef<HTMLSpanElement>(null);
  const voterStatus = useRef<HTMLSpanElement>(null);
  const gateStatus = useRef<HTMLSpanElement>(null);
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  const recommendation = useAtlasStore((state) => state.recommendation);
  const getTime = useMachineTime();
  const keeperDecision = recommendation?.decisions.find((entry) => entry.mechanismId === "architecture.keeper");
  const recoveryLabel = keeperDecision?.title.toUpperCase() ?? "RESTORE A 2 / 3 MAJORITY";

  useEffect(() => () => {
    delete document.documentElement.dataset.keeperQuorumPhase;
    delete document.documentElement.dataset.keeperConnectedVoters;
    delete document.documentElement.dataset.keeperCoordination;
    delete document.documentElement.dataset.keeperQueuedWrites;
    delete document.documentElement.dataset.keeperRecommendation;
  }, []);
  useFrame(() => {
    const frame = keeperQuorumFrame(getTime(), reducedMotion);
    keeperNodes.current.forEach((node, index) => {
      if (!node) return;
      const connectivity = frame.voterConnectivity[index];
      node.position.y = THREE.MathUtils.lerp(-0.22, 0, connectivity);
      node.rotation.z = (index === 1 ? 0.12 : -0.12) * (1 - connectivity);
    });
    keeperMaterials.current.forEach((material, index) => {
      if (!material) return;
      const connectivity = frame.voterConnectivity[index];
      const connected = connectivity >= 0.999;
      material.color.set(connected ? (index === 0 ? COLORS.yellow : "#8F82CE") : COLORS.pressure);
      material.emissive.set(connected ? (index === 0 ? COLORS.yellow : "#8F82CE") : COLORS.pressure);
      material.emissiveIntensity = THREE.MathUtils.lerp(0.5, 0.22, connectivity);
      material.opacity = THREE.MathUtils.lerp(0.34, 1, connectivity);
      material.transparent = connectivity < 0.999;
    });
    quorumLinks.current.forEach((link, index) => { if (link) link.visible = frame.voterConnectivity[index + 1] >= 0.999; });
    partitionWalls.current.forEach((wall, index) => {
      if (!wall) return;
      const disconnected = 1 - frame.voterConnectivity[index + 1];
      wall.visible = disconnected > 0.001;
      const material = wall.material as THREE.MeshStandardMaterial;
      material.opacity = THREE.MathUtils.lerp(0, 0.76, disconnected);
    });
    if (writePart.current) {
      writePart.current.position.x = THREE.MathUtils.lerp(-5.05, 0.2, frame.writeProgress);
      writePart.current.position.y = 0.62 + Math.sin(frame.writeProgress * Math.PI) * 0.13;
    }
    if (readPart.current) {
      readPart.current.position.x = THREE.MathUtils.lerp(-4.95, 4.95, frame.readProgress);
      readPart.current.position.y = 0.48 + Math.sin(frame.readProgress * Math.PI) * 0.08;
    }
    if (writeGate.current) writeGate.current.rotation.z = THREE.MathUtils.lerp(0, Math.PI / 2, frame.coordinationAvailable ? 0 : 1);
    queuedWriteRefs.current.forEach((ticket, index) => {
      if (!ticket) return;
      ticket.visible = index < frame.queuedWrites;
      ticket.position.y = 0.52 + index * 0.2;
    });
    if (recoveryDeck.current) recoveryDeck.current.visible = reducedMotion || frame.stage === "restore" || frame.stage === "reconciled";
    if (voterStatus.current) voterStatus.current.textContent = `${frame.connectedVoters} / 3 VOTERS · ${frame.coordinationAvailable ? frame.connectedVoters === 2 ? "WRITABLE MAJORITY" : "MAJORITY AVAILABLE" : "NO MAJORITY"}`;
    if (gateStatus.current) gateStatus.current.textContent = frame.coordinationAvailable ? "REPLICATED WRITE GATE · OPEN" : "TABLE READ-ONLY · WRITE WAITS";
    document.documentElement.dataset.keeperQuorumPhase = frame.stage;
    document.documentElement.dataset.keeperConnectedVoters = String(frame.connectedVoters);
    document.documentElement.dataset.keeperCoordination = frame.coordinationAvailable ? "available" : "unavailable";
    document.documentElement.dataset.keeperQueuedWrites = String(frame.queuedWrites);
    document.documentElement.dataset.keeperRecommendation = keeperDecision ? "personalized" : "reviewed-default";
    const nextStatus = KEEPER_QUORUM_STATUS[frame.stage];
    if (status.current && status.current.textContent !== nextStatus) status.current.textContent = nextStatus;
  });

  return (
    <group position={[-0.55, 0.62, 0]}>
      <MachinePlate position={[0, 0.12, 0]} size={[12.25, 0.2, 5.95]} color="#D7D8D4" />

      <group position={[0, 3.25, -1.55]}>
        {[-1.45, 0, 1.45].map((x, index) => <group ref={(node) => { keeperNodes.current[index] = node; }} key={x} position={[x, 0, 0]}>
          <mesh castShadow><cylinderGeometry args={[0.55, 0.55, 0.92, 18]} /><meshStandardMaterial color="#303432" roughness={0.3} metalness={0.5} /></mesh>
          <mesh position={[0, 0.58, 0]}><sphereGeometry args={[0.18, 14, 10]} /><meshStandardMaterial ref={(material) => { keeperMaterials.current[index] = material; }} color={index === 0 ? COLORS.yellow : "#8F82CE"} emissive={index === 0 ? COLORS.yellow : "#8F82CE"} emissiveIntensity={0.22} /></mesh>
          <Html pointerEvents="none" center position={[0, -0.82, 0]} distanceFactor={9}><span className="keeper-node-label">K{index + 1}{index === 0 ? " · LEADER" : " · VOTER"}</span></Html>
        </group>)}
        {[[-1.45, 0], [0, 1.45]].map(([from, to], index) => <group ref={(node) => { quorumLinks.current[index] = node; }} key={index}><Line points={[[from, 0.18, 0], [to, 0.18, 0]]} color="#8F82CE" lineWidth={4} dashed dashSize={0.12} gapSize={0.08} /></group>)}
        {[-0.72, 0.72].map((x, index) => <mesh ref={(node) => { partitionWalls.current[index] = node; }} key={x} position={[x, 0.1, 0]} visible={false}><boxGeometry args={[0.08, 1.8, 1.5]} /><meshStandardMaterial color={COLORS.pressure} emissive={COLORS.pressure} emissiveIntensity={0.34} transparent opacity={0} /></mesh>)}
        <Html pointerEvents="none" center position={[0, 1.45, 0]} distanceFactor={10}><span ref={voterStatus} className="keeper-vote-label">3 / 3 VOTERS · MAJORITY AVAILABLE</span></Html>
      </group>

      <group position={[-3.72, 1.35, 0.55]}>
        <ReplicaRackFrame />
        {Array.from({ length: 5 }, (_, index) => <group key={index} position={[0, -0.78 + index * 0.39, 0]}><DataCassette color={index % 2 ? COLORS.cyan : COLORS.yellow} scale={[0.68, 0.58, 1.14]} /></group>)}
        <Html pointerEvents="none" center position={[0, -1.72, 1.34]} distanceFactor={10}><span className="replica-node-label">REPLICA A · LOCAL PARTS</span></Html>
      </group>
      <group position={[3.72, 1.35, 0.55]}>
        <ReplicaRackFrame />
        {Array.from({ length: 5 }, (_, index) => <group key={index} position={[0, -0.78 + index * 0.39, 0]}><DataCassette color={index % 2 ? COLORS.cyan : COLORS.yellow} scale={[0.68, 0.58, 1.14]} /></group>)}
        <Html pointerEvents="none" center position={[0, -1.72, 1.34]} distanceFactor={10}><span className="replica-node-label">REPLICA B · LOCAL PARTS</span></Html>
      </group>

      <Line points={[[ -5.2, 0.42, 1.72], [5.2, 0.42, 1.72]]} color={COLORS.cyan} lineWidth={6} />
      <group ref={readPart} position={[-4.95, 0.48, 1.72]}><DataCassette color={COLORS.cyan} scale={[0.5, 0.5, 0.5]} /></group>
      <Html pointerEvents="none" center position={[0, 0.02, 1.82]} distanceFactor={10}><span className="keeper-read-label">LOCAL READS · STORED PARTS · NO KEEPER DATA HOP</span></Html>

      <Line points={[[ -5.2, 0.56, -0.15], [0.35, 0.56, -0.15]]} color={COLORS.yellow} lineWidth={6} />
      <group ref={writePart} position={[-5.05, 0.62, -0.15]}><DataCassette color={COLORS.yellow} scale={[0.62, 0.62, 0.62]} /></group>
      <group position={[0.42, 0.78, -0.15]}>
        <group ref={writeGate}><RoundedBox args={[0.18, 1.52, 1.05]} radius={0.055} smoothness={3}><meshStandardMaterial color={COLORS.pressure} emissive={COLORS.pressure} emissiveIntensity={0.42} roughness={0.3} metalness={0.42} /></RoundedBox></group>
        <Html pointerEvents="none" center position={[0, -0.92, 0]} distanceFactor={9}><span ref={gateStatus} className="keeper-write-label">REPLICATED WRITE GATE · OPEN</span></Html>
      </group>
      <group position={[-0.5, 0.52, -0.82]}>
        {Array.from({ length: 5 }, (_, index) => <group ref={(node) => { queuedWriteRefs.current[index] = node; }} key={index} visible={false}><RoundedBox args={[0.8, 0.14, 0.5]} radius={0.03} smoothness={2}><meshStandardMaterial color={index % 2 ? COLORS.yellow : COLORS.pressure} roughness={0.38} /></RoundedBox></group>)}
      </group>

      <group ref={recoveryDeck} visible={false}>
        <MachinePlate position={[1.25, 0.2, 2.35]} size={[5.35, 0.14, 0.62]} color="#E8E4F4" />
        <Html pointerEvents="none" center position={[1.25, 0.92, 2.35]} distanceFactor={10}><span className="keeper-majority-label" data-personalized={Boolean(keeperDecision)}>{recoveryLabel}</span></Html>
        <Html pointerEvents="none" center position={[4.26, 0.42, 2.35]} distanceFactor={9}><span className="keeper-domain-label">INDEPENDENT FAILURE DOMAINS · VERIFY 1-VOTER LOSS</span></Html>
      </group>

      <Html pointerEvents="none" center position={[-3.25, 4.72, -0.14]} distanceFactor={12}><div className="keeper-cause-callout"><span>THE GOTCHA</span><strong>A running Keeper process is not the same as a writable majority.</strong><small>With only one of three voters connected, new replication coordination cannot safely commit.</small></div></Html>
      <Html pointerEvents="none" center position={[2.62, 4.65, -0.08]} distanceFactor={11}><div className="keeper-recovery-callout"><span>DESIGN FOR RECOVERY</span><strong>Keep three voters in independent failure domains.</strong><small>Monitor quorum state and sessions, then prove one-voter loss keeps a two-voter majority before production.</small></div></Html>
      <Html pointerEvents="none" center position={[0, 3.92, -0.2]} distanceFactor={12}><div className="keeper-mobile-summary"><span>KEEPER QUORUM LOSS</span><strong>1 / 3 pauses writes · 2 / 3 restores coordination</strong><small>Local parts and reads stay on ClickHouse replicas; Keeper carries coordination metadata.</small></div></Html>
      <Html pointerEvents="none" center position={[0, -0.72, 0]} distanceFactor={11}><span ref={status} className="foundry-label">3 / 3 KEEPER VOTERS COORDINATE REPLICATION</span></Html>
    </group>
  );
}

function MemoryCacheTower({ id, pressure }: { id: MechanismId; pressure: boolean }) {
  const block = useRef<THREE.Group>(null);
  const spill = useRef<THREE.Group>(null);
  const getTime = useMachineTime();
  useFrame(() => {
    const cycle = ((getTime() * (pressure ? 0.16 : 0.34)) % 1 + 1) % 1;
    if (block.current) {
      block.current.position.y = 0.72 + cycle * 3.15;
      block.current.position.x = -2.55 + Math.sin(cycle * Math.PI) * 0.42;
      block.current.scale.setScalar(0.82 + Math.sin(cycle * Math.PI) * 0.14);
    }
    if (spill.current) {
      spill.current.position.x = 1.45 + ((getTime() * 0.38) % 1) * 2.1;
      spill.current.position.y = 0.62 - Math.sin(((getTime() * 0.38) % 1) * Math.PI) * 0.18;
    }
  });
  const active = (mechanism: MechanismId) => id === mechanism ? COLORS.yellow : "#7A807D";
  const layers: Array<{ id: MechanismId; y: number; label: string; color: string }> = [
    { id: "memory.os-page-cache", y: 0.8, label: "OS PAGE CACHE", color: "#7E98A4" },
    { id: "memory.mark-cache", y: 1.65, label: "MARK CACHE", color: COLORS.cyan },
    { id: "memory.uncompressed-cache", y: 2.5, label: "UNCOMPRESSED", color: "#A48AE3" },
    { id: "memory.query-cache", y: 3.35, label: "QUERY RESULT", color: COLORS.yellow },
  ];
  return (
    <group position={[0.2, 0.62, 0]}>
      <MachinePlate position={[0, 0.14, 0]} size={[9.2, 0.22, 4.55]} color="#D5D6D3" />
      <group position={[-2.25, 0.2, 0]}>
        <MachinePlate position={[0, 2.15, -1.7]} size={[0.28, 4.55, 0.36]} />
        {layers.map((layer) => (
          <group key={layer.id} position={[0, layer.y, 0]}>
            <RoundedBox args={[3.7, 0.58, 2.55]} radius={0.14} smoothness={4} castShadow>
              <meshPhysicalMaterial color={id === layer.id ? layer.color : "#B5BBB8"} transparent opacity={id === layer.id ? 0.76 : 0.32} roughness={0.18} transmission={0.08} />
            </RoundedBox>
            <Html pointerEvents="none" center position={[0, 0, 1.52]} distanceFactor={9}><span className="machine-stage-label">{layer.label}</span></Html>
          </group>
        ))}
        <group ref={block}><DataCassette color={pressure ? COLORS.pressure : COLORS.yellow} scale={[0.62, 0.62, 0.62]} /></group>
      </group>
      <group position={[1.35, 2.15, 0]}>
        <RoundedBox args={[1.85, 3.7, 2.55]} radius={0.2} smoothness={4} castShadow>
          <meshStandardMaterial color={active("memory.memory-tracker")} roughness={0.28} metalness={0.48} />
        </RoundedBox>
        <InstrumentGauge position={[0, 0.48, 1.36]} value={pressure ? 0.96 : 0.48} color={pressure ? COLORS.pressure : COLORS.yellow} label="MEMORY" />
        <DataBars count={26} spread={[1.2, 2.25, 1.55]} offset={[0, -1.05, 0]} color={pressure ? COLORS.pressure : COLORS.cyan} />
        <Html pointerEvents="none" center position={[0, 2.35, 0]} distanceFactor={9}><span className="machine-stage-label">QUERY · USER · SERVER</span></Html>
      </group>
      <group position={[3.15, 0.8, 0]}>
        <Line points={[[ -0.75, .35, 0], [1.1, .35, 0]]} color={id === "memory.external-spill" ? COLORS.pressure : "#555A58"} lineWidth={6} />
        <group ref={spill}><DataCassette color={id === "memory.external-spill" || pressure ? COLORS.pressure : "#9EA3A0"} scale={[0.58, 0.58, 0.58]} /></group>
        <RoundedBox args={[1.65, 1.45, 2.5]} radius={0.14} smoothness={4} position={[1.2, 0.55, 0]} castShadow>
          <meshStandardMaterial color={id === "memory.external-spill" ? COLORS.pressure : "#616664"} roughness={0.38} metalness={0.36} />
        </RoundedBox>
        <Html pointerEvents="none" center position={[1.2, 1.75, 0]} distanceFactor={9}><span className="machine-stage-label">TEMPORARY SPILL</span></Html>
      </group>
      <MechanismTitle id={id} eyebrow="CACHE & MEMORY TOWER" />
    </group>
  );
}

function QueryExecutionLab({ id, pressure }: { id: MechanismId; pressure: boolean }) {
  const query = useRef<THREE.Group>(null);
  const scheduler = useRef<THREE.Group>(null);
  const getTime = useMachineTime();
  useFrame(() => {
    const cycle = ((getTime() * (pressure ? 0.2 : 0.46)) % 1 + 1) % 1;
    if (query.current) {
      query.current.position.x = -3.7 + cycle * 7.25;
      query.current.position.y = 0.92 + Math.sin(cycle * Math.PI) * 0.42;
    }
    if (scheduler.current) scheduler.current.rotation.z = Math.sin(getTime() * 0.72) * (pressure ? 0.22 : 0.08);
  });
  const selected = (mechanism: MechanismId, color: string) => id === mechanism ? color : "#777D7A";
  return (
    <group position={[0.2, 0.64, 0]}>
      <MachinePlate position={[0, 0.14, 0]} size={[9.25, 0.22, 4.55]} color="#D5D6D3" />
      <group position={[-3.15, 1.55, 0]}>
        {Array.from({ length: 5 }, (_, index) => (
          <RoundedBox key={index} args={[1.4 - index * 0.12, 0.38, 2.5 - index * 0.28]} radius={0.07} smoothness={3} position={[0, index * 0.55, 0]} castShadow>
            <meshStandardMaterial color={selected("execution.analyzer", index % 2 ? COLORS.cyan : COLORS.yellow)} roughness={0.38} metalness={0.18} />
          </RoundedBox>
        ))}
        <Html pointerEvents="none" center position={[0, 3.05, 0]} distanceFactor={9}><span className="machine-stage-label">QUERY TREE</span></Html>
      </group>
      <group position={[-0.8, 1.6, 0]}>
        <RoundedBox args={[1.4, 3.25, 3.15]} radius={0.16} smoothness={4} castShadow>
          <meshStandardMaterial color={selected("execution.explain-plan", "#15171A")} roughness={0.28} metalness={0.5} />
        </RoundedBox>
        {[0, 1, 2, 3].map((index) => <mesh key={index} position={[0.78, -1.05 + index * 0.7, 0]}><boxGeometry args={[0.15, 0.16, 2.4 - index * 0.34]} /><meshStandardMaterial color={index % 2 ? COLORS.cyan : COLORS.yellow} emissive={index % 2 ? COLORS.cyan : COLORS.yellow} emissiveIntensity={0.32} /></mesh>)}
        <Html pointerEvents="none" center position={[0, 2.05, 0]} distanceFactor={9}><span className="machine-stage-label">EXPLAIN PLAN</span></Html>
      </group>
      <group position={[1.4, 1.05, 0]}>
        <Line points={[[ -1.3, 1.3, -1.25], [0, .42, 0], [1.2, 1.3, -1.25]]} color={selected("execution.join-strategy", COLORS.yellow)} lineWidth={6} />
        <Line points={[[ -1.3, 1.3, 1.25], [0, .42, 0], [1.2, 1.3, 1.25]]} color={selected("execution.sort-aggregate", COLORS.cyan)} lineWidth={6} />
        <RoundedBox args={[1.15, 1.5, 1.7]} radius={0.14} smoothness={4} castShadow>
          <meshStandardMaterial color="#15171A" roughness={0.24} metalness={0.56} />
        </RoundedBox>
        <Html pointerEvents="none" center position={[0, 2.15, 0]} distanceFactor={9}><span className="machine-stage-label">JOIN · AGGREGATE</span></Html>
      </group>
      <group position={[3.45, 1.1, 0]}>
        {[-1.15, -0.38, 0.38, 1.15].map((z, index) => <Line key={z} points={[[ -1, .4, z], [1, .4, z]]} color={selected("execution.processor-pipeline", index % 2 ? COLORS.cyan : COLORS.yellow)} lineWidth={5} />)}
        <group ref={scheduler} position={[0, 1.52, 0]}>
          <RoundedBox args={[2.35, 0.62, 3.25]} radius={0.12} smoothness={4} castShadow>
            <meshStandardMaterial color={selected("execution.workload-scheduler", pressure ? COLORS.pressure : "#15171A")} roughness={0.28} metalness={0.48} />
          </RoundedBox>
        </group>
        <Html pointerEvents="none" center position={[0, 2.35, 0]} distanceFactor={9}><span className="machine-stage-label">PROCESSOR LANES</span></Html>
      </group>
      <group ref={query}><DataCassette color={pressure ? COLORS.pressure : COLORS.yellow} scale={[0.52, 0.52, 0.52]} /></group>
      <MechanismTitle id={id} eyebrow="QUERY EXECUTION LAB" />
    </group>
  );
}

function DurabilityDock({ id, pressure }: { id: MechanismId; pressure: boolean }) {
  const part = useRef<THREE.Group>(null);
  const ack = useRef<THREE.Group>(null);
  const commitGate = useRef<THREE.Group>(null);
  const getTime = useMachineTime();
  useFrame(() => {
    const cycle = ((getTime() * (pressure ? 0.18 : 0.38)) % 1 + 1) % 1;
    if (part.current) {
      part.current.position.x = -3.65 + Math.min(1, cycle * 1.55) * 5.1;
      part.current.position.y = 0.9 + Math.sin(Math.min(1, cycle * 1.55) * Math.PI) * 0.22;
    }
    if (ack.current) {
      const returnProgress = Math.max(0, (cycle - 0.68) / 0.32);
      ack.current.visible = cycle >= 0.68;
      ack.current.position.x = 3.55 - returnProgress * 7.1;
    }
    if (commitGate.current) commitGate.current.scale.y = 0.94 + Math.sin(getTime() * 0.9) * 0.08;
  });
  const quorum = id === "durability.insert-quorum";
  const log = id === "durability.replication-log";
  return (
    <group position={[0.2, 0.64, 0]}>
      <MachinePlate position={[0, 0.14, 0]} size={[9.25, 0.22, 4.55]} color="#D5D6D3" />
      <Line points={[[ -4, .56, 0], [4, .56, 0]]} color="#25282B" lineWidth={7} />
      <group position={[-3.45, 1.35, 0]}>
        <RoundedBox args={[1.4, 2.3, 2.8]} radius={0.16} smoothness={4} castShadow><meshStandardMaterial color={id === "durability.async-ack" ? COLORS.yellow : "#727875"} roughness={0.34} metalness={0.34} /></RoundedBox>
        <DataBars count={18} spread={[0.85, 1.2, 1.55]} offset={[0, -0.48, 0]} color={pressure ? COLORS.pressure : COLORS.cyan} />
        <Html pointerEvents="none" center position={[0, 1.65, 0]} distanceFactor={9}><span className="machine-stage-label">ASYNC BUFFER</span></Html>
      </group>
      <group ref={commitGate} position={[-0.75, 1.55, 0]}>
        <RoundedBox args={[1.25, 2.8, 3.15]} radius={0.14} smoothness={4} castShadow><meshStandardMaterial color={id === "durability.part-commit" ? COLORS.yellow : "#15171A"} roughness={0.25} metalness={0.58} /></RoundedBox>
        <mesh position={[0.72, 0, 0]}><boxGeometry args={[0.16, 1.9, 2.5]} /><meshStandardMaterial color={COLORS.cyan} emissive={COLORS.cyan} emissiveIntensity={0.36} /></mesh>
        <Html pointerEvents="none" center position={[0, 1.85, 0]} distanceFactor={9}><span className="machine-stage-label">ATOMIC PART COMMIT</span></Html>
      </group>
      <group position={[2.55, 1.25, 0]}>
        {[-1.25, 0, 1.25].map((z, index) => (
          <group key={z} position={[0, 0, z]}>
            <RoundedBox args={[1.35, 2.3, 0.9]} radius={0.12} smoothness={4} castShadow>
              <meshStandardMaterial color={quorum && index < 2 ? COLORS.yellow : log ? COLORS.cyan : "#727875"} roughness={0.28} metalness={0.42} />
            </RoundedBox>
            <mesh position={[0.72, 0.55, 0]}><sphereGeometry args={[0.12, 12, 8]} /><meshStandardMaterial color={index === 2 && pressure ? COLORS.pressure : COLORS.yellow} emissive={index === 2 && pressure ? COLORS.pressure : COLORS.yellow} emissiveIntensity={0.65} /></mesh>
          </group>
        ))}
        <Line points={[[ -1.25, 2.3, -1.25], [-1.25, 2.3, 1.25]]} color={log ? COLORS.cyan : "#777D7A"} lineWidth={4} />
        <Html pointerEvents="none" center position={[0, 3.05, 0]} distanceFactor={9}><span className="machine-stage-label">REPLICA ACKS · {quorum ? "2 / 3" : "ASYNC"}</span></Html>
      </group>
      <group ref={part}><DataCassette color={pressure ? COLORS.pressure : COLORS.yellow} scale={[0.72, 0.72, 0.72]} /></group>
      <group ref={ack} position={[3.55, 2.4, -1.75]}>
        <mesh><octahedronGeometry args={[0.24, 0]} /><meshStandardMaterial color={COLORS.cyan} emissive={COLORS.cyan} emissiveIntensity={0.75} /></mesh>
        <Html pointerEvents="none" center position={[0, 0.55, 0]} distanceFactor={8}><span className="machine-stage-label">ACK</span></Html>
      </group>
      <MechanismTitle id={id} eyebrow="COMMIT & QUORUM DOCK" />
    </group>
  );
}

function StorageTierExchange({ id, pressure }: { id: MechanismId; pressure: boolean }) {
  const elevator = useRef<THREE.Group>(null);
  const getTime = useMachineTime();
  useFrame(() => {
    if (!elevator.current) return;
    const cycle = ((getTime() * (pressure ? 0.14 : 0.3)) % 1 + 1) % 1;
    elevator.current.position.x = -2.55 + cycle * 5.4;
    elevator.current.position.y = 0.82 + Math.sin(cycle * Math.PI) * 1.45;
    elevator.current.rotation.y = cycle * Math.PI * 0.35;
  });
  const active = (mechanism: MechanismId, color: string) => id === mechanism ? color : "#777D7A";
  return (
    <group position={[0.2, 0.62, 0]}>
      <MachinePlate position={[0, 0.14, 0]} size={[9.25, 0.22, 4.55]} color="#D5D6D3" />
      <group position={[-3.15, 1.15, 0]}>
        {[-1.05, 0, 1.05].map((z, index) => <RoundedBox key={z} args={[1.8, 1.85, 0.78]} radius={0.12} smoothness={4} position={[0, index * 0.3, z]} castShadow><meshStandardMaterial color={active("storage.disks-volumes", index === 0 ? COLORS.yellow : "#596C78")} roughness={0.38} metalness={0.42} /></RoundedBox>)}
        <Html pointerEvents="none" center position={[0, 2.65, 0]} distanceFactor={9}><span className="machine-stage-label">DISKS · VOLUMES</span></Html>
      </group>
      <group position={[-0.55, 1.35, 0]}>
        <RoundedBox args={[1.15, 2.7, 3.3]} radius={0.14} smoothness={4} castShadow><meshStandardMaterial color={active("storage.storage-policy", "#15171A")} roughness={0.28} metalness={0.52} /></RoundedBox>
        {[-0.8, 0, 0.8].map((z, index) => <mesh key={z} position={[0.66, -0.65 + index * 0.7, z]}><boxGeometry args={[0.14, 0.2, 0.72]} /><meshStandardMaterial color={index === 0 ? COLORS.yellow : index === 1 ? COLORS.cyan : "#A48AE3"} emissive={index === 0 ? COLORS.yellow : index === 1 ? COLORS.cyan : "#A48AE3"} emissiveIntensity={0.32} /></mesh>)}
        <Html pointerEvents="none" center position={[0, 1.85, 0]} distanceFactor={9}><span className="machine-stage-label">STORAGE POLICY</span></Html>
      </group>
      <group position={[2.65, 1.15, 0]}>
        {[-1.05, 0, 1.05].map((z, index) => <mesh key={z} position={[0, index * 0.18, z]} castShadow><cylinderGeometry args={[0.82, 0.98, 1.75, 18]} /><meshStandardMaterial color={active("storage.object-storage", "#6B8290")} roughness={0.4} metalness={0.28} /></mesh>)}
        <RoundedBox args={[2.25, 0.42, 3.5]} radius={0.1} smoothness={3} position={[-0.1, 2.15, 0]} castShadow><meshStandardMaterial color={active("storage.filesystem-cache", COLORS.cyan)} roughness={0.3} metalness={0.38} /></RoundedBox>
        <Html pointerEvents="none" center position={[0, 2.9, 0]} distanceFactor={9}><span className="machine-stage-label">OBJECTS + FILESYSTEM CACHE</span></Html>
      </group>
      <group position={[0.85, 0.85, -1.65]}>
        <RoundedBox args={[1.7, 1.35, 0.8]} radius={0.12} smoothness={4} castShadow><meshStandardMaterial color={active("storage.compression-codecs", pressure ? COLORS.pressure : COLORS.yellow)} roughness={0.25} metalness={0.55} /></RoundedBox>
        <Html pointerEvents="none" center position={[0, 1.1, 0]} distanceFactor={9}><span className="machine-stage-label">COLUMN CODECS</span></Html>
      </group>
      <group ref={elevator}><DataCassette color={pressure ? COLORS.pressure : COLORS.yellow} scale={[0.7, 0.7, 0.7]} /></group>
      <MechanismTitle id={id} eyebrow="STORAGE TIER EXCHANGE" />
    </group>
  );
}

function SystemTableObservatory({ id, pressure }: { id: MechanismId; pressure: boolean }) {
  const sweep = useRef<THREE.Mesh>(null);
  const getTime = useMachineTime();
  useFrame(() => {
    if (!sweep.current) return;
    sweep.current.position.x = -3.55 + ((getTime() * (pressure ? 0.82 : 0.48)) % 1) * 7.1;
    sweep.current.scale.y = 0.85 + Math.sin(getTime() * 1.4) * 0.12;
  });
  const tables: Array<{ id: MechanismId; label: string; x: number; z: number; color: string }> = [
    { id: "observability.query-log", label: "QUERY LOG", x: -2.7, z: -1.05, color: COLORS.cyan },
    { id: "observability.part-log", label: "PART LOG", x: 0, z: -1.05, color: COLORS.yellow },
    { id: "observability.merges", label: "MERGES", x: 2.7, z: -1.05, color: "#E6A52E" },
    { id: "observability.replication-queue", label: "REPLICA QUEUE", x: -2.7, z: 1.1, color: "#A48AE3" },
    { id: "observability.processes", label: "PROCESSES", x: 0, z: 1.1, color: COLORS.pressure },
    { id: "observability.profile-events", label: "PROFILE EVENTS", x: 2.7, z: 1.1, color: "#8CCF83" },
  ];
  return (
    <group position={[0.2, 0.62, 0]}>
      <MachinePlate position={[0, 0.14, 0]} size={[9.25, 0.22, 4.65]} color="#D5D6D3" />
      {tables.map((table, index) => {
        const active = id === table.id;
        const value = pressure && (table.id === "observability.merges" || table.id === "observability.replication-queue" || table.id === "observability.processes") ? 0.94 : 0.32 + (index % 3) * 0.18;
        return (
          <group key={table.id} position={[table.x, 1.2, table.z]}>
            <RoundedBox args={[2.15, 1.75, 1.55]} radius={0.15} smoothness={4} castShadow>
              <meshStandardMaterial color={active ? "#15171A" : "#777D7A"} roughness={0.3} metalness={0.42} />
            </RoundedBox>
            <InstrumentGauge position={[0, 0.18, 0.84]} value={value} color={pressure && value > 0.9 ? COLORS.pressure : table.color} />
            <DataBars count={12} spread={[1.35, 0.7, 0.75]} offset={[0, -0.62, 0]} color={active ? table.color : "#B6BAB7"} />
            <Html pointerEvents="none" center position={[0, 1.25, 0]} distanceFactor={9}><span className="machine-stage-label">{table.label}</span></Html>
          </group>
        );
      })}
      <mesh ref={sweep} position={[-3.55, 1.45, 0]}><boxGeometry args={[0.1, 3.55, 4.1]} /><meshStandardMaterial color={pressure ? COLORS.pressure : COLORS.cyan} emissive={pressure ? COLORS.pressure : COLORS.cyan} emissiveIntensity={0.58} transparent opacity={0.35} /></mesh>
      <MechanismTitle id={id} eyebrow="SYSTEM-TABLE OBSERVATORY" />
    </group>
  );
}

function FloorInstrumentation({ pressure }: { pressure: boolean }) {
  return (
    <group position={[0, 0.13, 0]}>
      <Instances limit={32} range={32}>
        <boxGeometry args={[0.05, 0.018, 0.32]} />
        <meshBasicMaterial color={pressure ? COLORS.pressure : "#8B918D"} transparent opacity={0.48} />
        {Array.from({ length: 32 }, (_, index) => {
          const angle = (index / 32) * Math.PI * 2;
          const radius = index % 2 === 0 ? 7.72 : 7.48;
          return <Instance key={index} position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]} rotation={[0, -angle, 0]} scale={[1, 1, index % 4 === 0 ? 1.7 : 1]} />;
        })}
      </Instances>
    </group>
  );
}

function TinyPartArtifact({ retired = false }: { retired?: boolean }) {
  const shell = retired ? "#9EA39F" : "#E7E9E5";
  const accent = retired ? "#737875" : COLORS.pressure;
  return (
    <group>
      <RoundedBox args={[0.48, 0.26, 0.38]} radius={0.05} smoothness={2} castShadow>
        <meshStandardMaterial color={shell} roughness={0.4} metalness={0.1} />
      </RoundedBox>
      <mesh position={[0, 0.15, 0]}><boxGeometry args={[0.32, 0.04, 0.25]} /><meshBasicMaterial color={accent} /></mesh>
      <mesh position={[0, -0.01, 0.195]}><boxGeometry args={[0.28, 0.12, 0.025]} /><meshBasicMaterial color={retired ? "#7F8581" : COLORS.cyan} /></mesh>
    </group>
  );
}

function TinyInsertStormVisualization() {
  const rowRefs = useRef<Array<THREE.Group | null>>([]);
  const partRefs = useRef<Array<THREE.Group | null>>([]);
  const retiredRefs = useRef<Array<THREE.Group | null>>([]);
  const mergeRotor = useRef<THREE.Group>(null);
  const throttleGate = useRef<THREE.Group>(null);
  const bufferFill = useRef<THREE.Group>(null);
  const recoveryPart = useRef<THREE.Group>(null);
  const status = useRef<HTMLSpanElement>(null);
  const countStatus = useRef<HTMLSpanElement>(null);
  const previousStage = useRef("");
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  const recommendation = useAtlasStore((state) => state.recommendation);
  const getTime = useMachineTime();
  const recommendedIngress = recommendation?.path.find((id) => id === "ingestion.client-batching" || id === "ingestion.async-buffer" || id === "ingestion.clickpipes");
  const recommendedLabel = recommendedIngress === "ingestion.client-batching"
    ? "CLIENT BATCHING"
    : recommendedIngress === "ingestion.clickpipes"
      ? "KEEP CONNECTOR BATCHING"
      : recommendedIngress === "ingestion.async-buffer"
        ? "ASYNC INSERT BUFFER"
        : "BATCH OR ASYNC BUFFER";
  const recommendationKey = recommendedIngress?.replace("ingestion.", "") ?? "unselected";

  useEffect(() => () => {
    delete document.documentElement.dataset.tinyInsertPhase;
    delete document.documentElement.dataset.tinyInsertBacklog;
    delete document.documentElement.dataset.tinyInsertRecommendation;
  }, []);

  useFrame(() => {
    const frame = tinyInsertStormFrame(getTime(), reducedMotion);
    document.documentElement.dataset.tinyInsertPhase = frame.stage;
    document.documentElement.dataset.tinyInsertBacklog = String(frame.backlogParts);
    document.documentElement.dataset.tinyInsertRecommendation = recommendationKey;

    rowRefs.current.forEach((row, index) => {
      if (!row) return;
      const progress = THREE.MathUtils.clamp(frame.rowProgress * 1.52 - index * 0.065, 0, 1);
      row.visible = progress < 0.995 && frame.stage !== "recover";
      row.position.x = THREE.MathUtils.lerp(-5.15, -3.55, progress);
      row.position.y = 0.76 + Math.sin(progress * Math.PI) * (reducedMotion ? 0 : 0.13);
      row.position.z = -1.38 + ((index % 3) - 1) * 0.28;
      row.scale.setScalar(0.7 + progress * 0.3);
    });

    partRefs.current.forEach((part, index) => {
      if (!part) return;
      const visible = index < frame.backlogParts;
      const column = index % 6;
      const row = Math.floor(index / 6);
      part.visible = visible;
      part.position.set(-1.55 + column * 0.58, 0.62 + row * 0.31, -1.68 + row * 0.43);
      part.scale.setScalar(visible ? 0.78 : 0.001);
      part.rotation.y = ((index % 5) - 2) * 0.025;
    });

    retiredRefs.current.forEach((part, index) => {
      if (!part) return;
      const visible = index < frame.retiredParts;
      part.visible = visible;
      part.position.x = THREE.MathUtils.lerp(3.48, 4.42 + index * 0.48, frame.mergeProgress);
      part.position.y = 0.62 + Math.sin(frame.mergeProgress * Math.PI) * (reducedMotion ? 0 : 0.16);
      part.scale.setScalar(visible ? 0.72 : 0.001);
    });

    if (mergeRotor.current) mergeRotor.current.rotation.x = frame.mergeProgress * Math.PI * 5;
    if (throttleGate.current) {
      throttleGate.current.rotation.z = THREE.MathUtils.lerp(0, Math.PI / 2, frame.throttleProgress);
      throttleGate.current.position.y = 1.12 + frame.throttleProgress * 0.18;
    }
    if (bufferFill.current) {
      bufferFill.current.scale.y = Math.max(0.04, frame.batchFillRatio);
      bufferFill.current.position.y = 0.46 + frame.batchFillRatio * 0.42;
    }
    if (recoveryPart.current) {
      recoveryPart.current.visible = frame.recoveryProgress > 0.01;
      recoveryPart.current.position.x = THREE.MathUtils.lerp(-0.65, 3.95, frame.recoveryProgress);
      recoveryPart.current.position.y = 0.76 + Math.sin(frame.recoveryProgress * Math.PI) * (reducedMotion ? 0 : 0.18);
      recoveryPart.current.scale.setScalar(0.76 + frame.recoveryProgress * 0.24);
    }
    if (countStatus.current) countStatus.current.textContent = `${frame.createdParts} CREATED · ${frame.retiredParts} RETIRED · ${frame.backlogParts} WAITING`;
    const nextStatus = ({
      arrive: "INDEPENDENT WRITERS SEND SINGLE-ROW INSERTS",
      stamp: "EACH INSERT COMMITS ONE TINY IMMUTABLE PART",
      backlog: "PART CREATION OUTRUNS BACKGROUND MERGES",
      throttle: "PART LIMITS THROTTLE WRITES · THE LIMIT IS THE ALARM",
      recover: `${recommendedLabel}: MANY ROWS BECOME ONE USEFUL PART`,
    } as const)[frame.stage];
    if (previousStage.current !== frame.stage || status.current?.textContent !== nextStatus) {
      previousStage.current = frame.stage;
      if (status.current) status.current.textContent = nextStatus;
    }
  });

  return (
    <group position={[-0.35, 0.62, 0]}>
      <MachinePlate position={[0, 0.12, -1.25]} size={[12.1, 0.2, 2.35]} color="#D7D8D4" />
      <MachinePlate position={[0, 0.12, 1.55]} size={[12.1, 0.2, 1.95]} color="#E9EAE6" />

      <Line points={[[ -5.5, 0.34, -1.38], [4.95, 0.34, -1.38]]} color="#3A3E3C" lineWidth={4} />
      {Array.from({ length: 9 }, (_, index) => <group ref={(node) => { rowRefs.current[index] = node; }} key={index} position={[-5.15, 0.76, -1.38]}>
        <mesh castShadow><boxGeometry args={[0.22, 0.22, 0.22]} /><meshStandardMaterial color={COLORS.yellow} emissive={COLORS.yellow} emissiveIntensity={0.25} roughness={0.36} /></mesh>
      </group>)}

      <group position={[-3.28, 1.02, -1.38]}>
        <RoundedBox args={[0.66, 1.62, 1.24]} radius={0.1} smoothness={3} castShadow><meshStandardMaterial color="#252927" roughness={0.27} metalness={0.52} /></RoundedBox>
        <mesh position={[0.36, 0, 0]}><boxGeometry args={[0.09, 1.08, 0.78]} /><meshStandardMaterial color={COLORS.pressure} emissive={COLORS.pressure} emissiveIntensity={0.4} /></mesh>
        <Html pointerEvents="none" center position={[0, 1.22, 0]} distanceFactor={10}><span className="tiny-insert-label">ONE INSERT → ONE PART</span></Html>
      </group>

      {Array.from({ length: 18 }, (_, index) => <group ref={(node) => { partRefs.current[index] = node; }} key={index} visible={false}><TinyPartArtifact /></group>)}
      <Html pointerEvents="none" center position={[0.05, 1.98, -1.48]} distanceFactor={10}><span ref={countStatus} className="tiny-insert-count">1 CREATED · 0 RETIRED · 1 WAITING</span></Html>

      <group position={[3.1, 1.02, -1.38]}>
        <RoundedBox args={[0.86, 1.64, 1.45]} radius={0.12} smoothness={4} castShadow><meshStandardMaterial color="#15171A" roughness={0.24} metalness={0.58} /></RoundedBox>
        <group ref={mergeRotor} rotation={[0, 0, Math.PI / 4]}>
          {[0, Math.PI / 2].map((rotation) => <mesh key={rotation} rotation={[rotation, 0, 0]}><torusGeometry args={[0.34, 0.09, 10, 24]} /><meshStandardMaterial color={rotation === 0 ? COLORS.cyan : COLORS.yellow} emissive={rotation === 0 ? COLORS.cyan : COLORS.yellow} emissiveIntensity={0.3} /></mesh>)}
        </group>
        <Html pointerEvents="none" center position={[0, 1.24, 0]} distanceFactor={10}><span className="tiny-merge-label">BACKGROUND MERGE · SLOWER</span></Html>
      </group>
      {[0, 1].map((index) => <group ref={(node) => { retiredRefs.current[index] = node; }} key={index} visible={false}><TinyPartArtifact retired /></group>)}

      <group ref={throttleGate} position={[-4.05, 1.12, -1.38]}>
        <RoundedBox args={[0.16, 1.8, 1.42]} radius={0.05} smoothness={2} castShadow><meshStandardMaterial color={COLORS.pressure} emissive={COLORS.pressure} emissiveIntensity={0.42} /></RoundedBox>
        <Html pointerEvents="none" center position={[0, 1.25, 0]} distanceFactor={10}><span className="tiny-throttle-label">INSERT THROTTLE</span></Html>
      </group>

      <Line points={[[ -5.35, 0.36, 1.58], [4.85, 0.36, 1.58]]} color={COLORS.cyan} lineWidth={5} />
      <group position={[-3.15, 1.02, 1.58]}>
        <RoundedBox args={[2.1, 1.68, 1.28]} radius={0.16} smoothness={4} castShadow><meshPhysicalMaterial color="#E7F5F3" transparent opacity={0.58} transmission={0.08} roughness={0.2} /></RoundedBox>
        <group ref={bufferFill} position={[0, 0.46, 0]} scale={[1, 0.04, 1]}>
          <DataBars count={18} spread={[1.46, 0.86, 0.72]} offset={[0, -0.44, 0]} scale={[0.08, 0.17, 0.08]} color={COLORS.cyan} />
        </group>
        <Html pointerEvents="none" center position={[0, 1.27, 0]} distanceFactor={10}><span className="tiny-recovery-label" data-method={recommendationKey}>{recommendedLabel}</span></Html>
      </group>
      <group ref={recoveryPart} position={[-0.65, 0.76, 1.58]} visible={false}><FoundryPartArtifact accent={COLORS.cyan} secondaryAccent={COLORS.yellow} /></group>
      <group position={[4.35, 0.5, 1.58]}>
        <RoundedBox args={[1.55, 0.18, 1.2]} radius={0.07} smoothness={3}><meshStandardMaterial color="#E7E9E5" roughness={0.5} /></RoundedBox>
        <Html pointerEvents="none" center position={[0, 0.62, 0]} distanceFactor={10}><span className="tiny-useful-part-label">ONE USEFUL PART</span></Html>
      </group>

      <Html pointerEvents="none" center position={[-3.15, 4.0, -1.35]} distanceFactor={12}>
        <div className="tiny-insert-callout"><span>THE GOTCHA</span><strong>Every tiny insert creates storage work.</strong><small>New immutable parts arrive faster than eligible background merges can consolidate them.</small></div>
      </Html>
      <Html pointerEvents="none" center position={[2.85, 3.92, -1.3]} distanceFactor={11}>
        <div className="tiny-insert-recovery-callout"><span>THE EXIT</span><strong>{recommendedLabel}</strong><small>Coordinate rows before the flush. Raising part limits only delays the same pressure.</small></div>
      </Html>
      <Html pointerEvents="none" center position={[0, 3.82, -1.35]} distanceFactor={12}>
        <div className="tiny-insert-mobile-summary"><span>TINY INSERT STORM</span><strong>Many tiny parts → merge backlog</strong><small>{recommendedLabel} turns many rows into one useful part.</small></div>
      </Html>
      <Html pointerEvents="none" center position={[0, -0.68, 0]} distanceFactor={11}><span ref={status} className="foundry-label">INDEPENDENT WRITERS SEND SINGLE-ROW INSERTS</span></Html>
    </group>
  );
}

const partitionBayColors = [COLORS.cyan, COLORS.yellow, "#A48AE3", "#F0A43A", "#8CCF83", "#D96E75"];
const partitionBayPositions = [
  [0.25, -1.35], [2.15, -1.35], [4.05, -1.35],
  [0.25, 1.1], [2.15, 1.1], [4.05, 1.1],
] as const;
const partitionBayLabels = ["P_001", "P_002", "P_003", "P_004", "P_005", "P_480"];

function PartitionFanoutPacket({ packetRef, color }: { packetRef: (node: THREE.Group | null) => void; color: string }) {
  return (
    <group ref={packetRef} visible={false}>
      {[-0.28, 0, 0.28].map((offset, index) => <mesh key={offset} position={[offset, index === 1 ? 0.11 : 0, (index - 1) * 0.16]} castShadow>
        <boxGeometry args={[0.34, 0.22, 0.3]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.34} />
      </mesh>)}
    </group>
  );
}

function PartitionBay({ position, color, index, partRef, boundaryRef }: {
  position: readonly [number, number];
  color: string;
  index: number;
  partRef: (node: THREE.Group | null) => void;
  boundaryRef: (node: THREE.Group | null) => void;
}) {
  return (
    <group position={[position[0], 0.26, position[1]]}>
      <RoundedBox args={[1.62, 0.15, 1.7]} radius={0.07} smoothness={3} receiveShadow>
        <meshStandardMaterial color="#E0E1DD" roughness={0.58} metalness={0.08} />
      </RoundedBox>
      <group ref={boundaryRef}>
        <mesh position={[-0.7, 0.38, 0]}><boxGeometry args={[0.06, 0.74, 1.48]} /><meshStandardMaterial color={color} roughness={0.42} /></mesh>
        <mesh position={[0.7, 0.38, 0]}><boxGeometry args={[0.06, 0.74, 1.48]} /><meshStandardMaterial color={color} roughness={0.42} /></mesh>
        <mesh position={[0, 0.38, -0.71]}><boxGeometry args={[1.46, 0.74, 0.06]} /><meshStandardMaterial color={color} roughness={0.42} /></mesh>
      </group>
      <group ref={partRef} position={[0, 0.44, 0.06]} scale={0.001} visible={false}>
        <FoundryPartArtifact accent={color} />
      </group>
      <Html pointerEvents="none" center position={[0, 1.02, 0]} distanceFactor={10}><span className="partition-bay-label">{partitionBayLabels[index]} · NEW PART</span></Html>
    </group>
  );
}

function PartitionExplosionVisualization() {
  const flush = useRef<THREE.Group>(null);
  const distributor = useRef<THREE.Mesh>(null);
  const packetRefs = useRef<Array<THREE.Group | null>>([]);
  const partRefs = useRef<Array<THREE.Group | null>>([]);
  const boundaryRefs = useRef<Array<THREE.Group | null>>([]);
  const safeLane = useRef<THREE.Group>(null);
  const safePartRefs = useRef<Array<THREE.Group | null>>([]);
  const status = useRef<HTMLSpanElement>(null);
  const poolStatus = useRef<HTMLSpanElement>(null);
  const previousPhase = useRef("");
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  const recommendation = useAtlasStore((state) => state.recommendation);
  const getTime = useMachineTime();
  const partitionDecision = recommendation?.decisions.find((entry) => entry.mechanismId === "mergetree.partition-boundary");
  const retentionPrefix = partitionDecision?.title.split(":")[0] ?? "Lifecycle operations";
  const recoveryLabel = `${retentionPrefix.toUpperCase()} · KEEP PARTITIONS COARSE`;

  useEffect(() => () => {
    delete document.documentElement.dataset.partitionPhase;
    delete document.documentElement.dataset.partitionVisiblePools;
    delete document.documentElement.dataset.partitionRecommendation;
  }, []);
  useFrame(() => {
    const frame = partitionExplosionFrame(getTime(), reducedMotion);
    document.documentElement.dataset.partitionPhase = frame.stage;
    document.documentElement.dataset.partitionVisiblePools = String(frame.visiblePools);
    document.documentElement.dataset.partitionRecommendation = partitionDecision ? "personalized" : "generic";
    if (flush.current) {
      flush.current.position.x = THREE.MathUtils.lerp(-5.35, -2.05, frame.flushProgress);
      flush.current.position.y = 0.88 + Math.sin(frame.flushProgress * Math.PI) * (reducedMotion ? 0 : 0.18);
      flush.current.scale.setScalar(THREE.MathUtils.lerp(1, 0.72, frame.fanoutProgress));
      flush.current.visible = frame.stage === "flush" || frame.stage === "fanout";
    }
    if (distributor.current) distributor.current.rotation.y = frame.fanoutProgress * Math.PI * 4;
    packetRefs.current.forEach((packet, index) => {
      if (!packet) return;
      const target = partitionBayPositions[index];
      const progress = THREE.MathUtils.clamp(frame.fanoutProgress * 1.42 - index * 0.085, 0, 1);
      packet.visible = frame.stage === "fanout" && progress > 0.01 && progress < 0.995;
      packet.position.x = THREE.MathUtils.lerp(-1.35, target[0] - 0.25, progress);
      packet.position.z = THREE.MathUtils.lerp(0, target[1], progress);
      packet.position.y = 1.02 + Math.sin(progress * Math.PI) * (reducedMotion ? 0 : 0.55);
      packet.scale.setScalar(0.72 + progress * 0.28);
    });
    partRefs.current.forEach((part, index) => {
      if (!part) return;
      const visible = index < frame.visiblePools && frame.fanoutProgress > 0.01;
      const build = THREE.MathUtils.clamp(frame.fanoutProgress * 1.34 - index * 0.09, 0, 1);
      part.visible = visible;
      part.scale.setScalar(visible ? 0.58 * Math.max(0.05, build) : 0.001);
      part.position.y = 0.44 + (1 - build) * 0.22;
    });
    boundaryRefs.current.forEach((boundary, index) => {
      if (!boundary) return;
      boundary.position.y = 0.42 + Math.sin(frame.boundaryLockProgress * Math.PI + index * 0.3) * (reducedMotion ? 0 : 0.035);
    });
    if (safeLane.current) {
      safeLane.current.visible = frame.recoveryProgress > 0.01;
      safeLane.current.position.y = (1 - frame.recoveryProgress) * 0.18;
      safeLane.current.scale.setScalar(0.88 + frame.recoveryProgress * 0.12);
    }
    safePartRefs.current.forEach((part, index) => {
      if (!part) return;
      const build = THREE.MathUtils.clamp(frame.recoveryProgress * 1.3 - index * 0.18, 0, 1);
      part.scale.setScalar(Math.max(0.05, build) * 0.62);
      part.position.y = 0.62 + (1 - build) * 0.22;
    });
    if (poolStatus.current) poolStatus.current.textContent = `${frame.visiblePools} REPRESENTATIVE POOLS · ${frame.totalPartitions} TOTAL`;
    const nextStatus = ({
        flush: "ONE HEALTHY FLUSH ARRIVES",
        fanout: "PARTITION KEY FANS OUT ROWS",
        isolated: "480 MERGE POOLS · PARTS NEVER CROSS BOUNDARIES",
        bounded: `${recoveryLabel} · QUERY LOCALITY STAYS IN ORDER BY`,
      } as const)[frame.stage];
    if (previousPhase.current !== frame.stage || status.current?.textContent !== nextStatus) {
      previousPhase.current = frame.stage;
      if (status.current) status.current.textContent = nextStatus;
    }
  });
  return (
    <group position={[-1.2, 0.58, 0]}>
      <MachinePlate position={[-0.55, 0.12, 0]} size={[12.7, 0.2, 5.8]} color="#D7D8D4" />
      <Line points={[[ -5.8, 0.3, 0], [-1.65, 0.3, 0]]} color="#34383A" lineWidth={5} />
      <group ref={flush} position={[-5.35, 0.88, 0]}>
        <RoundedBox args={[1.75, 0.82, 1.32]} radius={0.14} smoothness={4} castShadow><meshStandardMaterial color="#E2E7E4" roughness={0.38} metalness={0.12} /></RoundedBox>
        <DataBars count={24} spread={[1.25, 0.45, 0.88]} scale={[0.055, 0.2, 0.055]} offset={[0, -0.15, 0]} color={COLORS.yellow} />
        <mesh position={[0, 0.44, 0]}><boxGeometry args={[1.15, 0.06, 0.9]} /><meshBasicMaterial color={COLORS.cyan} /></mesh>
        <Html pointerEvents="none" center position={[0, 0.82, 0]} distanceFactor={10}><span className="partition-flush-label">ONE INSERT BLOCK · 480 KEYS</span></Html>
      </group>
      <group position={[-1.35, 0.78, 0]}>
        <RoundedBox args={[1.3, 0.76, 1.3]} radius={0.14} smoothness={4} castShadow><meshStandardMaterial color="#252927" roughness={0.25} metalness={0.56} /></RoundedBox>
        <mesh ref={distributor} position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.43, 0.09, 12, 36]} /><meshStandardMaterial color={COLORS.pressure} emissive={COLORS.pressure} emissiveIntensity={0.42} /></mesh>
        <Html pointerEvents="none" center position={[0, 0.98, 0]} distanceFactor={10}><span className="partition-gate-label">PARTITION BY</span></Html>
      </group>
      {partitionBayPositions.map((position, index) => <Line key={`line-${index}`} points={[[ -1.05, 0.72, 0], [position[0] - 0.48, 0.42, position[1]]]} color={partitionBayColors[index]} lineWidth={2.5} transparent opacity={0.62} />)}
      {partitionBayPositions.map((_, index) => <PartitionFanoutPacket key={`packet-${index}`} packetRef={(node) => { packetRefs.current[index] = node; }} color={partitionBayColors[index]} />)}
      {partitionBayPositions.map((position, index) => <PartitionBay key={`bay-${index}`} position={position} color={partitionBayColors[index]} index={index} partRef={(node) => { partRefs.current[index] = node; }} boundaryRef={(node) => { boundaryRefs.current[index] = node; }} />)}
      <Html pointerEvents="none" center position={[2.2, 2.05, 0]} distanceFactor={10}><span ref={poolStatus} className="partition-pool-count">1 REPRESENTATIVE POOL · 480 TOTAL</span></Html>

      <group ref={safeLane} visible={false}>
        <Line points={[[ -1.0, 0.34, 2.35], [4.95, 0.34, 2.35]]} color={COLORS.cyan} lineWidth={5} />
        <group position={[1.45, 0.25, 2.35]}>
          <RoundedBox args={[2.15, 0.15, 1.18]} radius={0.07} smoothness={3} receiveShadow><meshStandardMaterial color="#E8F2F0" roughness={0.56} /></RoundedBox>
          <mesh position={[-0.94, 0.4, 0]}><boxGeometry args={[0.07, 0.8, 1.02]} /><meshStandardMaterial color={COLORS.cyan} /></mesh>
          <mesh position={[0.94, 0.4, 0]}><boxGeometry args={[0.07, 0.8, 1.02]} /><meshStandardMaterial color={COLORS.cyan} /></mesh>
          <group ref={(node) => { safePartRefs.current[0] = node; }} position={[-0.48, 0.62, 0]} scale={0.05}><FoundryPartArtifact accent={COLORS.cyan} secondaryAccent={COLORS.yellow} /></group>
          <group ref={(node) => { safePartRefs.current[1] = node; }} position={[0.48, 0.62, 0]} scale={0.05}><FoundryPartArtifact accent={COLORS.cyan} secondaryAccent={COLORS.yellow} /></group>
        </group>
        <Line points={[[2.75, 0.92, 2.35], [4.75, 0.92, 2.35]]} color="#15171A" lineWidth={3} dashed dashSize={0.16} gapSize={0.1} />
        <Html pointerEvents="none" center position={[3.8, 1.4, 2.35]} distanceFactor={10}><span className="partition-order-label">QUERY LOCALITY → ORDER BY</span></Html>
        <Html pointerEvents="none" center position={[1.45, 1.58, 2.35]} distanceFactor={10}><span className="partition-recovery-label" data-personalized={Boolean(partitionDecision)}>{recoveryLabel}</span></Html>
      </group>
      <Html pointerEvents="none" center position={[-3.65, 2.2, -1.55]} distanceFactor={12}>
        <div className="partition-cause-callout"><span>CAUSE</span><strong>1 insert block → 480 partition values</strong><small>Every touched partition receives at least one new immutable part</small></div>
      </Html>
      <Html pointerEvents="none" center position={[2.0, 2.58, -1.55]} distanceFactor={12}>
        <div className="partition-consequence-callout"><span>CONSEQUENCE</span><strong>480 isolated merge pools</strong><small>Parts never merge across partition boundaries</small></div>
      </Html>
      <Html pointerEvents="none" center position={[-0.35, 2.42, -1.35]} distanceFactor={12}>
        <div className="partition-mobile-summary"><span>PARTITION FAN-OUT</span><strong>1 block → 480 merge pools</strong><small>Keep lifecycle partitions coarse; put query locality in ORDER BY.</small></div>
      </Html>
      <Html pointerEvents="none" center position={[-1.35, -0.42, 0]} distanceFactor={10}><span ref={status} className="foundry-label">ONE HEALTHY FLUSH ARRIVES</span></Html>
    </group>
  );
}

type ContentionWorkKind = "merge" | "ttl" | "mutation";

const contentionWork = {
  merge: { label: "NORMAL MERGE", color: COLORS.cyan, laneZ: -1.6, slotZ: -0.55 },
  ttl: { label: "TTL REWRITE", color: COLORS.yellow, laneZ: 0, slotZ: 0 },
  mutation: { label: "MUTATION", color: COLORS.pressure, laneZ: 1.6, slotZ: 0.55 },
} as const;

function ContentionJobArtifact({ kind, muted = false }: { kind: ContentionWorkKind; muted?: boolean }) {
  const work = contentionWork[kind];
  return (
    <group>
      {kind === "merge" ? <>
        <group position={[-0.36, 0, -0.12]} scale={0.52}><FoundryPartArtifact accent={muted ? "#888D8A" : COLORS.cyan} muted={muted} /></group>
        <group position={[0.32, 0.08, 0.12]} scale={0.52}><FoundryPartArtifact accent={muted ? "#888D8A" : COLORS.yellow} muted={muted} /></group>
      </> : <group scale={kind === "mutation" ? 0.72 : 0.62}>
        <FoundryPartArtifact accent={muted ? "#888D8A" : work.color} muted={muted} />
        {kind === "ttl" && <mesh position={[0.5, 0.45, 0.2]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.23, 0.055, 10, 28]} /><meshStandardMaterial color={COLORS.yellow} emissive={COLORS.yellow} emissiveIntensity={0.25} /></mesh>}
        {kind === "mutation" && <mesh position={[0, 0.58, 0]}><boxGeometry args={[1.05, 0.1, 0.7]} /><meshStandardMaterial color={COLORS.pressure} emissive={COLORS.pressure} emissiveIntensity={0.34} /></mesh>}
      </group>}
    </group>
  );
}

function BackgroundContentionVisualization() {
  const jobRefs = useRef<Record<ContentionWorkKind, THREE.Group | null>>({ merge: null, ttl: null, mutation: null });
  const queueRefs = useRef<Record<ContentionWorkKind, Array<THREE.Group | null>>>({ merge: [], ttl: [], mutation: [] });
  const activePartRefs = useRef<Array<THREE.Group | null>>([]);
  const slotOneLabel = useRef<HTMLSpanElement>(null);
  const slotTwoLabel = useRef<HTMLSpanElement>(null);
  const queueStatus = useRef<HTMLSpanElement>(null);
  const ageNeedle = useRef<THREE.Group>(null);
  const mitigationDeck = useRef<THREE.Group>(null);
  const status = useRef<HTMLSpanElement>(null);
  const previousPhase = useRef("");
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  const recommendation = useAtlasStore((state) => state.recommendation);
  const getTime = useMachineTime();
  const contentionDecision = recommendation?.decisions.find((entry) => entry.mechanismId === "observability.merges");
  const mitigationLabel = contentionDecision?.title.toUpperCase() ?? "PROTECT NORMAL MERGE CAPACITY";

  useEffect(() => () => {
    delete document.documentElement.dataset.contentionPhase;
    delete document.documentElement.dataset.contentionMergeQueue;
    delete document.documentElement.dataset.contentionQueueAge;
    delete document.documentElement.dataset.contentionRecommendation;
  }, []);
  useFrame(() => {
    const frame = backgroundContentionFrame(getTime(), reducedMotion);
    document.documentElement.dataset.contentionPhase = frame.stage;
    document.documentElement.dataset.contentionMergeQueue = String(frame.mergeQueueDepth);
    document.documentElement.dataset.contentionQueueAge = frame.queueAgeRatio.toFixed(2);
    document.documentElement.dataset.contentionRecommendation = contentionDecision ? "personalized" : "generic";

    (["merge", "ttl", "mutation"] as ContentionWorkKind[]).forEach((kind) => {
      const job = jobRefs.current[kind];
      if (!job) return;
      const work = contentionWork[kind];
      const waitingX = kind === "merge" ? -1.3 : -1.05;
      let x = THREE.MathUtils.lerp(-3.15, waitingX, frame.arrivalProgress);
      let z: number = work.laneZ;
      if (kind === "merge") {
        x = THREE.MathUtils.lerp(x, 0.08, frame.mitigationProgress);
        z = THREE.MathUtils.lerp(z, -0.55, frame.mitigationProgress);
        x = THREE.MathUtils.lerp(x, 3.15, frame.recoveryProgress);
        z = THREE.MathUtils.lerp(z, -0.22, frame.recoveryProgress);
      } else {
        x = THREE.MathUtils.lerp(x, 0.08, frame.slotFillProgress);
        z = THREE.MathUtils.lerp(z, kind === "ttl" ? -0.55 : 0.55, frame.slotFillProgress);
        x = THREE.MathUtils.lerp(x, 3.25, frame.mitigationProgress);
        z = THREE.MathUtils.lerp(z, kind === "ttl" ? 0.42 : 1.32, frame.mitigationProgress);
      }
      job.position.set(x, 0.82 + Math.sin((frame.arrivalProgress + frame.mitigationProgress + frame.recoveryProgress) * Math.PI) * (reducedMotion ? 0 : 0.12), z);
      job.scale.setScalar(1);
    });

    const depths: Record<ContentionWorkKind, number> = {
      merge: frame.mergeQueueDepth,
      ttl: frame.ttlQueueDepth,
      mutation: frame.mutationQueueDepth,
    };
    (["merge", "ttl", "mutation"] as ContentionWorkKind[]).forEach((kind) => {
      queueRefs.current[kind].forEach((queued, index) => {
        if (!queued) return;
        const visible = index < depths[kind];
        queued.visible = visible;
        queued.scale.setScalar(visible ? 0.42 : 0.001);
      });
    });
    activePartRefs.current.forEach((part, index) => {
      if (!part) return;
      const visible = index < frame.activeParts;
      part.visible = visible;
      part.scale.setScalar(visible ? 0.48 : 0.001);
    });
    if (ageNeedle.current) ageNeedle.current.rotation.z = THREE.MathUtils.lerp(-Math.PI * 0.58, Math.PI * 0.58, frame.queueAgeRatio);
    if (mitigationDeck.current) mitigationDeck.current.visible = frame.mitigationProgress > 0.01;
    if (queueStatus.current) queueStatus.current.textContent = `${frame.mergeQueueDepth} MERGES WAIT · ${frame.activeParts} ACTIVE PARTS · AGE ${frame.queueAgeRatio > 0.72 ? "HIGH" : frame.queueAgeRatio > 0.28 ? "RISING" : "LOW"}`;

    const protectedState = frame.mitigationProgress > 0.55;
    if (slotOneLabel.current) slotOneLabel.current.textContent = protectedState ? "MODELED A · NORMAL MERGE" : "MODELED A · TTL REWRITE";
    if (slotTwoLabel.current) slotTwoLabel.current.textContent = protectedState ? "MODELED B · HEADROOM" : "MODELED B · MUTATION";
    const nextStatus = ({
      arrive: "MERGE + TTL + MUTATION ENTER THE CAPACITY MODEL",
      saturate: "TTL + MUTATION CONSUME THE MODELED CAPACITY",
      backlog: "NORMAL MERGES WAIT · QUEUE AGE + ACTIVE PARTS RISE",
      protect: `${mitigationLabel} · BROAD REWRITES LEAVE PEAK`,
      recover: "NORMAL MERGES RUN · QUEUES DRAIN TOWARD BASELINE",
    } as const)[frame.stage];
    if (previousPhase.current !== frame.stage || status.current?.textContent !== nextStatus) {
      previousPhase.current = frame.stage;
      if (status.current) status.current.textContent = nextStatus;
    }
  });
  return (
    <group position={[-0.75, 0.62, 0]}>
      <MachinePlate position={[0, 0.12, 0]} size={[11.8, 0.2, 5.85]} color="#D7D8D4" />
      {Object.values(contentionWork).map((work) => <Line key={work.label} points={[[ -4.85, 0.3, work.laneZ], [-0.72, 0.3, work.slotZ]]} color={work.color} lineWidth={4.5} />)}
      {Object.values(contentionWork).map((work) => <Html key={work.label} pointerEvents="none" center position={[-4.35, 1.2, work.laneZ]} distanceFactor={10}><span className="contention-lane-label" style={{ "--lane-color": work.color } as React.CSSProperties}>{work.label} QUEUE</span></Html>)}
      {(["merge", "ttl", "mutation"] as ContentionWorkKind[]).map((kind) => (
        <group key={kind} position={[-4.25, 0.56, contentionWork[kind].laneZ]}>
          {[0, 1, 2, 3, 4].map((queueIndex) => <group ref={(node) => { queueRefs.current[kind][queueIndex] = node; }} key={queueIndex} position={[-queueIndex * 0.32, queueIndex * 0.09, (queueIndex - 2) * 0.1]} scale={0.42}><ContentionJobArtifact kind={kind} muted={queueIndex > 0} /></group>)}
        </group>
      ))}
      {(["merge", "ttl", "mutation"] as ContentionWorkKind[]).map((kind) => <group ref={(node) => { jobRefs.current[kind] = node; }} key={`moving-${kind}`} position={[-3.15, 0.82, contentionWork[kind].laneZ]}><ContentionJobArtifact kind={kind} /></group>)}
      <group position={[0.15, 1.12, 0]}>
        <RoundedBox args={[2.25, 2.35, 2.35]} radius={0.16} smoothness={4} castShadow><meshStandardMaterial color="#252927" roughness={0.25} metalness={0.56} /></RoundedBox>
        {Array.from({ length: 6 }, (_, index) => <mesh key={index} position={[-0.75 + index * 0.3, 1.26, 0]}><boxGeometry args={[0.14, 0.24, 1.65]} /><meshStandardMaterial color={index % 2 ? COLORS.cyan : COLORS.yellow} roughness={0.3} metalness={0.35} /></mesh>)}
        {[-0.55, 0.55].map((z, index) => <group key={z} position={[1.16, 0.1, z]}>
          <mesh rotation={[0, Math.PI / 2, 0]}><cylinderGeometry args={[0.42, 0.42, 0.18, 20]} /><meshStandardMaterial color={index === 0 ? COLORS.cyan : COLORS.pressure} emissive={index === 0 ? COLORS.cyan : COLORS.pressure} emissiveIntensity={0.3} /></mesh>
          <Html pointerEvents="none" center position={[0.2, 0.7, 0]} distanceFactor={9}><span ref={index === 0 ? slotOneLabel : slotTwoLabel} className="contention-slot-label">{index === 0 ? "MODELED A · TTL REWRITE" : "MODELED B · MUTATION"}</span></Html>
        </group>)}
        <Html pointerEvents="none" center position={[0, 2.0, 0]} distanceFactor={10}><span className="contention-pool-label">MODELED SHARED CAPACITY · NOT SERVER COUNT</span></Html>
      </group>

      <group position={[2.1, 1.08, -1.52]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.66, 0.09, 12, 40, Math.PI * 1.55]} /><meshStandardMaterial color="#555A58" roughness={0.4} metalness={0.38} /></mesh>
        <group ref={ageNeedle} rotation={[0, 0, -Math.PI * 0.58]}><mesh position={[0, 0.36, 0]}><boxGeometry args={[0.07, 0.72, 0.06]} /><meshStandardMaterial color={COLORS.pressure} emissive={COLORS.pressure} emissiveIntensity={0.48} /></mesh></group>
        <Html pointerEvents="none" center position={[0, -0.98, 0]} distanceFactor={9}><span ref={queueStatus} className="contention-gauge-label">1 MERGE WAITS · 2 ACTIVE PARTS · AGE LOW</span></Html>
      </group>
      <group position={[4.12, 0.72, -1.05]}>
        {Array.from({ length: 6 }, (_, index) => <group ref={(node) => { activePartRefs.current[index] = node; }} key={index} position={[(index % 3) * 0.58 - 0.58, Math.floor(index / 3) * 0.38, (index % 2) * 0.42]} scale={0.001} visible={false}><FoundryPartArtifact accent={index % 2 ? COLORS.yellow : COLORS.cyan} /></group>)}
        <Html pointerEvents="none" center position={[0, 1.42, 0]} distanceFactor={9}><span className="contention-active-parts-label">ACTIVE PARTS WAIT FOR MERGES</span></Html>
      </group>

      <group ref={mitigationDeck} visible={false}>
        <MachinePlate position={[3.45, 0.18, 1.15]} size={[3.05, 0.14, 1.45]} color="#E7EEEB" />
        <Html pointerEvents="none" center position={[3.45, 1.02, 1.15]} distanceFactor={10}><span className="contention-mitigation-label" data-personalized={Boolean(contentionDecision)}>{mitigationLabel}</span></Html>
        <Html pointerEvents="none" center position={[3.45, 0.2, 2.02]} distanceFactor={9}><span className="contention-window-label">DEFERRED REWRITE WINDOW</span></Html>
      </group>
      <Html pointerEvents="none" center position={[-2.7, 4.05, -1.65]} distanceFactor={12}>
        <div className="contention-title"><span>THE GOTCHA</span><strong>Three rewrite classes contend for finite scheduling and storage bandwidth.</strong><small>Normal merges keep ingestion healthy. TTL and mutations can delay them.</small></div>
      </Html>
      <Html pointerEvents="none" center position={[2.75, 3.92, -1.55]} distanceFactor={11}>
        <div className="contention-pressure-callout"><span>CONSEQUENCE</span><strong>Queue age and active parts rise</strong><small>Protect normal merge capacity before changing limits or forcing more work.</small></div>
      </Html>
      <Html pointerEvents="none" center position={[0, 3.72, -1.5]} distanceFactor={12}>
        <div className="contention-mobile-summary"><span>BACKGROUND CONTENTION</span><strong>Broad rewrites make normal merges wait</strong><small>Move TTL and mutation work out of peak windows; protect merge headroom.</small></div>
      </Html>
      <Html pointerEvents="none" center position={[0.1, -0.65, 0]} distanceFactor={11}><span ref={status} className="foundry-label">MERGE + TTL + MUTATION ENTER THE CAPACITY MODEL</span></Html>
    </group>
  );
}

const ORDERING_GRANULE_POSITIONS = Array.from({ length: 12 }, (_, index) => [
  -3.05 + (index % 6) * 1.16,
  0,
  -0.72 + Math.floor(index / 6) * 1.48,
] as [number, number, number]);
const ORDERING_MATCH_GRANULES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11] as const;
const ORDERING_INITIAL_READ_COLOR = new THREE.Color("#F0F1ED");
const ORDERING_INITIAL_SKIP_COLOR = new THREE.Color("#D2D5D2");
const ORDERING_CLUSTERED_READ_COLOR = new THREE.Color("#E8F7F5");

function BadOrderingVisualization() {
  const broadScan = useRef<THREE.Mesh>(null);
  const narrowScan = useRef<THREE.Mesh>(null);
  const query = useRef<THREE.Group>(null);
  const correctedRail = useRef<THREE.Group>(null);
  const result = useRef<THREE.Group>(null);
  const matchRefs = useRef<Array<THREE.Group | null>>([]);
  const granuleMaterials = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const granuleLabels = useRef<Array<HTMLSpanElement | null>>([]);
  const readSummary = useRef<HTMLElement>(null);
  const readDetail = useRef<HTMLElement>(null);
  const status = useRef<HTMLSpanElement>(null);
  const previousPhase = useRef("");
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  const recommendation = useAtlasStore((state) => state.recommendation);
  const getTime = useMachineTime();
  const orderingDecision = recommendation?.decisions.find((entry) => entry.mechanismId === "read.ordering");
  const orderingLabel = orderingDecision?.title.toUpperCase() ?? "FILTER-FIRST PHYSICAL ORDER";

  useEffect(() => () => {
    delete document.documentElement.dataset.orderingPhase;
    delete document.documentElement.dataset.orderingReadGranules;
    delete document.documentElement.dataset.orderingSkippedGranules;
    delete document.documentElement.dataset.orderingRecommendation;
  }, []);

  useFrame(() => {
    const frame = badOrderingFrame(getTime(), reducedMotion);
    document.documentElement.dataset.orderingPhase = frame.stage;
    document.documentElement.dataset.orderingReadGranules = String(frame.readGranules);
    document.documentElement.dataset.orderingSkippedGranules = String(frame.skippedGranules);
    document.documentElement.dataset.orderingRecommendation = orderingDecision ? "personalized" : "generic";

    if (query.current) {
      query.current.position.x = THREE.MathUtils.lerp(-5.05, -3.85, frame.predicateProgress);
      query.current.position.y = 1.02 + Math.sin(frame.predicateProgress * Math.PI) * (reducedMotion ? 0 : 0.14);
    }
    if (broadScan.current) {
      broadScan.current.visible = frame.wideScanProgress > 0.01 && frame.reorderProgress < 0.98;
      broadScan.current.position.x = THREE.MathUtils.lerp(-3.25, 3.05, frame.wideScanProgress);
      const material = broadScan.current.material as THREE.MeshStandardMaterial;
      material.opacity = THREE.MathUtils.lerp(0.52, 0, frame.reorderProgress);
    }
    if (narrowScan.current) {
      narrowScan.current.visible = frame.pruneProgress > 0.01;
      const material = narrowScan.current.material as THREE.MeshStandardMaterial;
      material.opacity = THREE.MathUtils.lerp(0, 0.34, frame.pruneProgress);
    }
    if (correctedRail.current) correctedRail.current.visible = frame.reorderProgress > 0.02;
    if (result.current) {
      result.current.visible = frame.resultProgress > 0.01;
      result.current.scale.setScalar(Math.max(0.001, frame.resultProgress));
    }

    matchRefs.current.forEach((match, matchIndex) => {
      if (!match) return;
      const sourceIndex = ORDERING_MATCH_GRANULES[matchIndex];
      const source = ORDERING_GRANULE_POSITIONS[sourceIndex];
      const targetIndex = matchIndex < 6 ? 0 : 1;
      const target = ORDERING_GRANULE_POSITIONS[targetIndex];
      const targetColumn = matchIndex % 3;
      const targetRow = Math.floor((matchIndex % 6) / 3);
      match.position.set(
        THREE.MathUtils.lerp(-0.1 + source[0], -0.1 + target[0] + (targetColumn - 1) * 0.22, frame.reorderProgress),
        THREE.MathUtils.lerp(1.2, 1.12 + targetRow * 0.22, frame.reorderProgress) + Math.sin(frame.reorderProgress * Math.PI) * (reducedMotion ? 0 : 0.6),
        THREE.MathUtils.lerp(0.2 + source[2], 0.2 + target[2] + (targetRow - 0.5) * 0.25, frame.reorderProgress),
      );
      const reveal = THREE.MathUtils.clamp(frame.scatterProgress * 1.55 - matchIndex / ORDERING_MATCH_GRANULES.length * 0.55, 0, 1);
      match.scale.setScalar(Math.max(0.001, reveal));
    });

    granuleMaterials.current.forEach((material, index) => {
      if (!material) return;
      const wasRead = index !== 10;
      const willRead = index < 2;
      material.transparent = true;
      material.opacity = THREE.MathUtils.lerp(wasRead ? 1 : 0.42, willRead ? 1 : 0.24, frame.pruneProgress);
      material.color.lerpColors(wasRead ? ORDERING_INITIAL_READ_COLOR : ORDERING_INITIAL_SKIP_COLOR, willRead ? ORDERING_CLUSTERED_READ_COLOR : ORDERING_INITIAL_SKIP_COLOR, frame.pruneProgress);
    });
    granuleLabels.current.forEach((label, index) => {
      if (!label) return;
      const read = frame.pruneProgress > 0.5 ? index < 2 : index !== 10;
      label.dataset.read = String(read);
      label.textContent = `G${String(index + 1).padStart(2, "0")} · ${read ? "READ" : "SKIP"}`;
    });
    if (readSummary.current) readSummary.current.textContent = frame.pruneProgress > 0.01
      ? `${frame.readGranules} / 12 read · ${frame.skippedGranules} skipped`
      : "11 / 12 read · illustrative model";
    if (readDetail.current) readDetail.current.textContent = frame.pruneProgress > 0.01
      ? "The corrected key clusters matches so sparse marks can discard the surrounding ranges."
      : "The filter value appears in nearly every range, so the sparse marks save almost no work.";

    const nextStatus = ({
      predicate: "FILTER tenant_id = 42 ENTERS THE SPARSE INDEX",
      scatter: "ONE FILTER VALUE APPEARS IN 11 / 12 ILLUSTRATED GRANULES",
      "wide-scan": "MARKS CANNOT DISCARD 11 / 12 CANDIDATE RANGES",
      reorder: `${orderingLabel} · CLUSTER MATCHING ROWS`,
      prune: `${frame.skippedGranules} / 12 ILLUSTRATED GRANULES ARE NOW SKIPPED`,
      result: "MODEL: 11 / 12 READ → 2 / 12 READ · VERIFY WITH EXPLAIN",
    } as const)[frame.stage];
    if (previousPhase.current !== frame.stage || status.current?.textContent !== nextStatus) {
      previousPhase.current = frame.stage;
      if (status.current) status.current.textContent = nextStatus;
    }
  });

  return (
    <group position={[-0.7, 0.62, 0]}>
      <MachinePlate position={[0, 0.12, 0]} size={[11.9, 0.2, 5.8]} color="#D7D8D4" />
      <group ref={query} position={[-5.05, 1.02, 0]}>
        <MachineValue position={[0, 0, 0]} value="tenant = 42" detail="representative filter" color={COLORS.yellow} />
      </group>
      <Line points={[[ -3.45, 0.32, -1.65], [3.2, 0.32, -1.65]]} color="#15171A" lineWidth={5} />
      <group position={[-0.1, 2.0, -1.65]}>
        <MachinePlate position={[0, 0, 0]} size={[7.2, 0.24, 0.48]} color="#15171A" />
        {Array.from({ length: 7 }, (_, index) => <mesh key={index} position={[-3 + index, 0.23, 0]}><boxGeometry args={[0.12, 0.48, 0.56]} /><meshStandardMaterial color={index === 1 || index === 5 ? COLORS.yellow : COLORS.cyan} emissive={index === 1 || index === 5 ? COLORS.yellow : COLORS.cyan} emissiveIntensity={0.24} /></mesh>)}
        <Html pointerEvents="none" center position={[0, 0.88, 0]} distanceFactor={10}><span className="ordering-mark-label">SPARSE MARKS · RANGE BOUNDARIES</span></Html>
      </group>
      <group position={[-0.1, 0.74, 0.2]}>
        {ORDERING_GRANULE_POSITIONS.map((position, index) => {
          const initiallyRead = index !== 10;
          return <group key={index} position={position}>
            <RoundedBox args={[0.98, 0.78, 1.14]} radius={0.09} smoothness={3} castShadow>
              <meshStandardMaterial ref={(node) => { granuleMaterials.current[index] = node; }} color={initiallyRead ? "#F0F1ED" : "#D2D5D2"} transparent opacity={initiallyRead ? 1 : 0.42} roughness={0.43} metalness={0.08} />
            </RoundedBox>
            <Html pointerEvents="none" center position={[0, -0.62, 0]} distanceFactor={9}><span ref={(node) => { granuleLabels.current[index] = node; }} className="ordering-granule-label" data-read={initiallyRead}>G{String(index + 1).padStart(2, "0")} · {initiallyRead ? "READ" : "SKIP"}</span></Html>
          </group>;
        })}
      </group>
      {ORDERING_MATCH_GRANULES.map((sourceIndex, matchIndex) => {
        const source = ORDERING_GRANULE_POSITIONS[sourceIndex];
        return <group ref={(node) => { matchRefs.current[matchIndex] = node; }} key={sourceIndex} position={[-0.1 + source[0], 1.2, 0.2 + source[2]]}>
          <RoundedBox args={[0.22, 0.28, 0.22]} radius={0.035} smoothness={2} castShadow><meshStandardMaterial color={COLORS.yellow} emissive={COLORS.yellow} emissiveIntensity={0.45} roughness={0.28} /></RoundedBox>
        </group>;
      })}
      <mesh ref={broadScan} position={[-3.25, 1.12, 0.2]} visible={false}>
        <boxGeometry args={[0.16, 2.25, 3.9]} />
        <meshStandardMaterial color={COLORS.pressure} emissive={COLORS.pressure} emissiveIntensity={0.62} transparent opacity={0.52} />
      </mesh>
      <mesh ref={narrowScan} position={[-2.57, 1.12, -0.52]} visible={false}>
        <boxGeometry args={[2.18, 2.25, 1.16]} />
        <meshStandardMaterial color={COLORS.cyan} emissive={COLORS.cyan} emissiveIntensity={0.38} transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={correctedRail} visible={false}>
        <MachinePlate position={[0.35, 0.3, 2.18]} size={[6.6, 0.14, 0.58]} color="#DDEBE8" />
        <Html pointerEvents="none" center position={[0.35, 0.92, 2.18]} distanceFactor={10}><span className="ordering-recovery-label" data-personalized={Boolean(orderingDecision)}>{orderingLabel}</span></Html>
        <Html pointerEvents="none" center position={[3.72, 0.42, 2.18]} distanceFactor={9}><span className="ordering-validation-label">VERIFY · EXPLAIN INDEXES = 1</span></Html>
      </group>
      <group ref={result} position={[3.95, 0.72, 0]} visible={false} scale={0.001}>
        <RoundedBox args={[1.45, 0.18, 1.65]} radius={0.07} smoothness={3}><meshStandardMaterial color="#E6E7E2" roughness={0.55} /></RoundedBox>
        {[-0.36, 0, 0.36].map((x, index) => <mesh key={x} position={[x, 0.26 + index * 0.05, 0]}><boxGeometry args={[0.24, 0.24, 0.34]} /><meshStandardMaterial color={COLORS.yellow} emissive={COLORS.yellow} emissiveIntensity={0.28} /></mesh>)}
        <Html pointerEvents="none" center position={[0, 0.88, 0]} distanceFactor={10}><span className="ordering-result-label">SAME SMALL RESULT</span></Html>
      </group>
      <Html pointerEvents="none" center position={[-2.45, 4.0, -1.55]} distanceFactor={12}>
        <div className="ordering-cause-callout"><span>THE GOTCHA</span><strong>One filter value is scattered across 11 of 12 illustrated granules.</strong><small>Sparse marks cannot discard a range that still contains a match.</small></div>
      </Html>
      <Html pointerEvents="none" center position={[2.75, 3.85, -1.55]} distanceFactor={11}>
        <div className="ordering-cost-callout"><span>REPRESENTATIVE WORK</span><strong ref={readSummary}>11 / 12 read · illustrative model</strong><small ref={readDetail}>The filter value appears in nearly every range, so the sparse marks save almost no work.</small></div>
      </Html>
      <Html pointerEvents="none" center position={[0, 3.75, -1.5]} distanceFactor={12}>
        <div className="ordering-mobile-summary"><span>PHYSICAL ORDER MATTERS</span><strong>Model: 11 / 12 read → 2 / 12</strong><small>Cluster common filters, then verify the candidate with EXPLAIN indexes.</small></div>
      </Html>
      <Html pointerEvents="none" center position={[0, -0.68, 0]} distanceFactor={11}><span ref={status} className="foundry-label">FILTER tenant_id = 42 ENTERS THE SPARSE INDEX</span></Html>
    </group>
  );
}

function PartAnatomyVisualization({ xray }: { xray: boolean }) {
  return (
    <group position={[0, 0.55, 0]}>
      <MachinePlate position={[0, 0.1, 0]} size={[9.4, 0.22, 5.35]} color="#D7D8D4" />
      <group position={[0, 2.05, 0]} scale={xray ? 0.82 : 0.76}>
        <ImmutablePart exploded />
      </group>
      <Html pointerEvents="none" center position={[0, 5.18, 0]} distanceFactor={9}>
        <div className="mechanism-machine-title mechanism-machine-title--part">
          <span>ONE IMMUTABLE MERGETREE PART</span>
          <strong>Columns, marks, index, checksums, metadata</strong>
          <small>These files commit together. A later merge writes a new part instead of editing this one.</small>
        </div>
      </Html>
      <Html pointerEvents="none" center position={[0, -0.48, 2.2]} distanceFactor={10}>
        <span className="part-anatomy-contract">INSERT BLOCK → SORTED COLUMN FILES → IMMUTABLE PART</span>
      </Html>
    </group>
  );
}

function PartitionLane({
  z,
  label,
  accent,
  outputLabel,
}: {
  z: number;
  label: string;
  accent: string;
  outputLabel: string;
}) {
  return (
    <group position={[0, 0, z]}>
      <RoundedBox args={[8.7, 0.16, 1.75]} radius={0.08} smoothness={3} position={[0, 0.23, 0]} receiveShadow>
        <meshStandardMaterial color="#ECEDE9" roughness={0.62} metalness={0.04} />
      </RoundedBox>
      <Line points={[[ -3.75, 0.42, 0], [3.72, 0.42, 0]]} color={accent} lineWidth={4} />
      {[-3.3, -2.05].map((x, index) => (
        <group key={x} position={[x, 0.84, 0]} scale={0.72}>
          <FoundryPartArtifact accent={accent} />
          <Html pointerEvents="none" center position={[0, 0.82, 0]} distanceFactor={9}>
            <span className="partition-part-index">{index === 0 ? "A" : "B"}</span>
          </Html>
        </group>
      ))}
      <Html pointerEvents="none" center position={[-2.66, 1.82, 0]} distanceFactor={9}>
        <span className="partition-lane-label">PARTITION {label}</span>
      </Html>
      <group position={[0.15, 1.02, 0]}>
        <RoundedBox args={[0.72, 1.72, 1.18]} radius={0.11} smoothness={3} castShadow>
          <meshStandardMaterial color="#15171A" roughness={0.24} metalness={0.56} />
        </RoundedBox>
        <mesh position={[0.39, 0, 0]}>
          <boxGeometry args={[0.1, 1.2, 0.72]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.34} />
        </mesh>
        <Html pointerEvents="none" center position={[0, 1.2, 0]} distanceFactor={9}>
          <span className="partition-worker-label">MERGE</span>
        </Html>
      </group>
      <group position={[2.85, 0.84, 0]} scale={0.82}>
        <FoundryPartArtifact accent={accent} secondaryAccent="#FFCC01" />
        <Html pointerEvents="none" center position={[0, 0.9, 0]} distanceFactor={9}>
          <span className="partition-output-label">{outputLabel}</span>
        </Html>
      </group>
    </group>
  );
}

function PartitionBoundaryVisualization() {
  return (
    <group position={[0, 0.48, 0]}>
      <MachinePlate position={[0, 0.1, 0]} size={[9.8, 0.22, 5.7]} color="#D7D8D4" />
      <PartitionLane z={-1.32} label="2026-08" accent={COLORS.cyan} outputLabel="AUGUST · NEW PART" />
      <PartitionLane z={1.32} label="2026-09" accent={COLORS.yellow} outputLabel="SEPTEMBER · NEW PART" />
      <RoundedBox args={[9.15, 0.24, 0.12]} radius={0.035} smoothness={2} position={[0, 0.38, 0]} castShadow>
        <meshStandardMaterial color="#15171A" roughness={0.3} metalness={0.48} />
      </RoundedBox>
      <Html pointerEvents="none" center position={[0, 0.82, 2.82]} distanceFactor={9}>
        <span className="partition-boundary-label">PARTITION BOUNDARY · PARTS NEVER MERGE ACROSS IT</span>
      </Html>
      <Html pointerEvents="none" center position={[0, 5.18, 0]} distanceFactor={9}>
        <div className="mechanism-machine-title mechanism-machine-title--partition">
          <span>MERGETREE PARTITION BOUNDARY</span>
          <strong>Two independent merge pools</strong>
          <small>Parts consolidate only with compatible parts inside the same lifecycle boundary.</small>
        </div>
      </Html>
    </group>
  );
}

function BlockFoundryMachine({ exploded, mobile, pressure, scenario }: { exploded: boolean; mobile: boolean; pressure: boolean; scenario: ScenarioMode }) {
  const machine = useRef<THREE.Group>(null);
  const part = useRef<THREE.Group>(null);
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);

  useEffect(() => {
    if (exploded) document.documentElement.dataset.cutawayOpen = "true";
    else delete document.documentElement.dataset.cutawayOpen;
    return () => { delete document.documentElement.dataset.cutawayOpen; };
  }, [exploded]);

  useFrame((_, delta) => {
    const damping = reducedMotion ? 1000 : 7;
    const overviewScale = mobile ? (scenario === "partition-explosion" ? 0.68 : 0.84) : scenario === "partition-explosion" ? 1.06 : 1.14;
    if (machine.current) {
      machine.current.scale.setScalar(THREE.MathUtils.damp(machine.current.scale.x, overviewScale, damping, delta));
      machine.current.position.y = THREE.MathUtils.damp(machine.current.position.y, 0, damping, delta);
    }
    if (part.current) {
      part.current.position.x = THREE.MathUtils.damp(part.current.position.x, -2.4, damping, delta);
      part.current.position.y = THREE.MathUtils.damp(part.current.position.y, 2.1, damping, delta);
      part.current.position.z = THREE.MathUtils.damp(part.current.position.z, 0, damping, delta);
      part.current.scale.setScalar(THREE.MathUtils.damp(part.current.scale.x, 0.95, damping, delta));
    }
  });

  return (
    <group>
      {!exploded && <group ref={machine}>
        {scenario === "partition-explosion" ? <PartitionExplosionVisualization /> : scenario === "tiny-insert-storm" ? <TinyInsertStormVisualization /> : <>
          <MachinePlate position={[-2.7, 0.32, 1.55]} size={[3.6, 0.18, 3.05]} color="#D7D8D4" />
          <MachinePlate position={[3.55, 0.3, -1.5]} size={[6.4, 0.18, 3.5]} color="#D7D8D4" />
          <IncomingPart position={[-3.2, 0.95, 2.45]} delay={0.04} pressure={pressure} />
          <IncomingPart position={[-3.25, 0.95, 1.45]} delay={0.38} pressure={pressure} />
          <IncomingPart position={[-3.35, 0.95, 0.42]} delay={0.72} pressure={pressure} />
          <FoundryCrane pressure={pressure} />
          <SortedMergeLoom pressure={pressure} />
          <Html pointerEvents="none" center position={[-2.9, 0.48, 3.55]} distanceFactor={11}>
            <span className="foundry-label">ACTIVE PARTS · IMMUTABLE COLUMN FILES</span>
          </Html>
          <Html pointerEvents="none" center position={[4.15, 4.2, -2.2]} distanceFactor={11}>
            <div className="foundry-title foundry-legend">
              <span>Legend</span>
              <ul>
                <li><i data-kind="part" />Part A / B / C</li>
                <li><i data-kind="machine" />Merge machine</li>
                <li><i data-kind="a" />Rows from A</li>
                <li><i data-kind="b" />Rows from B</li>
                <li><i data-kind="c" />Part C · A + B</li>
              </ul>
            </div>
          </Html>
        </>}
      </group>}
      {exploded && <group ref={part} position={[-2.4, 2.1, 0]} scale={0.95}>
        <ImmutablePart exploded={exploded} />
      </group>}
    </group>
  );
}

type VoxelNode = {
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
};

type CanopyVoxelNode = VoxelNode & { shade: number };

const MERGE_TREE_TRUNK_VOXELS: VoxelNode[] = [
  { position: [0, 0.42, 0], scale: [1.45, 0.72, 1.2] },
  { position: [-0.68, 0.28, 0.06], scale: [0.7, 0.4, 0.72], rotation: [0, 0, -0.08] },
  { position: [0.74, 0.3, -0.05], scale: [0.78, 0.42, 0.7], rotation: [0, 0, 0.08] },
  { position: [-1.28, 0.18, 0.08], scale: [0.72, 0.3, 0.58], rotation: [0, 0, -0.13] },
  { position: [1.36, 0.18, -0.08], scale: [0.78, 0.3, 0.58], rotation: [0, 0, 0.13] },
  { position: [-0.12, 1.12, 0], scale: [1.08, 0.92, 1.04] },
  { position: [0.08, 1.88, -0.02], scale: [0.98, 0.88, 0.98] },
  { position: [-0.16, 2.62, 0.02], scale: [0.92, 0.82, 0.9] },
  { position: [0.1, 3.3, 0], scale: [0.84, 0.72, 0.84] },
  { position: [-0.52, 3.7, 0], scale: [0.72, 0.62, 0.72], rotation: [0, 0, -0.14] },
  { position: [0.58, 3.72, -0.04], scale: [0.72, 0.62, 0.72], rotation: [0, 0, 0.14] },
  { position: [-1.12, 4.04, 0.02], scale: [0.82, 0.58, 0.68], rotation: [0, 0, -0.22] },
  { position: [1.18, 4.08, -0.05], scale: [0.84, 0.58, 0.68], rotation: [0, 0, 0.22] },
  { position: [-1.78, 4.38, 0.02], scale: [0.8, 0.54, 0.64], rotation: [0, 0, -0.28] },
  { position: [1.86, 4.4, -0.06], scale: [0.82, 0.54, 0.64], rotation: [0, 0, 0.28] },
  { position: [-0.2, 4.28, -0.08], scale: [0.72, 0.74, 0.7] },
  { position: [-0.72, 4.72, -0.1], scale: [0.64, 0.58, 0.62], rotation: [0, 0, -0.18] },
  { position: [0.48, 4.74, -0.12], scale: [0.66, 0.58, 0.62], rotation: [0, 0, 0.18] },
];

const MERGE_TREE_CANOPY_CLUSTERS = [
  [-2.55, 5.18, 0.18, 1.02],
  [-1.68, 5.82, -0.14, 1.12],
  [-0.52, 6.28, 0.06, 1.18],
  [0.76, 6.22, -0.18, 1.16],
  [1.86, 5.76, 0.12, 1.1],
  [2.7, 5.14, -0.08, 0.98],
  [-0.55, 5.18, 0.72, 1.08],
  [0.78, 5.08, -0.76, 1.04],
] as const;

const MERGE_TREE_CANOPY_OFFSETS = [
  [0, 0, 0, 0.94],
  [-0.7, 0.08, 0.04, 0.72],
  [0.68, 0.14, -0.08, 0.76],
  [-0.24, 0.58, 0.08, 0.7],
  [0.3, -0.55, -0.02, 0.66],
  [-0.12, 0.12, 0.62, 0.64],
  [0.18, 0.02, -0.66, 0.62],
  [-0.58, -0.38, 0.32, 0.56],
  [0.58, 0.42, -0.28, 0.54],
] as const;

const MERGE_TREE_CANOPY_VOXELS: CanopyVoxelNode[] = MERGE_TREE_CANOPY_CLUSTERS.flatMap(
  ([clusterX, clusterY, clusterZ, clusterScale], clusterIndex) => MERGE_TREE_CANOPY_OFFSETS.map(
    ([offsetX, offsetY, offsetZ, size], offsetIndex) => ({
      position: [
        clusterX + offsetX * clusterScale,
        clusterY + offsetY * clusterScale,
        clusterZ + offsetZ * clusterScale,
      ] as [number, number, number],
      scale: [
        size * clusterScale * (offsetIndex % 3 === 0 ? 1.12 : 1),
        size * clusterScale,
        size * clusterScale * (offsetIndex % 2 === 0 ? 1.06 : 0.94),
      ] as [number, number, number],
      rotation: [0, ((clusterIndex + offsetIndex) % 5 - 2) * 0.055, 0] as [number, number, number],
      shade: (clusterIndex + offsetIndex * 2) % 4,
    }),
  ),
);

const MERGE_TREE_ROUTE_POINTS: Array<[number, number, number]> = [
  [0.02, 0.2, 0.67],
  [0.02, 1.02, 0.67],
  [-0.32, 1.02, 0.67],
  [-0.32, 1.86, 0.67],
  [0.18, 1.86, 0.67],
  [0.18, 2.76, 0.67],
  [-0.26, 2.76, 0.67],
  [-0.26, 3.62, 0.67],
  [0.18, 3.62, 0.67],
  [0.18, 4.5, 0.67],
  [0.8, 4.5, 0.67],
  [0.8, 5.52, 0.67],
];

function MergeTreeDataPulse() {
  const pulse = useRef<THREE.Mesh>(null);
  const getTime = useMachineTime();
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  useFrame(() => {
    if (!pulse.current) return;
    const routeProgress = reducedMotion ? MERGE_TREE_ROUTE_POINTS.length - 1 : (getTime() * 0.82) % (MERGE_TREE_ROUTE_POINTS.length - 1);
    const segment = Math.min(MERGE_TREE_ROUTE_POINTS.length - 2, Math.floor(routeProgress));
    const localProgress = reducedMotion ? 1 : routeProgress - segment;
    const from = MERGE_TREE_ROUTE_POINTS[segment]!;
    const to = MERGE_TREE_ROUTE_POINTS[segment + 1]!;
    pulse.current.position.set(
      THREE.MathUtils.lerp(from[0], to[0], localProgress),
      THREE.MathUtils.lerp(from[1], to[1], localProgress),
      THREE.MathUtils.lerp(from[2], to[2], localProgress),
    );
    pulse.current.scale.setScalar(reducedMotion ? 0.17 : 0.14 + Math.sin(getTime() * 4.4) * 0.025);
  });
  return <mesh ref={pulse}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#20D7FF" emissive="#20D7FF" emissiveIntensity={0.85} roughness={0.22} /></mesh>;
}

/**
 * A branded spatial landmark, not a storage metaphor. It deliberately sits
 * behind the causal foundry so the crane, immutable parts, and merge worker
 * remain the objects that explain MergeTree behavior.
 */
function MergeTreeVoxelLandmark({ mobile }: { mobile: boolean }) {
  useEffect(() => {
    document.documentElement.dataset.mergeTreeLandmark = "visible";
    return () => { delete document.documentElement.dataset.mergeTreeLandmark; };
  }, []);
  const canopyColors = ["#FFCC01", "#F4B900", "#E2A000", "#FFD84A"];
  return (
    <group position={[0.15, 0.02, -5.7]} scale={mobile ? 0.58 : 0.68} rotation={[0, -0.08, 0]}>
      <Instances limit={MERGE_TREE_TRUNK_VOXELS.length} range={MERGE_TREE_TRUNK_VOXELS.length} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#15171A" roughness={0.38} metalness={0.3} />
        {MERGE_TREE_TRUNK_VOXELS.map((node, index) => <Instance key={index} position={node.position} scale={node.scale} rotation={node.rotation ?? [0, 0, 0]} />)}
      </Instances>
      {canopyColors.map((color, shade) => {
        const nodes = MERGE_TREE_CANOPY_VOXELS.filter((node) => node.shade === shade);
        return <Instances key={color} limit={nodes.length} range={nodes.length} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.035} roughness={0.44} metalness={0.05} />
          {nodes.map((node, index) => <Instance key={index} position={node.position} scale={node.scale} rotation={node.rotation ?? [0, 0, 0]} />)}
        </Instances>;
      })}
      <Line points={MERGE_TREE_ROUTE_POINTS} color="#073B45" lineWidth={8} />
      <Line points={MERGE_TREE_ROUTE_POINTS} color="#20D7FF" lineWidth={4} />
      <MergeTreeDataPulse />
    </group>
  );
}

function MergeTreeFoundry({ mobile }: { mobile: boolean }) {
  const viewLevel = useAtlasStore((state) => state.viewLevel);
  const selected = useAtlasStore((state) => state.selectedMechanismId);
  const scenario = useAtlasStore((state) => state.scenario);
  const family = useAtlasStore((state) => state.mergeFamilyId);
  const strategy = useAtlasStore((state) => state.latestReadStrategy);
  const recommendationOpen = useAtlasStore((state) => Boolean(state.recommendation) && state.journeyPanelOpen && !state.activeJourneyId);
  const exploded = selected === "mergetree.part-anatomy" && viewLevel === "xray";
  const mergeVisual = mergeTreeVisualMode(selected, viewLevel);
  const recommendationVisual = recommendationGotchaVisual(selected, recommendationOpen);
  const pressure = scenario !== "healthy" || selected === "mergetree.parts-pressure" || selected === "mergetree.forced-merge";
  const district = selected ? mechanismById(selected)?.districtId : null;
  const showMergeTreeLandmark = scenario === "healthy" && mergeVisual === "family" && (!selected || district === "mergetree");
  const activeMachine = scenario === "merge-ttl-contention"
    ? <BackgroundContentionVisualization />
    : scenario === "bad-order-by"
      ? <BadOrderingVisualization />
    : scenario === "aggregation-spill"
      ? <AggregationSpillVisualization />
    : scenario === "replica-lag"
      ? <ReplicaLagVisualization />
    : scenario === "keeper-quorum-loss"
      ? <KeeperQuorumVisualization />
    : recommendationVisual === "ordering"
      ? <BadOrderingVisualization />
    : recommendationVisual === "aggregation-spill"
      ? <AggregationSpillVisualization />
    : recommendationVisual === "keeper-quorum"
      ? <KeeperQuorumVisualization />
    : recommendationVisual === "replica-lag"
      ? <ReplicaLagVisualization />
    : mergeVisual === "part-anatomy" || mergeVisual === "part-xray"
      ? <PartAnatomyVisualization xray={mergeVisual === "part-xray"} />
    : mergeVisual === "partition-boundary"
      ? <PartitionBoundaryVisualization />
    : mergeVisual === "parts-pressure"
      ? <TinyInsertStormVisualization />
    : selected && district && district !== "mergetree"
    ? district === "ingestion"
      ? <IngestionManifold id={selected} pressure={pressure} />
      : district === "read"
        ? <QueryScanner id={selected} pressure={pressure} />
        : district === "precompute"
          ? <DerivedSwitchyard id={selected} pressure={pressure} />
          : district === "architecture"
            ? <ClusterSwitchboard id={selected} pressure={pressure} />
            : district === "retention"
              ? <RetentionVault id={selected} pressure={pressure} />
              : district === "memory"
                ? <MemoryCacheTower id={selected} pressure={pressure} />
                : district === "execution"
                  ? <QueryExecutionLab id={selected} pressure={pressure} />
                  : district === "durability"
                    ? <DurabilityDock id={selected} pressure={pressure} />
                    : district === "storage"
                      ? <StorageTierExchange id={selected} pressure={pressure} />
                      : <SystemTableObservatory id={selected} pressure={pressure} />
    : <MergeFamilyMachine family={family} strategy={strategy} pressure={pressure} mobile={mobile} exploded={exploded} scenario={scenario} />;
  return (
    <group>
      <mesh position={[0, -0.55, 0]} receiveShadow><cylinderGeometry args={[9.4, 9.8, 0.8, 64]} /><meshStandardMaterial color="#D8D8D8" roughness={0.76} metalness={0.05} /></mesh>
      <mesh position={[0, -0.1, 0]} receiveShadow><cylinderGeometry args={[8.9, 9.15, 0.18, 64]} /><meshStandardMaterial color="#FFFFFF" roughness={0.72} /></mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[6.7, 6.76, 64]} /><meshBasicMaterial color={pressure ? COLORS.pressure : COLORS.yellow} transparent opacity={0.68} /></mesh>
      <FloorInstrumentation pressure={pressure} />
      {showMergeTreeLandmark && <MergeTreeVoxelLandmark mobile={mobile} />}
      {activeMachine}
    </group>
  );
}

function CameraRig({ viewport }: { viewport: SceneViewport }) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const controls = useThree((state) => state.controls) as { target: THREE.Vector3; update: () => void } | null;
  const viewLevel = useAtlasStore((state) => state.viewLevel);
  const selected = useAtlasStore((state) => state.selectedMechanismId);
  const scenario = useAtlasStore((state) => state.scenario);
  const selectedEvidence = useAtlasStore((state) => state.selectedEvidenceId);
  const journeyPanelOpen = useAtlasStore((state) => state.journeyPanelOpen);
  const activeJourneyId = useAtlasStore((state) => state.activeJourneyId);
  const journeyStepIndex = useAtlasStore((state) => state.journeyStepIndex);
  const reducedMotion = useAtlasStore((state) => state.reducedMotion);
  const activeJourney = activeJourneyId ? useCaseJourneyById(activeJourneyId) : undefined;
  const activeJourneyStep = activeJourney?.guidePath[Math.min(Math.max(0, journeyStepIndex), activeJourney.guidePath.length - 1)];
  const journeyCameraHeight = journeyPanelOpen && activeJourneyStep ? JOURNEY_CAMERA_HEIGHT[activeJourneyStep.phase] : null;
  const desiredPosition = useRef(new THREE.Vector3());
  const desiredTarget = useRef(new THREE.Vector3());
  const lastFov = useRef(camera.fov);
  useFrame((_, delta) => {
    const xray = selected === "mergetree.part-anatomy" && viewLevel === "xray";
    const fov = xray ? (viewport.mobile ? 44 : 36) : viewport.mobile ? 43 : viewport.narrow ? 37 : viewport.compact ? 36 : 35;
    if (lastFov.current !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
      lastFov.current = fov;
    }
    if (xray) {
      desiredPosition.current.set(viewport.mobile ? 10 : 10.5, 7.2, 14);
      desiredTarget.current.set(0, 2.15, 0);
    } else if (viewport.mobile) {
      desiredPosition.current.set(10.1, viewport.compact ? 6.45 : 6.8, viewport.compact ? 14.1 : 14.7);
      desiredTarget.current.set(0.35, viewport.compact ? 1.85 : 2.05, 0);
    } else {
      desiredPosition.current.set(viewport.narrow ? 10.4 : 10.9, viewport.compact ? 7.5 : 7.8, viewport.narrow ? 14.8 : 15.6);
      const framingTargetX = journeyPanelOpen ? 3.75 : scenario === "aggregation-spill" || scenario === "replica-lag" || scenario === "keeper-quorum-loss" ? 3.05 : selectedEvidence ? 2.15 : selected ? 2.1 : viewport.narrow ? -0.35 : -0.9;
      desiredTarget.current.set(framingTargetX, journeyCameraHeight ?? (viewport.compact ? 3.15 : 2.75), 0);
    }
    const damping = journeyPanelOpen && activeJourneyStep ? 8.5 : 3.4;
    const factor = reducedMotion ? 1 : 1 - Math.exp(-delta * damping);
    camera.position.lerp(desiredPosition.current, factor);
    if (controls) { controls.target.lerp(desiredTarget.current, factor); controls.update(); } else camera.lookAt(desiredTarget.current);
  });
  return null;
}

function SimulationDriver() {
  const smoothTime = useRef(0);
  const lastPublishedTime = useRef(0);
  const lastStoryRevision = useRef(useAtlasStore.getState().storyRevision);
  const publishAccumulator = useRef(0);
  const wasPlaying = useRef(true);
  useFrame((_, delta) => {
    const state = useAtlasStore.getState();
    const storyRestarted = state.storyRevision !== lastStoryRevision.current;
    const externallyChanged = storyRestarted || Math.abs(state.simulationTime - lastPublishedTime.current) > 0.001;
    if (externallyChanged) {
      smoothTime.current = state.simulationTime;
      resetMachineRenderTime(state.simulationTime);
    } else if (wasPlaying.current && !state.playing) {
      smoothTime.current = state.simulationTime;
    }
    lastStoryRevision.current = state.storyRevision;
    // Keep semantic time close to wall time even when a software GPU drops
    // below 10 FPS. The previous 100 ms clamp made every mechanism appear to
    // stall under load; 250 ms is still bounded enough to preserve readable
    // stage transitions without turning slow frames into multi-second jumps.
    const frameDelta = Math.min(delta, 0.25) * state.speed;
    if (state.playing) {
      smoothTime.current += frameDelta;
      if (!state.reducedMotion) advanceMachineRenderTime(frameDelta);
    }
    let nextTime = smoothTime.current;
    const duration = state.storyEvents.length ? storyDuration(state.storyEvents) : 30;
    if (!state.storyEvents.length && nextTime >= duration) {
      nextTime %= duration;
      smoothTime.current = nextTime;
    }
    publishAccumulator.current += delta;
    if (publishAccumulator.current >= 1 / 20 || externallyChanged) {
      state.setSimulationTime(nextTime);
      lastPublishedTime.current = nextTime;
      publishAccumulator.current = 0;
    }
    wasPlaying.current = state.playing;
    if (!state.storyEvents.length) return;
    const index = eventIndexAtTime(state.storyEvents, Math.min(nextTime, duration));
    if (index >= 0 && index !== state.storyIndex) state.setStoryIndex(index);
    if (state.playing && nextTime >= duration) {
      smoothTime.current = duration;
      state.setSimulationTime(duration);
      lastPublishedTime.current = duration;
      state.setPlaying(false);
    }
  });
  return null;
}

function PerformanceProbe() {
  const gl = useThree((state) => state.gl);
  const samples = useRef<number[]>([]);
  useFrame((_, delta) => {
    if (document.visibilityState === "hidden" || delta <= 0 || !Number.isFinite(delta)) return;
    // Report a slow software-rendered scene instead of silently discarding it.
    // The cap still excludes a suspended-tab jump from poisoning the average.
    samples.current.push(Math.min(delta, 0.5));
    if (samples.current.length < 30) return;
    const average = samples.current.reduce((sum, value) => sum + value, 0) / samples.current.length;
    document.documentElement.dataset.sceneFps = Math.min(60, 1 / average).toFixed(1);
    document.documentElement.dataset.sceneDrawCalls = String(gl.info.render.calls);
    samples.current.splice(0, 15);
  });
  return null;
}

function World({ viewport, onPerformanceDecline }: { viewport: SceneViewport; onPerformanceDecline: () => void }) {
  return <><PerformanceMonitor flipflops={2} onDecline={onPerformanceDecline} /><color attach="background" args={["#FFFFFF"]} /><fog attach="fog" args={["#FFFFFF", 24, 50]} /><hemisphereLight args={["#FFFFFF", "#737373", 1.8]} /><directionalLight position={[-10, 18, 12]} intensity={3.1} color="#FFF7D2" /><directionalLight position={[12, 9, -10]} intensity={1.15} color="#D8F7F4" /><pointLight position={[-1, 5, 2]} intensity={15} distance={14} decay={2} color={COLORS.yellow} /><MergeTreeFoundry mobile={viewport.mobile} /><ContactShadows position={[0, -0.02, 0]} opacity={0.25} scale={21} blur={2.6} far={12} resolution={viewport.mobile ? 192 : viewport.compact ? 256 : 384} frames={1} color="#343735" /><OrbitControls makeDefault enableDamping dampingFactor={0.07} minDistance={8} maxDistance={32} minPolarAngle={0.55} maxPolarAngle={1.38} enablePan={!viewport.mobile} panSpeed={0.45} rotateSpeed={0.4} zoomSpeed={0.62} /><CameraRig viewport={viewport} /><SimulationDriver /><PerformanceProbe /></>;
}

class SceneErrorBoundary extends Component<{ children: ReactNode; resetKey: number; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("The 3D scene stopped safely.", error, info.componentStack);
    this.props.onFailure();
  }
  componentDidUpdate(previous: Readonly<{ resetKey: number }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() { return this.state.failed ? null : this.props.children; }
}

export function WorldCanvas() {
  const root = useRef<HTMLDivElement>(null);
  const recoveryTimer = useRef<number | null>(null);
  const recoveryWindowStartedAt = useRef(0);
  const recoveryAttempts = useRef(0);
  const [sceneKey, setSceneKey] = useState(0);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [dprCap, setDprCap] = useState(1.15);
  const [viewport, setViewport] = useState<SceneViewport>(() => viewportProfile(
    typeof window === "undefined" ? 1280 : window.innerWidth,
    typeof window === "undefined" ? 720 : window.innerHeight,
  ));
  useEffect(() => {
    const element = root.current;
    if (!element) return undefined;
    const update = (width: number, height: number) => {
      const next = viewportProfile(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
      setViewport((current) => current.width === next.width && current.height === next.height ? current : next);
    };
    const rect = element.getBoundingClientRect();
    update(rect.width, rect.height);
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width, entry.contentRect.height));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = root.current?.querySelector("canvas");
    if (!canvas) return undefined;
    const scheduleRecovery = () => {
      const now = Date.now();
      if (now - recoveryWindowStartedAt.current > 10_000) {
        recoveryWindowStartedAt.current = now;
        recoveryAttempts.current = 0;
      }
      recoveryAttempts.current += 1;
      setSceneFailed(true);
      setDprCap(1);
      if (recoveryTimer.current !== null) window.clearTimeout(recoveryTimer.current);
      if (recoveryAttempts.current > 2) return;
      recoveryTimer.current = window.setTimeout(() => {
        setSceneFailed(false);
        setSceneKey((value) => value + 1);
        recoveryTimer.current = null;
      }, 700);
    };
    const onLost = (event: Event) => { event.preventDefault(); scheduleRecovery(); };
    const onRestored = () => {
      recoveryAttempts.current = 0;
      setSceneFailed(false);
      setSceneKey((value) => value + 1);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      document.body.style.cursor = "default";
    };
  }, [sceneKey]);
  useEffect(() => () => {
    if (recoveryTimer.current !== null) window.clearTimeout(recoveryTimer.current);
  }, []);
  const restart = () => {
    if (recoveryTimer.current !== null) window.clearTimeout(recoveryTimer.current);
    recoveryTimer.current = null;
    recoveryAttempts.current = 0;
    setSceneFailed(false);
    setDprCap(1);
    setSceneKey((value) => value + 1);
  };
  const recoverFromBoundary = () => {
    const now = Date.now();
    if (now - recoveryWindowStartedAt.current > 10_000) {
      recoveryWindowStartedAt.current = now;
      recoveryAttempts.current = 0;
    }
    recoveryAttempts.current += 1;
    setSceneFailed(true);
    setDprCap(1);
    if (recoveryTimer.current !== null) window.clearTimeout(recoveryTimer.current);
    if (recoveryAttempts.current > 2) return;
    recoveryTimer.current = window.setTimeout(() => {
      setSceneFailed(false);
      setSceneKey((value) => value + 1);
      recoveryTimer.current = null;
    }, 700);
  };
  return <div className="world-canvas" ref={root}><SceneErrorBoundary resetKey={sceneKey} onFailure={recoverFromBoundary}><Canvas key={sceneKey} aria-hidden="true" shadows={false} dpr={[1, dprCap]} camera={{ position: [12.8, 9.35, 18.1], fov: viewport.mobile ? 43 : 35, near: 0.1, far: 100 }} gl={{ antialias: !viewport.compact, alpha: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.02 }}><Suspense fallback={null}><World viewport={viewport} onPerformanceDecline={() => setDprCap(1)} /></Suspense></Canvas></SceneErrorBoundary>{sceneFailed && <div className="scene-fallback" role="alert"><strong>Rebuilding the foundry</strong><p>Recovering the 3D scene at a safer quality level.</p><div><button type="button" onClick={restart}>Restart now</button></div></div>}</div>;
}
