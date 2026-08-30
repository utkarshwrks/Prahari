"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, Line, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { forceLink, forceManyBody, forceSimulation } from "d3-force";
import type { ActorProfile } from "@/lib/api";

/**
 * Explainable 3D relationship graph.
 *
 * Every visual choice carries meaning and is stated on-screen: node colour is
 * the entity type, node size is importance, edge thickness and colour are the
 * evidence strength and kind. Clicking a node explains what it is and how it
 * ties the actor together; hovering lifts its connections. The strong ties pull
 * the true actor tight while a decoy, sharing nothing hard, drifts to the rim.
 */

export type GraphSelection =
  | { type: "node"; id: string; label: string; kind: string; detail: string }
  | { type: "pair"; pairId: string }
  | null;

type N = {
  id: string; label: string; kind: string; color: number; size: number;
  detail: string; x?: number; y?: number; z?: number; fx?: number; fy?: number; fz?: number;
};
type L = { source: string | N; target: string | N; strength: number; color: number; kind: string; pairId?: string };

const C = {
  actor: 0xe8503a, persona: 0xe9e9ee, pgp: 0xe8503a, wallet: 0xd9a441,
  email: 0x5b9bd5, onion: 0x7fb77e, infra: 0x9b7fd8,
};
const IDENT_COLOR: Record<string, number> = {
  pgp: C.pgp, wallet: C.wallet, email: C.email, onion: C.onion,
};

export const LEGEND: { kind: string; color: string; label: string }[] = [
  { kind: "actor", color: "#e8503a", label: "Actor (resolved identity)" },
  { kind: "persona", color: "#e9e9ee", label: "Persona (one handle)" },
  { kind: "pgp", color: "#e8503a", label: "PGP key" },
  { kind: "wallet", color: "#d9a441", label: "Wallet" },
  { kind: "email", color: "#5b9bd5", label: "Email / contact" },
  { kind: "infra", color: "#9b7fd8", label: "Infrastructure" },
];

function shortVal(v: string) {
  return v.length > 20 ? `${v.slice(0, 10)}…${v.slice(-6)}` : v;
}

function buildGraph(p: ActorProfile): { nodes: N[]; links: L[] } {
  const nodes: N[] = [{
    id: p.actor_id, label: p.label, kind: "actor", color: C.actor, size: 0.42,
    detail: `Resolved actor with ${p.personas.length} personas. Attribution confidence ${p.attribution_confidence?.toFixed(3) ?? "—"}.`,
  }];
  const links: L[] = [];

  for (const s of p.personas) {
    nodes.push({
      id: s.id, label: s.handle, kind: "persona", color: C.persona, size: 0.28,
      detail: `${s.handle} on ${s.market}. ${s.post_count} posts, ${s.first_seen?.slice(0, 10)} → ${s.last_seen?.slice(0, 10)}.`,
    });
    links.push({ source: p.actor_id, target: s.id, strength: 0.5, color: 0x3a3a44, kind: "membership" });
  }

  for (const i of p.identifiers) {
    const nid = `${i.kind}:${i.value}`;
    nodes.push({
      id: nid, label: shortVal(i.value), kind: i.kind, color: IDENT_COLOR[i.kind] ?? C.email,
      size: i.shared ? 0.26 : 0.17,
      detail: `${i.kind.toUpperCase()} ${i.value}. ${i.shared ? `Shared across ${i.personas.length} personas — a hard identifier that resolved this actor.` : "Seen on one persona."}`,
    });
    for (const pid of i.personas) {
      links.push({ source: pid, target: nid, strength: i.shared ? 0.95 : 0.4, color: i.shared ? IDENT_COLOR[i.kind] ?? C.pgp : 0x3a3a44, kind: i.shared ? "shared identifier" : "identifier" });
    }
  }

  for (const x of p.infrastructure) {
    const nid = `infra:${x.clearnet_host}`;
    nodes.push({
      id: nid, label: x.clearnet_host, kind: "infra", color: C.infra, size: 0.22,
      detail: `Clearnet host ${x.clearnet_host}, pivoted from the actor's onion at strength ${x.strength}.`,
    });
    for (const s of p.personas) links.push({ source: s.id, target: nid, strength: x.strength, color: C.infra, kind: "infra pivot" });
  }

  for (const l of p.linkages) {
    links.push({
      source: l.persona_a, target: l.persona_b, strength: l.confidence,
      color: l.confidence >= 0.75 ? C.actor : 0x63636e, kind: "linkage",
      pairId: `${l.persona_a}|${l.persona_b}`,
    });
  }

  return { nodes, links };
}

function curve(a: THREE.Vector3, b: THREE.Vector3) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.add(mid.clone().normalize().multiplyScalar(0.25));
  return new THREE.QuadraticBezierCurve3(a, mid, b);
}

function GraphScene({
  profile, selected, onSelect,
}: { profile: ActorProfile; selected: string | null; onSelect: (s: GraphSelection) => void }) {
  const { nodes, links } = useMemo(() => buildGraph(profile), [profile]);
  const [, tick] = useState(0);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    // Seed positions in a tight cloud near the origin. d3's default phyllotaxis
    // seeding throws nodes ~30+ units out; with decaying alpha they never get
    // pulled back and end up off-camera. A small seed keeps them in frame.
    nodes.forEach((n) => {
      if (n.fx === undefined) { n.x = (Math.random() - 0.5) * 1.5; n.y = (Math.random() - 0.5) * 1.5; }
      n.z = (Math.random() - 0.5) * 1.5;
    });
    const sim = forceSimulation<N>(nodes)
      .force("charge", forceManyBody().strength(-4.4))
      .force("link", forceLink<N, L>(links).id((d) => d.id)
        .distance((l) => 1.75 - l.strength * 0.5)
        .strength((l) => 0.1 + l.strength * 0.6))
      .stop();
    for (let i = 0; i < 300; i++) {
      sim.tick();
      nodes.forEach((n) => {
        if (n.fz === undefined) {
          let zt = 0, w = 0;
          links.forEach((l) => {
            const s = l.source as N, t = l.target as N;
            if (s.id === n.id) { zt += (t.z ?? 0) * l.strength; w += l.strength; }
            else if (t.id === n.id) { zt += (s.z ?? 0) * l.strength; w += l.strength; }
          });
          n.z = (n.z ?? 0) * 0.9 + (w ? zt / w : 0) * 0.1;
        }
      });
    }
    // Normalise: centre on the centroid and scale to a fixed radius so the graph
    // ALWAYS frames itself in view, regardless of how the simulation settled.
    let cx = 0, cy = 0, cz = 0;
    nodes.forEach((n) => { cx += n.x ?? 0; cy += n.y ?? 0; cz += n.z ?? 0; });
    cx /= nodes.length; cy /= nodes.length; cz /= nodes.length;
    let maxR = 0.001;
    nodes.forEach((n) => {
      const dx = (n.x ?? 0) - cx, dy = (n.y ?? 0) - cy, dz = (n.z ?? 0) - cz;
      maxR = Math.max(maxR, Math.hypot(dx, dy, dz));
    });
    const k = 2.15 / maxR;
    nodes.forEach((n) => {
      n.x = ((n.x ?? 0) - cx) * k;
      n.y = ((n.y ?? 0) - cy) * k;
      n.z = ((n.z ?? 0) - cz) * k;
    });
    tick((v) => v + 1);
    return () => { sim.stop(); };
  }, [nodes, links]);

  const rot = useRef<THREE.Group>(null);
  useFrame((_, d) => { if (rot.current && !hover && !selected) rot.current.rotation.y += d * 0.07; });

  const pos = (n: N) => new THREE.Vector3(n.x ?? 0, n.y ?? 0, n.z ?? 0);
  const isConnected = (id: string) =>
    hover != null && links.some((l) =>
      ((l.source as N).id === hover && (l.target as N).id === id) ||
      ((l.target as N).id === hover && (l.source as N).id === id) || id === hover);

  return (
    <group ref={rot}>
      {/* halo */}
      <mesh>
        <sphereGeometry args={[2.6, 32, 32]} />
        <meshBasicMaterial color={0x13131a} transparent opacity={0.25} side={THREE.BackSide} />
      </mesh>

      {links.map((l, i) => {
        const a = pos(l.source as N), b = pos(l.target as N);
        const pts = curve(a, b).getPoints(24);
        const active = hover
          ? (l.source as N).id === hover || (l.target as N).id === hover
          : selected
            ? (l.source as N).id === selected || (l.target as N).id === selected
            : true;
        return (
          <Line
            key={i} points={pts} color={l.color}
            lineWidth={0.6 + l.strength * 2.4}
            transparent opacity={active ? 0.3 + l.strength * 0.55 : 0.06}
            onClick={(e) => { if (l.pairId) { e.stopPropagation(); onSelect({ type: "pair", pairId: l.pairId }); } }}
          />
        );
      })}

      {nodes.map((n) => {
        const sel = selected === n.id;
        const dim = hover && !isConnected(n.id);
        // Only the actor is labelled at rest — persona/identifier labels would
        // collide in the tight central cluster. Everything else reveals its
        // label on hover or when selected. Colour + legend carry type at rest.
        const showLabel = sel || hover === n.id || n.kind === "actor";
        // Push the label radially OUTWARD from the graph centre so it clears the
        // central cluster instead of landing on a neighbouring node.
        const p = pos(n);
        const r = Math.hypot(p.x, p.y, p.z);
        const out = r > 0.05
          ? new THREE.Vector3(p.x / r, p.y / r, p.z / r)
          : new THREE.Vector3(0, 1, 0);
        const labelPos: [number, number, number] = [
          out.x * (n.size + 0.34),
          out.y * (n.size + 0.34) + 0.06,
          out.z * (n.size + 0.34),
        ];
        return (
          <group key={n.id} position={p}>
            {/* soft glow halo — cheap bloom */}
            <mesh>
              <sphereGeometry args={[n.size * (sel ? 2.3 : 1.7), 16, 16]} />
              <meshBasicMaterial color={n.color} transparent opacity={dim ? 0.03 : sel ? 0.14 : 0.07}
                blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            <mesh
              onPointerOver={(e) => { e.stopPropagation(); setHover(n.id); }}
              onPointerOut={() => setHover(null)}
              onClick={(e) => { e.stopPropagation(); onSelect({ type: "node", id: n.id, label: n.label, kind: n.kind, detail: n.detail }); }}
            >
              <sphereGeometry args={[n.size * (sel ? 1.25 : 1), 32, 32]} />
              <meshStandardMaterial
                color={n.color} emissive={n.color}
                emissiveIntensity={sel ? 1.0 : n.kind === "actor" ? 0.7 : 0.36}
                roughness={0.3} metalness={0.1} transparent opacity={dim ? 0.25 : 1}
              />
            </mesh>
            {sel && (
              <mesh>
                <ringGeometry args={[n.size * 1.45, n.size * 1.62, 40]} />
                <meshBasicMaterial color={n.color} side={THREE.DoubleSide} transparent opacity={0.8} />
              </mesh>
            )}
            {showLabel && (
              <Billboard position={labelPos}>
                <Text
                  fontSize={n.kind === "actor" ? 0.17 : 0.135}
                  color="#F4F4F7" anchorX="center" anchorY="middle"
                  outlineWidth={0.03} outlineColor="#050507" outlineOpacity={0.9}
                  fillOpacity={dim ? 0.35 : 1}
                >
                  {n.label}
                </Text>
              </Billboard>
            )}
          </group>
        );
      })}
    </group>
  );
}

export default function ActorGraph3D({
  profile, onSelect, selected,
}: { profile: ActorProfile; onSelect: (s: GraphSelection) => void; selected: string | null }) {
  return (
    <Canvas camera={{ position: [0, 0, 5.2], fov: 50 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => onSelect(null)}>
      <ambientLight intensity={0.75} />
      <pointLight position={[4, 4, 4]} intensity={0.5} />
      <pointLight position={[-4, -2, -3]} intensity={0.3} color={0x5b9bd5} />
      <GraphScene profile={profile} selected={selected} onSelect={onSelect} />
      <OrbitControls enablePan={false} enableZoom minDistance={2.8} maxDistance={10} rotateSpeed={0.6} />
    </Canvas>
  );
}
