import type { ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import OfficeView, { type Agent } from "@/components/OfficeView";
import VirtualCity, {
  statusColor,
  CALM_LUXURY,
} from "@/components/VirtualCity";

/* ───────────────────────────────────────────────────────────
   jsdom cannot host a WebGL canvas, so @react-three/fiber's real
   <Canvas> cannot initialize here. Stub the 3D renderer to plain DOM
   so the component wiring can be asserted structurally & headless-safe:
     • <Canvas>   → renders its scene-graph children as a div
     • drei <Html> → one div per agent marker (each AgentMarker renders
                      exactly one Html label → 1:1 marker proxy)
   `three` is imported only as a type by VirtualCity, so it is never
   loaded at runtime in this test.
   Uses only core vitest matchers so the test stays type-safe under Vitest.
   ─────────────────────────────────────────────────────────── */
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children?: ReactNode }) => (
    <div data-testid="city-canvas">{children}</div>
  ),
  useFrame: () => {},
  useThree: () => ({ scene: { add: () => {}, remove: () => {} } }),
  extend: () => {},
}));

vi.mock("@react-three/drei", () => ({
  Html: ({ children }: { children?: ReactNode }) => (
    <div data-testid="city-marker">{children}</div>
  ),
  Text: ({ children }: { children?: ReactNode }) => (
    <div data-testid="city-text">{children}</div>
  ),
  OrbitControls: () => <div data-testid="city-controls" />,
}));

const roster: Agent[] = [
  {
    id: "ceo-1",
    name: "Aria Vance",
    emoji: "🧑‍💼",
    role: "CEO",
    reportsTo: null,
    status: "online",
    currentTask: "setting strategy",
    lastActive: new Date().toISOString(),
    channel: "mission-control",
    tasksCompleted: 42,
    totalCost: 3.21,
    recentActivity: [],
  },
  {
    id: "eng-1",
    name: "Bex Rojas",
    emoji: "👩‍💻",
    role: "Engineer",
    reportsTo: "ceo-1",
    status: "working",
    currentTask: "shipping the city",
    lastActive: new Date().toISOString(),
    channel: "build",
    tasksCompleted: 76,
    totalCost: 5.0,
    recentActivity: [],
  },
  {
    id: "eng-2",
    name: "Cai Lin",
    emoji: "👨‍💻",
    role: "Engineer",
    reportsTo: "ceo-1",
    status: "working",
    currentTask: "lighting the skyline",
    lastActive: new Date().toISOString(),
    channel: "build",
    tasksCompleted: 19,
    totalCost: 2.2,
    recentActivity: [],
  },
  {
    id: "mkt-1",
    name: "Dex Park",
    emoji: "📈",
    role: "Marketer",
    reportsTo: "ceo-1",
    status: "idle",
    lastActive: new Date().toISOString(),
    channel: "growth",
    tasksCompleted: 4,
    totalCost: 0.8,
    recentActivity: [],
  },
  {
    id: "ops-1",
    name: "Eve Ostrom",
    emoji: "⚙️",
    role: "Ops",
    reportsTo: "ceo-1",
    status: "offline",
    tasksCompleted: 11,
    totalCost: 0.3,
    recentActivity: [],
  },
  {
    id: "err-1",
    name: "Finn Cross",
    emoji: "🚨",
    role: "On-Call",
    reportsTo: "ceo-1",
    status: "error",
    currentTask: "red zone",
    lastActive: new Date().toISOString(),
    channel: "ops",
    tasksCompleted: 0,
    totalCost: 0.05,
    recentActivity: [],
  },
];

describe("statusColor — Calm Luxury status → marker color", () => {
  test("green for working/online/active", () => {
    expect(statusColor("working")).toBe(CALM_LUXURY.green);
    expect(statusColor("online")).toBe(CALM_LUXURY.green);
    expect(statusColor("active")).toBe(CALM_LUXURY.green);
  });

  test("amber for idle/completed", () => {
    expect(statusColor("idle")).toBe(CALM_LUXURY.amber);
    expect(statusColor("completed")).toBe(CALM_LUXURY.amber);
  });

  test("gray for offline and unknown", () => {
    expect(statusColor("offline")).toBe(CALM_LUXURY.gray);
    expect(statusColor("unknown")).toBe(CALM_LUXURY.gray);
    expect(statusColor(undefined)).toBe(CALM_LUXURY.gray);
  });

  test("red for error", () => {
    expect(statusColor("error")).toBe(CALM_LUXURY.red);
  });
});

describe("VirtualCity smoke test", () => {
  test("renders one 3D marker per agent in the roster", () => {
    render(<VirtualCity agents={roster} />);

    expect(screen.getByTestId("city-canvas")).toBeTruthy();
    expect(screen.getAllByTestId("city-marker")).toHaveLength(roster.length);

    // each marker's label carries the agent's name
    roster.forEach((a) => {
      expect(screen.getByText(a.name)).toBeTruthy();
    });
  });

  test("renders zero markers for an empty roster", () => {
    render(<VirtualCity agents={[]} />);
    expect(screen.getByTestId("city-canvas")).toBeTruthy();
    expect(screen.queryByTestId("city-marker")).toBeFalsy();
  });
});

describe("OfficeView 3D City toggle", () => {
  test("defaults to 2D org chart; toggle swaps to 3D city and back with no state loss", () => {
    render(<OfficeView agents={roster} onChat={() => {}} />);

    // 2D org chart is the default render
    expect(screen.getByText("CEO")).toBeTruthy(); // ceo role on the ceo card
    expect(screen.queryByTestId("city-canvas")).toBeFalsy();

    const toggle = screen.getByRole("button", { name: /toggle 3d city mode/i });

    // → flip to 3D city
    fireEvent.click(toggle);
    expect(screen.getByTestId("city-canvas")).toBeTruthy();
    expect(screen.getAllByTestId("city-marker")).toHaveLength(roster.length);
    // 2D org tree (role label) is no longer in the chart
    expect(screen.queryByText("CEO")).toBeFalsy();

    // → flip back to 2D: original 2D state is restored, not lost
    fireEvent.click(toggle);
    expect(screen.queryByTestId("city-canvas")).toBeFalsy();
    expect(screen.getByText("CEO")).toBeTruthy(); // 2D state intact
  });
});
