import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { gotchaBeatById, gotchaStoryById } from "../../data/gotchas";
import { useAtlasStore } from "../../store/useAtlasStore";
import type { GotchaId } from "../../types";

const YELLOW = "#FFCC01";
const CYAN = "#78D7D2";
const RED = "#D64C3F";
const BLACK = "#15171A";
const WHITE = "#F3F2EC";
const GREY = "#BFC2BD";

function Material({ color, emissive = false, transparent = false, opacity = 1 }: { color: string; emissive?: boolean; transparent?: boolean; opacity?: number }) {
  return <meshStandardMaterial color={color} roughness={0.38} metalness={0.12} emissive={emissive ? color : BLACK} emissiveIntensity={emissive ? 0.18 : 0} transparent={transparent} opacity={opacity} />;
}

function Plinth({ position = [0, 0, 0], size = [4, .3, 3] }: { position?: [number, number, number]; size?: [number, number, number] }) {
  return <group position={position}><mesh receiveShadow><boxGeometry args={size} /><Material color="#D6D7D2" /></mesh><mesh position={[0, size[1] / 2 + .04, 0]}><boxGeometry args={[size[0] * .94, .07, size[2] * .9]} /><Material color="#FAFAF7" /></mesh></group>;
}

function Cassette({ position, color = YELLOW, scale = 1 }: { position: [number, number, number]; color?: string; scale?: number }) {
  return <group position={position} scale={scale}>
    <mesh castShadow><boxGeometry args={[1.15, .76, .9]} /><Material color="#EEF0EC" /></mesh>
    <mesh position={[0, .39, 0]}><boxGeometry args={[1.04, .08, .8]} /><Material color={color} /></mesh>
    {[-.4,-.16,.08,.32].map((x,index) => <mesh key={x} position={[x,-.05,.46]}><boxGeometry args={[.12,.43,.035]} /><Material color={index === 1 ? CYAN : index === 2 ? "#C5B8E8" : color} /></mesh>)}
  </group>;
}

function Belt({ position, size = [4.8,.18,1.3], color = "#D0D2CE" }: { position: [number,number,number]; size?: [number,number,number]; color?: string }) {
  return <group position={position}><mesh><boxGeometry args={size} /><Material color={color} /></mesh><mesh position={[0,.13,0]}><boxGeometry args={[size[0] * .92,.06,size[2] * .68]} /><Material color="#F5F5F1" /></mesh></group>;
}

function SceneTitle({ title, beat }: { title: string; beat: string }) {
  return <Html pointerEvents="none" center position={[1.1, 4.8, -2.8]} distanceFactor={10}><div className="gotcha-scene-title"><span>{beat}</span><strong>{title}</strong></div></Html>;
}

function FlowPulse({ points, color = CYAN, offset = 0 }: { points: Array<[number,number,number]>; color?: string; offset?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))), [points]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const state = useAtlasStore.getState();
    const t = state.reducedMotion ? 1 : ((clock.elapsedTime * .24 + offset) % 1);
    ref.current.position.copy(curve.getPoint(t));
  });
  return <><Line points={points} color={color} lineWidth={3} transparent opacity={.65} /><mesh ref={ref}><sphereGeometry args={[.12,12,12]} /><Material color={color} emissive /></mesh></>;
}

function MovingGroup({ target, children }: { target: [number,number,number]; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const reduced = useAtlasStore.getState().reducedMotion;
    const damping = reduced ? 1000 : 6.5;
    ref.current.position.x = THREE.MathUtils.damp(ref.current.position.x, target[0], damping, delta);
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, target[1], damping, delta);
    ref.current.position.z = THREE.MathUtils.damp(ref.current.position.z, target[2], damping, delta);
  });
  return <group ref={ref} position={target}>{children}</group>;
}

function PartsPressureScene({ beat }: { beat: number }) {
  const pressure = beat < 2;
  const queueCount = beat === 1 ? 12 : beat === 0 ? 8 : 4;
  return <group>
    <Plinth position={[-3.2,.1,.6]} size={[3.1,.3,4.5]} /><Plinth position={[2.4,.1,-.25]} size={[6.6,.3,4.9]} />
    <group position={[-3.2,1.35,.8]}>
      <mesh><cylinderGeometry args={[1.1,.65,1.5,6]} /><Material color={pressure ? RED : CYAN} transparent opacity={.82} /></mesh>
      <mesh position={[0,-1.05,0]}><boxGeometry args={[1.45,.55,1.25]} /><Material color={BLACK} /></mesh>
      <Html pointerEvents="none" center position={[0,1.2,0]} distanceFactor={10}><span className="scene-chip">ASYNC BUFFER</span></Html>
    </group>
    <group position={[-.85,.92,.8]}>{[-.72,0,.72].map((x,index) => <group key={x} position={[x,0,0]}><mesh><boxGeometry args={[.18,1.28,1.7]} /><Material color={index === 1 && pressure ? RED : BLACK} /></mesh><Html pointerEvents="none" center position={[0,-.9,0]} distanceFactor={11}><span className="scene-chip">P{index+1}</span></Html></group>)}</group>
    <Belt position={[2.5,.52,.8]} size={[5.5,.18,1.5]} />
    {Array.from({ length: queueCount }, (_, index) => <MovingGroup key={index} target={[-.05 + (index % 6) * .78,.98,1.08 - Math.floor(index / 6) * .92]}><Cassette position={[0,0,0]} color={pressure ? RED : YELLOW} scale={.55} /></MovingGroup>)}
    <group position={[4.65,1.3,.5]}><mesh><boxGeometry args={[1.15,2.25,1.8]} /><Material color={BLACK} /></mesh>{[.55,.05,-.45].map((y) => <mesh key={y} position={[-.59,y,0]}><boxGeometry args={[.1,.17,1.35]} /><Material color={YELLOW} /></mesh>)}</group>
    <FlowPulse points={[[-3.2,2.3,.8],[-3.2,.75,.8],[-1.1,.75,.8],[.2,.8,.8],[4.1,.8,.5]]} color={pressure ? RED : CYAN} />
  </group>;
}

function ScaleScene({ beat }: { beat: number }) {
  const distributed = beat > 0;
  const quorumVotes = beat === 3 ? 1 : beat === 2 ? 2 : 3;
  return <group>
    <Plinth position={[-2.7,.1,.6]} size={[3.6,.3,5]} /><Plinth position={[2.7,.1,.6]} size={[6.6,.3,5]} />
    <group position={[-2.7,1.55,.6]}>
      <mesh><boxGeometry args={[2.15,2.7,2]} /><Material color={BLACK} /></mesh>
      {[0,1,2].map((lane) => <mesh key={lane} position={[0,.78-lane*.78,1.03]}><boxGeometry args={[1.65,.33,.08]} /><Material color={lane === 1 ? CYAN : YELLOW} emissive={lane === 1} /></mesh>)}
      <Html pointerEvents="none" center position={[0,2.1,0]} distanceFactor={10}><span className="scene-chip">VERTICAL LANES</span></Html>
    </group>
    <group visible={distributed} position={[2.6,1.2,.8]}>{[-1.8,0,1.8].map((x,index) => <group key={x} position={[x,0,0]}><mesh><boxGeometry args={[1.25,1.85,1.5]} /><Material color={index === 1 ? YELLOW : "#E6E6E0"} /></mesh><mesh position={[0,.2,.78]}><boxGeometry args={[.82,.18,.06]} /><Material color={CYAN} /></mesh><Html pointerEvents="none" center position={[0,-1.35,0]} distanceFactor={10}><span className="scene-chip">SHARD {index+1}</span></Html></group>)}</group>
    <FlowPulse points={distributed ? [[-.9,2.2,.8],[.1,2.2,.8],[.8,1.65,.8],[2.6,1.65,.8],[4.4,1.65,.8]] : [[-4,2.2,.6],[-2.7,2.2,.6],[-1.5,2.2,.6]]} />
    <group position={[2.6,1.05,-2.25]}>{[-1.15,0,1.15].map((x,index) => <group key={x} position={[x,0,0]}><mesh><cylinderGeometry args={[.55,.55,1.15,8]} /><Material color={index < quorumVotes ? CYAN : RED} emissive={index < quorumVotes} /></mesh><Html pointerEvents="none" center position={[0,-.95,0]} distanceFactor={11}><span className="scene-chip">VOTE {index+1}</span></Html></group>)}<Line points={[[-1.15,0,0],[0,0,0],[1.15,0,0]]} color={quorumVotes >= 2 ? CYAN : RED} lineWidth={3} /></group>
    <Html pointerEvents="none" center position={[2.6,2.1,-2.25]} distanceFactor={10}><span className="scene-chip">KEEPER · METADATA ONLY</span></Html>
  </group>;
}

function UpdatesScene({ beat }: { beat: number }) {
  return <group>
    <Plinth position={[-2.4,.1,.7]} size={[4.5,.3,4.6]} /><Plinth position={[2.8,.1,.4]} size={[5.4,.3,4.8]} />
    <Cassette position={[-3.2,1.2,.8]} color={YELLOW} scale={1.2} />
    {beat < 2 && <group position={[-1.2,1.5,.8]}><mesh rotation={[0,0,.14]}><boxGeometry args={[.35,2.8,2.2]} /><Material color={RED} /></mesh><Html pointerEvents="none" center position={[0,1.8,0]} distanceFactor={10}><span className="scene-chip">FULL PART REWRITE</span></Html></group>}
    {beat >= 2 && <MovingGroup target={[-2.95,1.45,1.3]}><mesh><boxGeometry args={[.9,.16,.65]} /><Material color={CYAN} emissive /></mesh><Html pointerEvents="none" center position={[0,.5,0]} distanceFactor={10}><span className="scene-chip">PATCH PART</span></Html></MovingGroup>}
    <group position={[1.3,1.05,.7]}>{[0,1,2].map((index) => <group key={index} position={[index*.9, index*.42, -index*.22]}><Cassette position={[0,0,0]} color={index === 2 ? YELLOW : WHITE} scale={.7} /><Html pointerEvents="none" center position={[0,-.72,0]} distanceFactor={11}><span className="scene-chip">V{index+1}</span></Html></group>)}</group>
    <group position={[4.3,1.25,-.8]}><mesh><torusGeometry args={[.72,.2,12,32]} /><Material color={CYAN} /></mesh><mesh><boxGeometry args={[.45,.45,.45]} /><Material color={beat === 0 ? RED : YELLOW} /></mesh><Html pointerEvents="none" center position={[0,1.15,0]} distanceFactor={10}><span className="scene-chip">RETRY FINGERPRINT</span></Html></group>
    <FlowPulse points={[[-3.2,2.2,.8],[-1.8,2.2,.8],[.2,1.3,.8],[2.9,1.55,.2],[4.3,1.55,-.8]]} color={beat < 2 ? RED : CYAN} />
  </group>;
}

function ReadScene({ beat }: { beat: number }) {
  const good = beat >= 2;
  return <group>
    <Plinth position={[0,.1,.5]} size={[9,.3,5.2]} />
    <group position={[-.8,1.35,.4]}>{Array.from({ length: 9 }, (_, index) => {
      const selected = good ? index >= 3 && index <= 4 : index !== 7;
      return <group key={index} position={[-3.2+index*.8,0,0]}><mesh><boxGeometry args={[.58,2.1,1.5]} /><Material color={selected ? (good ? YELLOW : RED) : "#E7E8E4"} /></mesh>{[.55,.1,-.35].map((y) => <mesh key={y} position={[0,y,.77]}><boxGeometry args={[.42,.08,.04]} /><Material color={selected ? CYAN : GREY} /></mesh>)}</group>;
    })}</group>
    <mesh position={[-.8,2.8,.7]} rotation={[0,0,good ? -.05 : -.22]}><boxGeometry args={[7.8,.1,.12]} /><Material color={CYAN} emissive /></mesh>
    {beat === 1 && <group position={[3.9,1.1,-1.25]}><mesh><boxGeometry args={[1.8,1.1,.15]} /><Material color={YELLOW} /></mesh><Html pointerEvents="none" center position={[0,0,.15]} distanceFactor={9}><span className="scene-ticket">LIMIT 10</span></Html><mesh position={[-2.1,0,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.75,.2,12,32]} /><Material color={RED} /></mesh></group>}
    <Html pointerEvents="none" center position={[-.8,.15,1.55]} distanceFactor={10}><span className="scene-chip">{good ? "MOST GRANULES SKIPPED" : "MOST GRANULES READ"}</span></Html>
    <FlowPulse points={[[-4.8,3,.7],[-2.4,2.9,.7],[.2,2.7,.7],[3.1,2.35,.7],[4.2,1.4,-1.2]]} color={CYAN} />
  </group>;
}

function MemoryScene({ beat }: { beat: number }) {
  const spill = beat === 1;
  const fill = beat === 0 || spill ? 14 : 7;
  return <group>
    <Plinth position={[-2.3,.1,.5]} size={[4.6,.3,5]} /><Plinth position={[2.8,.1,.5]} size={[5.2,.3,5]} />
    <group position={[-2.4,1.7,.5]}>
      <mesh><cylinderGeometry args={[1.45,1.45,3.2,32,1,true]} /><Material color="#AEB2AF" transparent opacity={.22} /></mesh>
      <mesh position={[0,0,0]}><torusGeometry args={[1.45,.07,10,32]} /><Material color={RED} /></mesh>
      {Array.from({ length: fill }, (_, index) => <mesh key={index} position={[-.82+(index%4)*.55,-1.15+Math.floor(index/4)*.52,0]}><boxGeometry args={[.4,.38,.75]} /><Material color={index%3===0 ? CYAN : YELLOW} /></mesh>)}
      <Html pointerEvents="none" center position={[0,2.1,0]} distanceFactor={10}><span className="scene-chip">AGGREGATE STATES</span></Html>
    </group>
    <group position={[2.5,1.1,.55]}>{[0,1,2,3].map((index) => <group key={index} position={[-1.55+index*1.05,0,0]}><mesh><boxGeometry args={[.72,1.2,1.25]} /><Material color={beat >= 2 ? [YELLOW,CYAN,"#C5B8E8",BLACK][index]! : index === 0 ? RED : "#E1E2DE"} /></mesh><Html pointerEvents="none" center position={[0,-.95,0]} distanceFactor={11}><span className="scene-chip">{["HASH","GRACE","SORT","DIRECT"][index]}</span></Html></group>)}</group>
    <group position={[0,-.05,-1.65]} visible={spill}><mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[2.1,.22,10,48]} /><Material color={RED} /></mesh><Html pointerEvents="none" center position={[0,.5,0]} distanceFactor={10}><span className="scene-chip">EXTERNAL DISK LOOP</span></Html></group>
    <FlowPulse points={[[-4.5,2.1,.5],[-2.4,2.1,.5],[0,1.6,.5],[2.5,1.6,.5],[4.5,1.6,.5]]} color={spill ? RED : CYAN} />
  </group>;
}

function MaterializedViewScene({ beat }: { beat: number }) {
  const fanout = beat === 0;
  const bypass = beat === 1;
  return <group>
    <Plinth position={[-3.1,.1,.4]} size={[3.1,.3,5]} /><Plinth position={[2.1,.1,.4]} size={[7.2,.3,5]} />
    <Cassette position={[-3.1,1.35,.5]} color={YELLOW} scale={1.05} />
    <group position={[-.9,1.35,.5]}><mesh><boxGeometry args={[1.15,1.85,1.7]} /><Material color={BLACK} /></mesh><mesh position={[0,0,.88]}><torusGeometry args={[.42,.09,8,24]} /><Material color={bypass ? RED : CYAN} /></mesh><Html pointerEvents="none" center position={[0,1.45,0]} distanceFactor={10}><span className="scene-chip">INSERT TRIGGER</span></Html></group>
    <group position={[2.3,1.25,.5]}>{[0,1,2].map((index) => <group key={index} position={[index*1.55-1.55,0,(index-1)*.65]} visible={fanout || index === 1}><mesh><boxGeometry args={[1.15,1.55,1.25]} /><Material color={index === 1 ? CYAN : RED} /></mesh><Cassette position={[0,-.85,0]} color={YELLOW} scale={.55} /></group>)}</group>
    {beat >= 2 && <group position={[4.5,1.25,-1.05]}><mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[1,.18,12,36]} /><Material color={CYAN} /></mesh><mesh rotation={[0,0,-.55]}><boxGeometry args={[.12,1.5,.12]} /><Material color={CYAN} /></mesh><Html pointerEvents="none" center position={[0,1.55,0]} distanceFactor={10}><span className="scene-chip">REFRESHABLE · FULL REBUILD</span></Html></group>}
    {bypass && <FlowPulse points={[[-3.1,2.2,.5],[-1.5,2.2,.5],[-.9,2.6,.5],[2.4,3,.5]]} color={RED} />}
    {!bypass && <FlowPulse points={[[-3.1,2.2,.5],[-1.5,2.2,.5],[-.9,1.7,.5],[2.3,1.7,.5]]} color={CYAN} />}
  </group>;
}

export function GotchaVisualization({ id, beatIndex }: { id: GotchaId; beatIndex: number }) {
  const story = gotchaStoryById(id)!;
  const beat = gotchaBeatById(id, beatIndex)!;
  return <group position={[.6,0,0]}>
    <SceneTitle title={story.title} beat={`${beat.kind} · ${beat.heading}`} />
    {id === "parts-pressure" && <PartsPressureScene beat={beatIndex} />}
    {id === "scale-coordination" && <ScaleScene beat={beatIndex} />}
    {id === "updates-deduplication" && <UpdatesScene beat={beatIndex} />}
    {id === "read-path-surprises" && <ReadScene beat={beatIndex} />}
    {id === "memory-pressure" && <MemoryScene beat={beatIndex} />}
    {id === "materialized-view-traps" && <MaterializedViewScene beat={beatIndex} />}
  </group>;
}
