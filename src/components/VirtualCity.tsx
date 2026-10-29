"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type * as THREE from "three";
import type { Agent } from "./OfficeView";

/* ───────────────────────────────────────────────────────────
   Blue Mogul AI · VirtualCity — a license-clean 3D city built
   from scratch with three.js / @react-three/fiber / @react-three/drei.
   No embedded third-party world. Renders one 3D marker per agent
   in the /api/agents roster.

   Calm Luxury palette: navy #0f172a + gold accent #D4AF37.
   Marker color encodes agent status:
     green  → working | online | active
     amber  → idle | completed
     gray   → offline
     red    → error
   ─────────────────────────────────────────────────────────── */

export const CALM_LUXURY = {
  navy: "#0a1120",
  navyGround: "#0f172a",
  gold: "#D4AF37",
  green: "#22c55e",
  amber: "#f59e0b",
  gray: "#9ca3af",
  red: "#ef4444",
} as const;

// Status → marker color (matches the 2D OfficeView legend)
const STATUS_COLOR: Record<string, string> = {
  working: CALM_LUXURY.green,
  online: CALM_LUXURY.green,
  active: CALM_LUXURY.green,
  idle: CALM_LUXURY.amber,
  completed: CALM_LUXURY.amber,
  offline: CALM_LUXURY.gray,
  error: CALM_LUXURY.red,
};

/** Resolve a marker color from an agent status string. */
export function statusColor(status: string | undefined): string {
  return STATUS_COLOR[status ?? "offline"] ?? CALM_LUXURY.gray;
}

/** Layout agents on a grid across the city floor. */
function gridPosition(index: number, total: number): [number, number, number] {
  if (total <= 0) return [0, 0.5, 0];
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.ceil(total / cols);
  const spacing = 3.4;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = (col - (cols - 1) / 2) * spacing;
  const z = (row - (rows - 1) / 2) * spacing;
  return [x, 0.5, z];
}

// A single agent marker — a cube or sphere colored by status, with an
// emoji+name billboard label (HTML) floating above it.
export function AgentMarker({
  agent,
  index,
  total,
}: {
  agent: Agent;
  index: number;
  total: number;
}) {
  const color = statusColor(agent.status);
  const [x, y, z] = useMemo(() => gridPosition(index, total), [index, total]);
  const meshRef = useRef<THREE.Mesh>(null!);

  // Gentle idle rotation; a faster heartbeat when the agent is working.
  useFrame(() => {
    if (meshRef.current) {
      const speed = agent.status === "working" ? 0.008 : 0.0025;
      meshRef.current.rotation.y += speed;
    }
  });

  const useSphere = index % 2 === 1;

  return (
    <group position={[x, y, z]}>
      <mesh ref={meshRef} castShadow receiveShadow>
        {useSphere ? (
          <sphereGeometry args={[0.72, 18, 18]} />
        ) : (
          <boxGeometry args={[1.0, 1.7, 1.0]} />
        )}
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.28} />
      </mesh>

      {/* Billboard label: emoji + name, always faces the camera */}
      <Html
        position={[0, 1.75, 0]}
        style={{ pointerEvents: "none", userSelect: "none" }}
        distanceFactor={12}
        occlude="blending"
      >
        <div
          className="city-marker-label"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.2rem 0.5rem",
            borderRadius: "0.5rem",
            background: "color-mix(in srgb, #000 65%, transparent)",
            border: `1px solid ${color}44`,
            color: "#ffffff",
            fontSize: "0.62rem",
            lineHeight: 1,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span role="img" aria-label={agent.name}>
            {agent.emoji}
          </span>
          <span style={{ fontWeight: 600, color: CALM_LUXURY.gold }}>
            {agent.name}
          </span>
        </div>
      </Html>
    </group>
  );
}

// Ground plane + the city's Calm Luxury lighting rig
function CityGround() {
  return (
    <>
      <color attach="background" args={[CALM_LUXURY.navy]} />
      {/* Soft fill light */}
      <ambientLight intensity={0.55} color="#cdd6e0" />
      {/* Gold-accent key light, casts the status marker shadows */}
      <directionalLight
        position={[14, 24, 12]}
        intensity={1.35}
        color={CALM_LUXURY.gold}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      {/* Navy ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[320, 320]} />
        <meshStandardMaterial color={CALM_LUXURY.navyGround} />
      </mesh>
    </>
  );
}

export interface VirtualCityProps {
  agents: Agent[];
}

/**
 * 3D city view over the agent roster. Replaces the 2D org tree when the
 * "3D City" toggle is active in OfficeView. License-clean: three.js only.
 */
export default function VirtualCity({ agents }: VirtualCityProps) {
  const total = agents.length;

  return (
    <Canvas
      camera={{ position: [0, 16, 30], fov: 48, near: 0.1, far: 400 }}
      shadows
      data-testid="city-canvas"
    >
      <CityGround />
      {agents.map((agent, i) => (
        <AgentMarker key={agent.id} agent={agent} index={i} total={total} />
      ))}
    </Canvas>
  );
}
