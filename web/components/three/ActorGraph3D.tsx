"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, Line, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import {
  forceCenter, forceLink, forceManyBody, forceSimulation, type Simulation,
} from "d3-force";
import type { ActorProfile } from "@/lib/api";

/**
 * The actor as a 3D relationship graph — the workbench centrepiece.
 *
 * Personas orbit the actor core; identifiers and infrastructure hang off the
 * personas that carry them. Edge colour encodes evidence strength, so the
 * shared PGP key that resolved the actor is visibly the strongest tie. Click a
 * persona-to-persona edge to open its evidence trail.
 *
 * d3-force lays it out in 3D; three renders it. It is genuinely spatial —
 * orbit, zoom, and the strong ties pull the true actor tight while the decoy,
 * sharing nothing hard, drifts to the edge.
 */

type N = {
  id: string; label: string; kind: string; color: number;
  size: number; x?: number; y?: number; z?: number;
  fx?: number; fy?: number; fz?: number;
};
type L = { source: string | N; target: string | N; strength: number; color: number; pairId?: string };

const C = {
  actor: 0xe8503a, persona: 0xededf0, pgp: 0xe8503a, wallet: 0xd9a441,
  email: 0x5b9bd5, onion: 0x7fb77e, infra: 0x5b9bd5,
};
const IDENT_COLOR: Record<string, number> = {
  pgp: C.pgp, wallet: C.wallet, email: C.email, onion: C.onion,
};

function buildGraph(p: ActorProfile): { nodes: N[]; links: L[] } {
  const nodes: N[] = [{ id: p.actor_id, label: p.label, kind: "actor", color: C.actor, size: 0.5, fx: 0, fy: 0, fz: 0 }];
  const links: L[] = [];

  for (const s of p.personas) {
    nodes.push({ id: s.id, label: s.handle, kind: "persona", color: C.persona, size: 0.32 });
    links.push({ source: p.actor_id, target: s.id, strength: 0.5, color: 0x32323c });
  }

  // Identifiers, hung off the personas that carry them.
  for (const i of p.identifiers) {
    const nid = `${i.kind}:${i.value}`;
    nodes.push({ id: nid, label: i.value.slice(0, 8), kind: i.kind, color: IDENT_COLOR[i.kind] ?? C.email, size: i.shared ? 0.24 : 0.16 });
    for (const pid of i.personas) {
      links.push({ source: pid, target: nid, strength: i.shared ? 0.95 : 0.4, color: i.shared ? C.pgp : 0x3a3a44 });
    }
  }

  // Infrastructure pivots.
  for (const x of p.infrastructure) {
    const nid = `infra:${x.clearnet_host}`;
    nodes.push({ id: nid, label: x.clearnet_host, kind: "infra", color: C.infra, size: 0.2 });
    for (const s of p.personas) {
      links.push({ source: s.id, target: nid, strength: x.strength, color: C.infra });
    }
  }

  // Persona↔persona linkages, clickable.
  for (const l of p.linkages) {
    links.push({
      source: l.persona_a, target: l.persona_b, strength: l.confidence,
      color: l.confidence >= 0.75 ? C.actor : 0x63636e,
      pairId: `${l.persona_a}|${l.persona_b}`,
    });
  }

  return { nodes, links };
}

function GraphScene({ profile, onOpenPair }: { profile: ActorProfile; onOpenPair: (id: string) => void }) {
  const { nodes, links } = useMemo(() => buildGraph(profile), [profile]);
  const simRef = useRef<Simulation<N, L> | null>(null);
  const [, force] = useState(0);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const sim = forceSimulation<N>(nodes)
      .force("charge", forceManyBody().strength(-2))
      .force("center", forceCenter(0, 0))
      .force("link", forceLink<N, L>(links).id((d) => d.id)
        .distance((l) => 1.2 - l.strength * 0.6)
        .strength((l) => 0.1 + l.strength * 0.6))
      .stop();
    // 3D: nudge z by hand each tick since d3-force is 2D.
    nodes.forEach((n) => { n.z = (Math.random() - 0.5) * 2; });
    for (let i = 0; i < 200; i++) {
      sim.tick();
      nodes.forEach((n) => {
        if (n.fz === undefined) {
          const pull = links.filter((l) => (l.source as N).id === n.id || (l.target as N).id === n.id);
          let zt = 0;
          pull.forEach((l) => {
            const other = (l.source as N).id === n.id ? (l.target as N) : (l.source as N);
            zt += (other.z ?? 0) * l.strength;
          });
          n.z = (n.z ?? 0) * 0.9 + zt * 0.02;
        }
      });
    }
    simRef.current = sim;
    force((v) => v + 1);
    return () => { sim.stop(); };
  }, [nodes, links]);

  const rot = useRef<THREE.Group>(null);
  useFrame((_, d) => { if (rot.current) rot.current.rotation.y += d * 0.08; });

  const pos = (n: N) => new THREE.Vector3(n.x ?? 0, n.y ?? 0, n.z ?? 0);

  return (
    <group ref={rot}>
      {links.map((l, i) => {
        const a = pos(l.source as N), b = pos(l.target as N);
        return (
          <Line
            key={i}
            points={[a, b]}
            color={l.color}
            lineWidth={0.5 + l.strength * 2}
            transparent
            opacity={0.25 + l.strength * 0.5}
            onClick={(e) => { if (l.pairId) { e.stopPropagation(); onOpenPair(l.pairId); } }}
          />
        );
      })}
      {nodes.map((n) => (
        <group key={n.id} position={pos(n)}>
          <mesh
            onPointerOver={(e) => { e.stopPropagation(); setHover(n.id); }}
            onPointerOut={() => setHover(null)}
          >
            <sphereGeometry args={[n.size, 16, 16]} />
            <meshStandardMaterial
              color={n.color}
              emissive={n.color}
              emissiveIntensity={n.kind === "actor" ? 0.6 : 0.3}
              roughness={0.4}
            />
          </mesh>
          {(hover === n.id || n.kind === "actor" || n.kind === "persona") && (
            <Billboard position={[0, n.size + 0.18, 0]}>
              <Text fontSize={0.16} color="#EDEDF0" anchorX="center" anchorY="middle"
                outlineWidth={0.008} outlineColor="#0B0B0E">
                {n.label}
              </Text>
            </Billboard>
          )}
        </group>
      ))}
    </group>
  );
}

export default function ActorGraph3D({
  profile, onOpenPair,
}: { profile: ActorProfile; onOpenPair: (id: string) => void }) {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.7} />
      <pointLight position={[4, 4, 4]} intensity={0.6} />
      <GraphScene profile={profile} onOpenPair={onOpenPair} />
      <OrbitControls enablePan={false} enableZoom minDistance={2.5} maxDistance={9} rotateSpeed={0.6} />
    </Canvas>
  );
}
