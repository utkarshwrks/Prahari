"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { NODES, arcCurve, latLngToVec3 } from "./geo";

const R = 2;

// Read the live skin colours so the hero globe matches whatever skin was drawn.
function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
const palette = () => ({
  accent: cssVar("--accent", "#E8503A"),
  accent2: cssVar("--accent-2", "#D9A441"),
  text: cssVar("--muted", "#5B9BD5"),
});

/** The point-cloud sphere — a globe drawn as a field of dots, not a texture. */
function Sphere() {
  const positions = useMemo(() => {
    const N = 2600;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // Fibonacci sphere for even distribution.
      const y = 1 - (i / (N - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = i * 2.399963;
      arr[i * 3] = Math.cos(theta) * radius * R;
      arr[i * 3 + 1] = y * R;
      arr[i * 3 + 2] = Math.sin(theta) * radius * R;
    }
    return arr;
  }, []);

  return (
    <Points positions={positions} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#2A3340"
        size={0.018}
        sizeAttenuation
        depthWrite={false}
        opacity={0.85}
      />
    </Points>
  );
}

/** A node marker sitting on the sphere surface with a soft glow. */
function Node({ position, color }: { position: [number, number, number]; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 2 + phase) * 0.25;
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

/** A pivot arc with a pulse of light travelling along it. */
function Arc({ curve, color }: { curve: THREE.CubicBezierCurve3; color: string }) {
  const pts = useMemo(() => curve.getPoints(48), [curve]);
  const dot = useRef<THREE.Mesh>(null);
  const offset = useMemo(() => Math.random(), []);
  useFrame(({ clock }) => {
    if (dot.current) {
      const t = (clock.elapsedTime * 0.28 + offset) % 1;
      dot.current.position.copy(curve.getPoint(t));
    }
  });
  return (
    <group>
      <Line points={pts} color={color} lineWidth={1} transparent opacity={0.4} />
      <mesh ref={dot}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function Scene() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.06;
  });

  const P = useMemo(() => palette(), []);
  const KIND_COLOR: Record<string, string> = {
    market: P.accent, clearnet: P.text, mixer: P.accent2,
  };

  const nodes = useMemo(
    () => NODES.map((n) => ({ ...n, pos: latLngToVec3(n.lat, n.lng, R) })),
    []
  );

  // Arcs: markets pivot to clearnet hosts, some flow to mixers.
  const arcs = useMemo(() => {
    const markets = nodes.filter((n) => n.kind === "market");
    const targets = nodes.filter((n) => n.kind !== "market");
    const out: { curve: THREE.CubicBezierCurve3; color: string }[] = [];
    markets.forEach((m, i) => {
      const t1 = targets[(i * 2) % targets.length];
      const t2 = targets[(i * 2 + 1) % targets.length];
      out.push({ curve: arcCurve(m.pos, t1.pos, 0.45), color: P.accent });
      out.push({ curve: arcCurve(m.pos, t2.pos, 0.55), color: t2.kind === "mixer" ? P.accent2 : P.text });
    });
    return out;
  }, [nodes, P]);

  return (
    <group ref={group} rotation={[0.35, 0, 0.1]}>
      <Sphere />
      {/* faint wire shell for depth */}
      <mesh>
        <sphereGeometry args={[R * 0.995, 32, 32]} />
        <meshBasicMaterial color="#0E1520" transparent opacity={0.35} />
      </mesh>
      {nodes.map((n, i) => (
        <Node key={i} position={[n.pos.x, n.pos.y, n.pos.z]} color={KIND_COLOR[n.kind]} />
      ))}
      {arcs.map((a, i) => (
        <Arc key={i} curve={a.curve} color={a.color} />
      ))}
    </group>
  );
}

function SceneLight() {
  const color = useMemo(() => palette().accent, []);
  return <pointLight position={[5, 3, 5]} intensity={0.8} color={color} />;
}

export default function Globe() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.6} />
      <SceneLight />
      <Scene />
    </Canvas>
  );
}
