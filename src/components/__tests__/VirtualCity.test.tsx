import type { ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import OfficeView, { type Agent } from "@/components/OfficeView";
import VirtualCity, {
  statusColor,
  CALM_LUXURY,
} from "@/components/VirtualCity";

/* ───────────────────────────────────────────────────────────
   Canvas 2D isometric city smoke tests.
   The component renders a single <canvas data-testid="city-canvas">
   with no DOM children, so we assert structural presence only.
   ─────────────────────────────────────────────────────────── */

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
  test("renders a canvas element for the city", () => {
    render(<VirtualCity agents={roster} />);
    expect(screen.getByTestId("city-canvas")).toBeTruthy();
  });

  test("renders without crashing for an empty roster", () => {
    render(<VirtualCity agents={[]} />);
    expect(screen.getByTestId("city-canvas")).toBeTruthy();
  });
});

describe("OfficeView 2D/3D toggle", () => {
  test("defaults to 2D org chart; toggle swaps to city and back", () => {
    render(<OfficeView agents={roster} onChat={() => {}} />);

    // 2D org chart is the default render
    expect(screen.getByText("CEO")).toBeTruthy();
    expect(screen.queryByTestId("city-canvas")).toBeFalsy();

    const toggle = screen.getByRole("button", { name: /toggle 3d city mode/i });

    // flip to city
    fireEvent.click(toggle);
    expect(screen.getByTestId("city-canvas")).toBeTruthy();
    expect(screen.queryByText("CEO")).toBeFalsy();

    // flip back to 2D: original state restored
    fireEvent.click(toggle);
    expect(screen.queryByTestId("city-canvas")).toBeFalsy();
    expect(screen.getByText("CEO")).toBeTruthy();
  });
});
